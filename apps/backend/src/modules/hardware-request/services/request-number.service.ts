// apps/backend/src/modules/hardware-request/services/request-number.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { HardwareRequest } from '../domain/entities/hardware-request.entity';

@Injectable()
export class RequestNumberService {
    constructor(
        @InjectRepository(HardwareRequest)
        private readonly repo: Repository<HardwareRequest>,
    ) {}

    async generate(now: Date = new Date()): Promise<string> {
        const year = now.getUTCFullYear();
        const yearStart = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
        const yearEnd = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0));
        const existing = await this.repo.count({
            where: { createdAt: Between(yearStart, yearEnd) },
        });
        const next = existing + 1;
        const seq = next.toString().padStart(4, '0');
        return `HR-${year}-${seq}`;
    }
}
