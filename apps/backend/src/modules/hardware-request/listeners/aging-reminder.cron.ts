import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { HardwareRequest } from '../domain/entities/hardware-request.entity';
import { RequestStatus } from '../domain/enums/request-status.enum';
import { HR_EVT } from '../domain/events/hardware-request.events';

const DAYS = 24 * 60 * 60 * 1000;

@Injectable()
export class AgingReminderCron {
    private readonly log = new Logger(AgingReminderCron.name);
    private readonly thresholdDays = 7;

    constructor(
        @InjectRepository(HardwareRequest) private readonly repo: Repository<HardwareRequest>,
        private readonly emitter: EventEmitter2,
    ) {}

    @Cron('0 7 * * *', { timeZone: 'Asia/Jakarta', name: 'hr-aging-reminder' })
    async runDaily() {
        const nonTerminal = [
            RequestStatus.SUBMITTED, RequestStatus.UNDER_REVIEW,
            RequestStatus.APPROVED, RequestStatus.PROCUREMENT, RequestStatus.INSTALLATION,
        ];
        const rows = await this.repo.find({ where: { status: In(nonTerminal) } });
        const now = Date.now();
        for (const r of rows) {
            const days = Math.floor((now - new Date(r.updatedAt).getTime()) / DAYS);
            if (days < this.thresholdDays) continue;
            this.emitter.emit(HR_EVT.AGING_FLAGGED, {
                requestId: r.id, actorId: 'system', requesterId: r.requesterId,
                occurredAt: new Date(), daysInStatus: days, status: r.status,
            });
        }
        this.log.log(`aging reminder scanned ${rows.length} requests`);
    }
}
