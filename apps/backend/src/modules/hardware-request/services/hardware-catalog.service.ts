// apps/backend/src/modules/hardware-request/services/hardware-catalog.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HardwareCatalog } from '../domain/entities/hardware-catalog.entity';
import { CatalogItemInactiveError } from '../domain/errors';
import { CreateCatalogDto } from '../dto/create-catalog.dto';
import { UpdateCatalogDto } from '../dto/update-catalog.dto';
import { CacheService } from '../../shared/core/cache/cache.service';

@Injectable()
export class HardwareCatalogService {
    private static readonly CACHE_TTL = 60; // seconds
    private static readonly KEY_ACTIVE = 'hw-catalog:list:active';
    private static readonly KEY_ALL = 'hw-catalog:list:all';
    private static readonly KEY_ONE = (id: string) => `hw-catalog:item:${id}`;

    constructor(
        @InjectRepository(HardwareCatalog)
        private readonly repo: Repository<HardwareCatalog>,
        private readonly cacheService: CacheService,
    ) {}

    listActive(): Promise<HardwareCatalog[]> {
        // P1 perf: catalog is static reference data and is fetched on every
        // request-form open. 60s cache drops the hot-path DB hit.
        return this.cacheService.getOrSet(
            HardwareCatalogService.KEY_ACTIVE,
            async () => this.repo.find({
                where: { active: true },
                order: { displayOrder: 'ASC', name: 'ASC' },
            }),
            HardwareCatalogService.CACHE_TTL,
        );
    }

    listAll(): Promise<HardwareCatalog[]> {
        return this.cacheService.getOrSet(
            HardwareCatalogService.KEY_ALL,
            async () => this.repo.find({ order: { displayOrder: 'ASC', name: 'ASC' } }),
            HardwareCatalogService.CACHE_TTL,
        );
    }

    async getById(id: string): Promise<HardwareCatalog> {
        return this.cacheService.getOrSet(
            HardwareCatalogService.KEY_ONE(id),
            async () => {
                const found = await this.repo.findOne({ where: { id } });
                if (!found) {
                    throw new NotFoundException({ code: 'HR_CATALOG_NOT_FOUND', message: 'Catalog not found' });
                }
                return found;
            },
            HardwareCatalogService.CACHE_TTL,
        );
    }

    async ensureActive(id: string): Promise<HardwareCatalog> {
        // Hot-path lookup from request creation. Same caching rationale as
        // getById — the active-flag check still has to be authoritative, so
        // we read from the cache but the truth source is still the DB row.
        const found = await this.getById(id);
        if (!found.active) {
            throw new CatalogItemInactiveError(id);
        }
        return found;
    }

    async create(dto: CreateCatalogDto): Promise<HardwareCatalog> {
        const dup = await this.repo.findOne({ where: { code: dto.code } });
        if (dup) {
            throw new BadRequestException({
                code: 'HR_CATALOG_DUPLICATE_CODE',
                message: `Catalog code ${dto.code} already exists`,
            });
        }
        const entity = this.repo.create({
            code: dto.code,
            name: dto.name,
            category: dto.category,
            defaultSpecs: dto.defaultSpecs ?? {},
            requiredFields: dto.requiredFields ?? [],
            active: dto.active ?? true,
            displayOrder: dto.displayOrder ?? 0,
        });
        const saved = await this.repo.save(entity);
        await this.invalidateListCaches();
        return saved;
    }

    async update(id: string, dto: UpdateCatalogDto): Promise<HardwareCatalog> {
        const existing = await this.getById(id);
        Object.assign(existing, dto);
        const saved = await this.repo.save(existing);
        await this.invalidateListCaches();
        await this.cacheService.delAsync(HardwareCatalogService.KEY_ONE(id)).catch(() => undefined);
        return saved;
    }

    async remove(id: string): Promise<void> {
        const existing = await this.getById(id);
        await this.repo.remove(existing);
        await this.invalidateListCaches();
        await this.cacheService.delAsync(HardwareCatalogService.KEY_ONE(id)).catch(() => undefined);
    }

    private async invalidateListCaches(): Promise<void> {
        await Promise.all([
            this.cacheService.delAsync(HardwareCatalogService.KEY_ACTIVE).catch(() => undefined),
            this.cacheService.delAsync(HardwareCatalogService.KEY_ALL).catch(() => undefined),
        ]);
    }
}
