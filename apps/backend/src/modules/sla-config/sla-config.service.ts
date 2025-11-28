import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SlaConfig } from '../../modules/ticketing/entities/sla-config.entity';
import { TicketPriority } from '../../modules/ticketing/entities/ticket.entity';

@Injectable()
export class SlaConfigService implements OnModuleInit {
    constructor(
        @InjectRepository(SlaConfig)
        private slaConfigRepo: Repository<SlaConfig>,
    ) { }

    async onModuleInit() {
        // Seed default SLA configs if not exists
        const count = await this.slaConfigRepo.count();
        if (count === 0) {
            await this.slaConfigRepo.save([
                { priority: TicketPriority.LOW, resolutionTimeMinutes: 48 * 60, responseTimeMinutes: 24 * 60 },
                { priority: TicketPriority.MEDIUM, resolutionTimeMinutes: 24 * 60, responseTimeMinutes: 8 * 60 },
                { priority: TicketPriority.HIGH, resolutionTimeMinutes: 8 * 60, responseTimeMinutes: 4 * 60 },
            ]);
        }
    }

    findAll() {
        return this.slaConfigRepo.find({
            order: {
                resolutionTimeMinutes: 'DESC',
            },
        });
    }

    update(id: string, resolutionTimeMinutes: number) {
        return this.slaConfigRepo.update(id, { resolutionTimeMinutes });
    }

    async resetDefaults() {
        await this.slaConfigRepo.clear();
        await this.slaConfigRepo.save([
            { priority: TicketPriority.LOW, resolutionTimeMinutes: 48 * 60, responseTimeMinutes: 24 * 60 },
            { priority: TicketPriority.MEDIUM, resolutionTimeMinutes: 24 * 60, responseTimeMinutes: 8 * 60 },
            { priority: TicketPriority.HIGH, resolutionTimeMinutes: 8 * 60, responseTimeMinutes: 4 * 60 },
            { priority: TicketPriority.CRITICAL, resolutionTimeMinutes: 2 * 60, responseTimeMinutes: 1 * 60 },
        ]);
    }
}
