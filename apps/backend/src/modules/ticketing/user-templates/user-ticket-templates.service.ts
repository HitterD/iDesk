import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserTicketTemplate } from './user-ticket-template.entity';
import { CreateUserTicketTemplateDto, UpdateUserTicketTemplateDto } from './user-ticket-template.dto';
import { USER_TEMPLATE_MAX_PER_USER, UserTemplateTicketType } from './user-ticket-template.constants';

const NOT_FOUND = 'Template tidak ditemukan';

/** Personal templates: every query is scoped to the caller, so nobody reads or edits another person's. */
@Injectable()
export class UserTicketTemplatesService {
    constructor(
        @InjectRepository(UserTicketTemplate)
        private readonly repo: Repository<UserTicketTemplate>,
    ) { }

    list(userId: string, ticketType?: UserTemplateTicketType): Promise<UserTicketTemplate[]> {
        return this.repo.find({
            where: ticketType ? { userId, ticketType } : { userId },
            order: { createdAt: 'ASC' },
        });
    }

    async create(userId: string, dto: CreateUserTicketTemplateDto): Promise<UserTicketTemplate> {
        const count = await this.repo.count({ where: { userId } });
        if (count >= USER_TEMPLATE_MAX_PER_USER) {
            throw new BadRequestException(`Maksimal ${USER_TEMPLATE_MAX_PER_USER} template per pengguna. Hapus template lama terlebih dahulu.`);
        }
        await this.assertLabelFree(userId, dto.ticketType, dto.label);
        return this.repo.save(this.repo.create({
            userId,
            ticketType: dto.ticketType,
            label: dto.label,
            title: dto.title,
            description: dto.description,
            priority: dto.priority,
            category: dto.category ?? null,
            device: dto.device ?? null,
            software: dto.software ?? null,
        }));
    }

    async update(userId: string, id: string, dto: UpdateUserTicketTemplateDto): Promise<UserTicketTemplate> {
        const template = await this.findOwned(userId, id);
        if (dto.label !== undefined && dto.label.toLowerCase() !== template.label.toLowerCase()) {
            await this.assertLabelFree(userId, template.ticketType, dto.label);
        }
        const defined = Object.fromEntries(Object.entries(dto).filter(([, value]) => value !== undefined));
        return this.repo.save({ ...template, ...defined });
    }

    async remove(userId: string, id: string): Promise<{ success: true }> {
        const template = await this.findOwned(userId, id);
        await this.repo.remove(template);
        return { success: true };
    }

    private async findOwned(userId: string, id: string): Promise<UserTicketTemplate> {
        const template = await this.repo.findOne({ where: { id, userId } });
        if (!template) throw new NotFoundException(NOT_FOUND);
        return template;
    }

    /** Chip names must be distinguishable on one form (case-insensitive). */
    private async assertLabelFree(userId: string, ticketType: UserTemplateTicketType, label: string): Promise<void> {
        const taken = await this.repo.createQueryBuilder('t')
            .where('t.userId = :userId', { userId })
            .andWhere('t.ticketType = :ticketType', { ticketType })
            .andWhere('LOWER(t.label) = LOWER(:label)', { label })
            .getCount();
        if (taken > 0) throw new BadRequestException(`Template "${label}" sudah ada`);
    }
}
