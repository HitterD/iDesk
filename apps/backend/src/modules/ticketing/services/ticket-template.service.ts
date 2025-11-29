import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TicketTemplate } from '../entities/ticket-template.entity';
import { CreateTicketTemplateDto, UpdateTicketTemplateDto } from '../dto/ticket-template.dto';

@Injectable()
export class TicketTemplateService {
    constructor(
        @InjectRepository(TicketTemplate)
        private readonly templateRepo: Repository<TicketTemplate>,
    ) {}

    async create(dto: CreateTicketTemplateDto): Promise<TicketTemplate> {
        const template = this.templateRepo.create(dto);
        return this.templateRepo.save(template);
    }

    async findAll(activeOnly: boolean = false): Promise<TicketTemplate[]> {
        const where = activeOnly ? { isActive: true } : {};
        return this.templateRepo.find({
            where,
            order: { usageCount: 'DESC', name: 'ASC' },
        });
    }

    async findOne(id: string): Promise<TicketTemplate> {
        const template = await this.templateRepo.findOne({ where: { id } });
        if (!template) {
            throw new NotFoundException('Template not found');
        }
        return template;
    }

    async update(id: string, dto: UpdateTicketTemplateDto): Promise<TicketTemplate> {
        const template = await this.findOne(id);
        Object.assign(template, dto);
        return this.templateRepo.save(template);
    }

    async remove(id: string): Promise<void> {
        const template = await this.findOne(id);
        await this.templateRepo.remove(template);
    }

    async incrementUsage(id: string): Promise<void> {
        await this.templateRepo.increment({ id }, 'usageCount', 1);
    }

    async getPopularTemplates(limit: number = 5): Promise<TicketTemplate[]> {
        return this.templateRepo.find({
            where: { isActive: true },
            order: { usageCount: 'DESC' },
            take: limit,
        });
    }
}
