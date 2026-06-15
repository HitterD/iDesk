import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SlaConfig } from '../../modules/ticketing/entities/sla-config.entity';
import { TicketPriority } from '../../modules/ticketing/entities/ticket.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { CacheService } from '../../shared/core/cache/cache.service';

@Injectable()
export class SlaConfigService implements OnModuleInit {
    private static readonly CACHE_KEY = 'sla-config:all';
    private static readonly CACHE_TTL = 60; // 1 min — SLA is hot, but rarely changes

    constructor(
        private readonly auditService: AuditService,
        @InjectRepository(SlaConfig)
        private slaConfigRepo: Repository<SlaConfig>,
        private readonly cacheService: CacheService,
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
        // P1 perf: SLA config is referenced by every ticket-create (startSlaClock)
        // and the SLA monitor cron. 60s cache drops a hot DB read.
        return this.cacheService.getOrSet(
            SlaConfigService.CACHE_KEY,
            () => this.slaConfigRepo.find({
                order: { resolutionTimeMinutes: 'DESC' },
            }),
            SlaConfigService.CACHE_TTL,
        );
    }

    async update(id: string, resolutionTimeMinutes: number, userId?: string) {
        await this.slaConfigRepo.update(id, { resolutionTimeMinutes });

        if (userId) {
            this.auditService.logAsync({
                userId,
                action: AuditAction.SLA_CONFIG_CHANGE,
                entityType: 'SlaConfig',
                entityId: id,
                description: `Updated SLA Config resolution time`,
                newValue: { resolutionTimeMinutes },
            });
        }

        await this.cacheService.delAsync(SlaConfigService.CACHE_KEY).catch(() => undefined);
        return this.slaConfigRepo.findOne({ where: { id } });
    }

    async resetDefaults(userId?: string) {
        await this.slaConfigRepo.clear();
        await this.slaConfigRepo.save([
            { priority: TicketPriority.LOW, resolutionTimeMinutes: 48 * 60, responseTimeMinutes: 24 * 60 },
            { priority: TicketPriority.MEDIUM, resolutionTimeMinutes: 24 * 60, responseTimeMinutes: 8 * 60 },
            { priority: TicketPriority.HIGH, resolutionTimeMinutes: 8 * 60, responseTimeMinutes: 4 * 60 },
            { priority: TicketPriority.CRITICAL, resolutionTimeMinutes: 2 * 60, responseTimeMinutes: 1 * 60 },
        ]);

        if (userId) {
            this.auditService.logAsync({
                userId,
                action: AuditAction.SLA_CONFIG_CHANGE,
                entityType: 'SlaConfig',
                entityId: 'ALL',
                description: `Reset SLA configs to defaults`,
            });
        }

        await this.cacheService.delAsync(SlaConfigService.CACHE_KEY).catch(() => undefined);
    }
}
