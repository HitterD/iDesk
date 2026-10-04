// apps/backend/src/modules/hardware-request/services/request-number.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { HardwareRequest } from '../domain/entities/hardware-request.entity';

const SEQ_PAD = 4;
/** Namespace for pg_advisory_xact_lock so request numbering never collides with other locks. */
const NUMBERING_LOCK_KEY = 'hardware-request-number';

@Injectable()
export class RequestNumberService {
    constructor(
        @InjectRepository(HardwareRequest)
        private readonly repo: Repository<HardwareRequest>,
    ) {}

    /**
     * Next `HR-YYYY-NNNN`. Pass the transaction's manager: the advisory lock is held
     * until that transaction commits, so two concurrent drafts cannot read the same
     * max and collide on the unique request number. Max (not count) keeps numbers
     * unique after deletions.
     */
    async generate(now: Date = new Date(), manager?: EntityManager): Promise<string> {
        const year = now.getUTCFullYear();
        const prefix = `HR-${year}-`;
        const runner = manager ?? this.repo.manager;
        if (manager) {
            await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${NUMBERING_LOCK_KEY}:${year}`]);
        }
        const rows: { maxSeq: string | null }[] = await runner.query(
            `SELECT MAX(CAST(SUBSTRING("requestNumber" FROM $2) AS INTEGER)) AS "maxSeq"
               FROM hardware_requests
              WHERE "requestNumber" LIKE $1 AND SUBSTRING("requestNumber" FROM $2) ~ '^[0-9]+$'`,
            [`${prefix}%`, prefix.length + 1],
        );
        const next = Number(rows[0]?.maxSeq ?? 0) + 1;
        return `${prefix}${String(next).padStart(SEQ_PAD, '0')}`;
    }
}
