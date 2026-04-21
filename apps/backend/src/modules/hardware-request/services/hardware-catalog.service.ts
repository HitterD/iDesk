// apps/backend/src/modules/hardware-request/services/hardware-catalog.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HardwareCatalog } from '../domain/entities/hardware-catalog.entity';
import { CatalogItemInactiveError } from '../domain/errors';
import { CreateCatalogDto } from '../dto/create-catalog.dto';
import { UpdateCatalogDto } from '../dto/update-catalog.dto';

@Injectable()
export class HardwareCatalogService {
    constructor(
        @InjectRepository(HardwareCatalog)
        private readonly repo: Repository<HardwareCatalog>,
    ) {}

    listActive(): Promise<HardwareCatalog[]> {
        return this.repo.find({
            where: { active: true },
            order: { displayOrder: 'ASC', name: 'ASC' },
        });
    }

    listAll(): Promise<HardwareCatalog[]> {
        return this.repo.find({ order: { displayOrder: 'ASC', name: 'ASC' } });
    }

    async getById(id: string): Promise<HardwareCatalog> {
        const found = await this.repo.findOne({ where: { id } });
        if (!found) {
            throw new NotFoundException({ code: 'HR_CATALOG_NOT_FOUND', message: 'Catalog not found' });
        }
        return found;
    }

    async ensureActive(id: string): Promise<HardwareCatalog> {
        const found = await this.repo.findOne({ where: { id } });
        if (!found || !found.active) {
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
        return this.repo.save(entity);
    }

    async update(id: string, dto: UpdateCatalogDto): Promise<HardwareCatalog> {
        const existing = await this.getById(id);
        Object.assign(existing, dto);
        return this.repo.save(existing);
    }

    async remove(id: string): Promise<void> {
        const existing = await this.getById(id);
        await this.repo.remove(existing);
    }
}
