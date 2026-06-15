import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TicketTemplate } from '../entities/ticket-template.entity';
import { CreateTicketTemplateDto, UpdateTicketTemplateDto } from '../dto/ticket-template.dto';
import { CacheService } from '../../shared/core/cache/cache.service';

@Injectable()
export class TicketTemplateService {
    private static readonly CACHE_TTL = 60; // seconds
    private static readonly KEY_ALL = 'ticket-templates:all';
    private static readonly KEY_POPULAR = (limit: number) => `ticket-templates:popular:${limit}`;
    private static readonly KEY_ONE = (id: string) => `ticket-templates:${id}`;

    constructor(
        @InjectRepository(TicketTemplate)
        private readonly templateRepo: Repository<TicketTemplate>,
        private readonly cacheService: CacheService,
    ) {}

    async create(dto: CreateTicketTemplateDto): Promise<TicketTemplate> {
        const template = this.templateRepo.create(dto);
        const saved = await this.templateRepo.save(template);
        await this.invalidateAll();
        return saved;
    }

    async findAll(activeOnly: boolean = false): Promise<TicketTemplate[]> {
        // P1 perf: reference data, fit for caching. activeOnly variants cached
        // separately so they don't collide with the "include inactive" form.
        const key = `ticket-templates:all:${activeOnly ? 'active' : 'all'}`;
        return this.cacheService.getOrSet(
            key,
            async () => this.templateRepo.find({
                where: activeOnly ? { isActive: true } : {},
                order: { usageCount: 'DESC', name: 'ASC' },
            }),
            TicketTemplateService.CACHE_TTL,
        );
    }

    async findOne(id: string): Promise<TicketTemplate> {
        return this.cacheService.getOrSet(
            TicketTemplateService.KEY_ONE(id),
            async () => {
                const template = await this.templateRepo.findOne({ where: { id } });
                if (!template) {
                    throw new NotFoundException('Template not found');
                }
                return template;
            },
            TicketTemplateService.CACHE_TTL,
        );
    }

    async update(id: string, dto: UpdateTicketTemplateDto): Promise<TicketTemplate> {
        const template = await this.findOne(id); // may throw NotFoundException
        Object.assign(template, dto);
        const saved = await this.templateRepo.save(template);
        await this.invalidateAll();
        return saved;
    }

    async remove(id: string): Promise<void> {
        const template = await this.findOne(id);
        await this.templateRepo.remove(template);
        await this.invalidateAll();
    }

    async incrementUsage(id: string): Promise<void> {
        await this.templateRepo.increment({ id }, 'usageCount', 1);
        // usageCount changes → list ordering changes → drop the lists
        await this.cacheService.delAsync(TicketTemplateService.KEY_ALL).catch(() => undefined);
        await this.cacheService.delAsync(TicketTemplateService.KEY_ONE(id)).catch(() => undefined);
    }

    async getPopularTemplates(limit: number = 5): Promise<TicketTemplate[]> {
        return this.cacheService.getOrSet(
            TicketTemplateService.KEY_POPULAR(limit),
            async () => this.templateRepo.find({
                where: { isActive: true },
                order: { usageCount: 'DESC' },
                take: limit,
            }),
            TicketTemplateService.CACHE_TTL,
        );
    }

    private async invalidateAll(): Promise<void> {
        // Cheap and bounded — only 4 keys max to flush per mutation.
        await Promise.all([
            this.cacheService.delAsync('ticket-templates:all:active').catch(() => undefined),
            this.cacheService.delAsync('ticket-templates:all:all').catch(() => undefined),
            this.cacheService.delAsync(TicketTemplateService.KEY_ALL).catch(() => undefined),
        ]);
    }
}
