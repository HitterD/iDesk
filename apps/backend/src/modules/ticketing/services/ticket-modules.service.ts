import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TicketModule } from '../entities/ticket-module.entity';
import { CreateTicketModuleDto, UpdateTicketModuleDto } from '../dto/ticket-module.dto';
import { UserRole } from '../../users/enums/user-role.enum';

@Injectable()
export class TicketModulesService {
    private readonly logger = new Logger(TicketModulesService.name);

    constructor(
        @InjectRepository(TicketModule)
        private readonly moduleRepo: Repository<TicketModule>,
    ) { }

    /**
     * Get active modules visible to the user's role (used by Sidebar navigation & client board)
     */
    async findAllForUser(userRole: UserRole): Promise<TicketModule[]> {
        if (userRole === UserRole.ADMIN) {
            return this.moduleRepo.find({
                where: { isActive: true },
                order: { sortOrder: 'ASC', createdAt: 'ASC' },
            });
        }

        const qb = this.moduleRepo.createQueryBuilder('module');
        qb.where('module.isActive = :isActive', { isActive: true })
            .andWhere(':userRole = ANY(module.allowedRoles)', { userRole })
            .orderBy('module.sortOrder', 'ASC')
            .addOrderBy('module.createdAt', 'ASC');

        return qb.getMany();
    }

    /**
     * Get all modules (for Admin Settings management)
     */
    async findAllForAdmin(): Promise<TicketModule[]> {
        return this.moduleRepo.find({
            order: { sortOrder: 'ASC', createdAt: 'ASC' },
        });
    }

    /**
     * Get single module by slug
     */
    async findBySlug(slug: string): Promise<TicketModule> {
        const module = await this.moduleRepo.findOne({ where: { slug } });
        if (!module) {
            throw new NotFoundException(`Ticket module with slug "${slug}" not found`);
        }
        return module;
    }

    /**
     * Get single module by ID
     */
    async findById(id: string): Promise<TicketModule> {
        const module = await this.moduleRepo.findOne({ where: { id } });
        if (!module) {
            throw new NotFoundException(`Ticket module with ID "${id}" not found`);
        }
        return module;
    }

    /**
     * Create a new ticket module
     */
    async create(dto: CreateTicketModuleDto): Promise<TicketModule> {
        const existing = await this.moduleRepo.findOne({ where: { slug: dto.slug } });
        if (existing) {
            throw new ConflictException(`Ticket module with slug "${dto.slug}" already exists`);
        }

        const count = await this.moduleRepo.count();
        const module = this.moduleRepo.create({
            name: dto.name,
            slug: dto.slug,
            description: dto.description || '',
            icon: dto.icon || 'Ticket',
            color: dto.color || 'blue',
            sortOrder: dto.sortOrder ?? (count + 1),
            isActive: dto.isActive ?? true,
            isSystem: false,
            handlingTeams: dto.handlingTeams && dto.handlingTeams.length > 0 ? dto.handlingTeams : [],
            categories: dto.categories && dto.categories.length > 0 ? dto.categories : [],
            ticketTypes: dto.ticketTypes && dto.ticketTypes.length > 0 ? dto.ticketTypes : [],
            allowedRoles: dto.allowedRoles && dto.allowedRoles.length > 0
                ? dto.allowedRoles
                : [UserRole.ADMIN, UserRole.AGENT, UserRole.AGENT_OPERATIONAL_SUPPORT, UserRole.AGENT_ADMIN, UserRole.MANAGER],
            assigneeRoles: dto.assigneeRoles && dto.assigneeRoles.length > 0
                ? dto.assigneeRoles
                : [UserRole.ADMIN, UserRole.AGENT, UserRole.AGENT_OPERATIONAL_SUPPORT, UserRole.AGENT_ADMIN],
            assigneeUserIds: dto.assigneeUserIds ?? [],
            // Off by default: a new queue should not silently pull tickets into
            // the workload pool until an admin turns it on.
            autoAssignEnabled: dto.autoAssignEnabled ?? false,
        });

        const saved = await this.moduleRepo.save(module);
        this.logger.log(`Created custom ticket module: ${saved.name} (${saved.slug})`);
        return saved;
    }

    /**
     * Update an existing ticket module
     */
    async update(id: string, dto: UpdateTicketModuleDto): Promise<TicketModule> {
        const module = await this.findById(id);

        if (dto.slug && dto.slug !== module.slug) {
            const conflict = await this.moduleRepo.findOne({ where: { slug: dto.slug } });
            if (conflict) {
                throw new ConflictException(`Ticket module with slug "${dto.slug}" already exists`);
            }
            module.slug = dto.slug;
        }

        if (dto.name !== undefined) module.name = dto.name;
        if (dto.description !== undefined) module.description = dto.description;
        if (dto.icon !== undefined) module.icon = dto.icon;
        if (dto.color !== undefined) module.color = dto.color;
        if (dto.sortOrder !== undefined) module.sortOrder = dto.sortOrder;
        if (dto.isActive !== undefined) module.isActive = dto.isActive;
        if (dto.handlingTeams !== undefined) module.handlingTeams = dto.handlingTeams;
        if (dto.categories !== undefined) module.categories = dto.categories;
        if (dto.ticketTypes !== undefined) module.ticketTypes = dto.ticketTypes;
        if (dto.allowedRoles !== undefined) module.allowedRoles = dto.allowedRoles;
        if (dto.assigneeRoles !== undefined) module.assigneeRoles = dto.assigneeRoles;
        if (dto.assigneeUserIds !== undefined) module.assigneeUserIds = dto.assigneeUserIds;
        if (dto.autoAssignEnabled !== undefined) module.autoAssignEnabled = dto.autoAssignEnabled;

        const updated = await this.moduleRepo.save(module);
        this.logger.log(`Updated ticket module: ${updated.name} (${updated.slug})`);
        return updated;
    }

    /**
     * Delete a ticket module (only non-system modules)
     */
    async delete(id: string): Promise<{ success: boolean; message: string }> {
        const module = await this.findById(id);
        if (module.isSystem) {
            throw new BadRequestException('System ticket modules cannot be deleted. You can disable them instead.');
        }

        await this.moduleRepo.remove(module);
        this.logger.log(`Deleted custom ticket module: ${module.name} (${module.slug})`);
        return { success: true, message: `Ticket module "${module.name}" deleted successfully` };
    }

    /**
     * Reorder modules
     */
    async reorder(orderedIds: string[]): Promise<TicketModule[]> {
        for (let i = 0; i < orderedIds.length; i++) {
            await this.moduleRepo.update(orderedIds[i], { sortOrder: i + 1 });
        }
        return this.findAllForAdmin();
    }
}
