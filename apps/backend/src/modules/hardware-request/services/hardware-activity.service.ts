import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HardwareRequestActivity } from '../domain/entities/hardware-request-activity.entity';
import { HardwareRequest } from '../domain/entities/hardware-request.entity';
import { HardwareRole } from '../domain/enums/hardware-role.enum';
import {
    HardwareRequestNotFoundError,
    PermissionDeniedError,
} from '../domain/errors';
import { ActingUser } from './hardware-request-query.service';

@Injectable()
export class HardwareActivityService {
    constructor(
        @InjectRepository(HardwareRequestActivity)
        private readonly repo: Repository<HardwareRequestActivity>,
        @InjectRepository(HardwareRequest)
        private readonly requestRepo: Repository<HardwareRequest>,
    ) {}

    async listForRequest(user: ActingUser, requestId: string): Promise<HardwareRequestActivity[]> {
        const req = await this.requestRepo.findOne({ where: { id: requestId } });
        if (!req) throw new HardwareRequestNotFoundError(requestId);
        if (user.role === HardwareRole.USER && req.requesterId !== user.id) {
            throw new PermissionDeniedError('view activity for this request');
        }
        return this.repo.find({
            where: { requestId },
            order: { createdAt: 'ASC' },
            relations: { actor: true },
        });
    }

    async log(requestId: string, actorId: string | null, action: string, metadata: Record<string, unknown> = {}): Promise<void> {
        const req = await this.requestRepo.findOne({ where: { id: requestId } });
        if (!req) return;
        const entry = this.repo.create({
            requestId,
            actorId,
            action: action as any,
            fromStatus: req.status,
            toStatus: req.status,
            metadata,
        });
        await this.repo.save(entry);
    }
}
