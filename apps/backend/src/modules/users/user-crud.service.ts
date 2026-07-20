import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as fs from 'fs';
import { User } from './entities/user.entity';
import { UserRole } from './enums/user-role.enum';
import { CreateAgentDto } from './dto/create-agent.dto';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';
import { BCRYPT_ROUNDS } from '../../shared/core/config/security.config';
import * as crypto from 'crypto';

import { MailerService } from '@nestjs-modules/mailer';
import { Ticket, TicketStatus } from '../ticketing/entities/ticket.entity';
import { Site } from '../sites/entities/site.entity';
import { Department } from './entities/department.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { PermissionsService } from '../permissions/permissions.service';

const OPERATIONAL_AGENT_ROLES = [
    UserRole.AGENT,
    UserRole.ADMIN,
    UserRole.AGENT_OPERATIONAL_SUPPORT,
];

@Injectable()
export class UserCrudService {
    private readonly logger = new Logger(UserCrudService.name);

    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(Ticket)
        private readonly ticketRepo: Repository<Ticket>,
        @InjectRepository(Site)
        private readonly siteRepo: Repository<Site>,
        @InjectRepository(Department)
        private readonly departmentRepo: Repository<Department>,
        private readonly mailerService: MailerService,
        private readonly auditService: AuditService,
        private readonly permissionsService: PermissionsService,
    ) { }

    async createAgent(dto: CreateAgentDto, createdByUserId?: string): Promise<User> {
        const existingUser = await this.userRepo.findOne({ where: { email: dto.email } });
        if (existingUser) {
            throw new ConflictException('Email already exists');
        }

        const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
        const user = this.userRepo.create({
            ...dto,
            password: hashedPassword,
            role: UserRole.AGENT,
        });
        const savedUser = await this.userRepo.save(user);

        // Audit log for agent creation
        this.auditService.logAsync({
            userId: createdByUserId || 'system',
            action: AuditAction.USER_CREATE,
            entityType: 'user',
            entityId: savedUser.id,
            newValue: { email: savedUser.email, fullName: savedUser.fullName, role: savedUser.role },
            description: `Agent ${savedUser.fullName} created`,
        });

        return savedUser;
    }

    async findAll(options: {
        page?: number;
        limit?: number;
        search?: string;
        siteCode?: string;
        role?: string;
        sortBy?: string;
        sortOrder?: 'ASC' | 'DESC';
    } = {}) {
        const {
            page = 1,
            limit = 20,
            search,
            siteCode,
            role,
            sortBy = 'fullName',
            sortOrder = 'ASC',
        } = options;

        const qb = this.userRepo
            .createQueryBuilder('user')
            .leftJoinAndSelect('user.department', 'department')
            .leftJoinAndSelect('user.site', 'site');

        // Search filter
        if (search) {
            qb.andWhere(
                '(user.fullName ILIKE :search OR user.email ILIKE :search)',
                { search: `%${search}%` }
            );
        }

        // Site filter
        if (siteCode && siteCode !== 'ALL') {
            qb.andWhere('site.code = :siteCode', { siteCode });
        }

        // Role filter
        if (role) {
            qb.andWhere('user.role = :role', { role });
        }

        // Exclude soft-deleted users (email starts with 'deleted_')
        qb.andWhere("user.email NOT LIKE :deletedPrefix", { deletedPrefix: 'deleted_%' });


        // P1 perf: getCount() + getMany() → getManyAndCount() — single round-trip.
        // Trim relations to id-only lookup so the count doesn't drag in joins.
        const validSortFields = ['fullName', 'email', 'createdAt', 'role'];
        const actualSortBy = validSortFields.includes(sortBy) ? sortBy : 'fullName';
        qb.orderBy(`user.${actualSortBy}`, sortOrder);

        const skip = (page - 1) * limit;
        qb.skip(skip).take(limit);

        const [data, total] = await qb.getManyAndCount();
        const totalPages = Math.ceil(total / limit);

        return {
            data,
            meta: {
                total,
                page,
                limit,
                totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1,
            },
        };
    }

    async update(userId: string, updateData: Partial<User>): Promise<User> {
        await this.userRepo.update(userId, updateData);
        const updatedUser = await this.userRepo.findOne({ where: { id: userId }, relations: ['department'] });
        if (!updatedUser) {
            throw new NotFoundException('User not found');
        }
        return updatedUser;
    }

    async updateRole(userId: string, role: UserRole): Promise<User> {
        await this.userRepo.update(userId, { role });
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException('User not found');
        }
        return user;
    }

    async createUser(dto: CreateUserDto, createdByUserId?: string): Promise<User> {
        const existingUser = await this.userRepo.findOne({ where: { email: dto.email } });
        if (existingUser) {
            throw new ConflictException('Email already exists');
        }

        let password = dto.password;
        if (dto.autoGeneratePassword || !password) {
            password = crypto.randomBytes(8).toString('hex') + 'A1!';
        }

        const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

        const user = this.userRepo.create({
            email: dto.email,
            fullName: dto.fullName,
            role: dto.role,
            password: hashedPassword,
            departmentId: dto.departmentId,
            siteId: dto.siteId, // P3: Site support
            appliedPresetId: dto.presetId, // P3: Map to entity's appliedPresetId
        });

        const savedUser = await this.userRepo.save(user);

        // Audit log for user creation
        this.auditService.logAsync({
            userId: createdByUserId || 'system',
            action: AuditAction.USER_CREATE,
            entityType: 'user',
            entityId: savedUser.id,
            newValue: { email: savedUser.email, fullName: savedUser.fullName, role: savedUser.role },
            description: `User ${savedUser.fullName} created`,
        });

        // Send Welcome Email
        try {
            await this.mailerService.sendMail({
                to: savedUser.email,
                subject: 'Welcome to iDesk Helpdesk',
                template: 'welcome-user',
                context: {
                    name: savedUser.fullName,
                    email: savedUser.email,
                    password: password,
                },
            });
        } catch (error) {
            this.logger.warn(`Failed to send welcome email to ${savedUser.email}: ${error.message}`);
        }

        return savedUser;
    }

    async updateAvatar(userId: string, avatarUrl: string, filePath: string): Promise<User> {
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Delete old avatar if it exists and is a local file (starts with /uploads/)
        if (user.avatarUrl && user.avatarUrl.startsWith('/uploads/')) {
            const oldFilePath = `.${user.avatarUrl}`; // Convert /uploads/xyz.jpg to ./uploads/xyz.jpg
            if (fs.existsSync(oldFilePath)) {
                try {
                    await fs.promises.unlink(oldFilePath);
                } catch (err) {
                    this.logger.warn(`Failed to delete old avatar: ${err.message}`);
                }
            }
        }

        user.avatarUrl = avatarUrl;
        return this.userRepo.save(user);
    }

    async findById(id: string): Promise<User | undefined> {
        const user = await this.userRepo.findOne({ where: { id }, relations: ['department'] });
        return user || undefined;
    }

    async findByEmail(email: string): Promise<User | undefined> {
        const user = await this.userRepo.findOne({ where: { email } });
        return user || undefined;
    }

    async findByEmployeeId(employeeId: string): Promise<User | undefined> {
        const user = await this.userRepo.findOne({ where: { employeeId } });
        return user || undefined;
    }

    async getAgents(siteId?: string): Promise<User[]> {
        const qb = this.userRepo
            .createQueryBuilder('user')
            .leftJoinAndSelect('user.site', 'site')
            .where('user.isActive = :isActive', { isActive: true })
            .andWhere('user.role IN (:...roles)', {
                roles: OPERATIONAL_AGENT_ROLES,
            })
            .select([
                'user.id', 'user.fullName', 'user.email', 'user.role',
                'user.avatarUrl', 'user.siteId', 'user.appraisalPoints',
                'site.id', 'site.code', 'site.name',
            ])
            .orderBy('user.fullName', 'ASC');

        if (siteId) {
            qb.andWhere('user.siteId = :siteId', { siteId });
        }

        return qb.getMany();
    }

    async getAllUsers(): Promise<User[]> {
        return this.userRepo.find({
            select: ['id', 'fullName', 'email', 'role', 'isActive', 'siteId', 'departmentId'],
            order: { fullName: 'ASC' },
            relations: ['department', 'site'],
        });
    }

    async getApprovers(excludeId?: string): Promise<User[]> {
        const qb = this.userRepo
            .createQueryBuilder('user')
            .leftJoinAndSelect('user.department', 'department')
            .where('user.isActive = :active', { active: true })
            .orderBy('user.fullName', 'ASC');

        if (excludeId) {
            qb.andWhere('user.id != :excludeId', { excludeId });
        }

        return qb.getMany();
    }

    async deleteUser(userId: string, adminId: string): Promise<{ success: boolean; message: string }> {
        this.logger.log(`Request to HARD DELETE user: ${userId} by admin ${adminId}`);
        // Prevent deleting self
        if (userId === adminId) {
            throw new BadRequestException('Cannot delete your own account');
        }

        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        try {
            // HARD DELETE
            await this.userRepo.delete(userId);
        } catch (error) {
            if (error.code === '23503') { // PostgreSQL FK violation
                throw new BadRequestException(`Cannot delete user ${user.fullName}: they have associated records. Deactivate the user instead.`);
            }
            throw error;
        }

        // Audit log AFTER successful delete
        this.auditService.logAsync({
            userId: adminId,
            action: AuditAction.USER_DELETE,
            entityType: 'user',
            entityId: userId,
            oldValue: { email: user.email, fullName: user.fullName, role: user.role },
            description: `User ${user.fullName} permanently deleted`,
        });

        return { success: true, message: `User deleted completely` };
    }

    async getAgentStats(): Promise<any> {
        const agents = await this.userRepo
            .createQueryBuilder('user')
            .leftJoinAndSelect('user.department', 'department')
            .leftJoinAndSelect('user.site', 'site')
            .where('user.role IN (:...roles)', { roles: [UserRole.ADMIN, UserRole.AGENT] })
            .andWhere('user.isActive = :isActive', { isActive: true })
            .andWhere("user.email NOT LIKE :deletedPrefix", { deletedPrefix: 'deleted_%' })
            .select(['user.id', 'user.fullName', 'user.email', 'user.role', 'user.avatarUrl', 'user.siteId', 'user.appraisalPoints'])
            .addSelect(['department.id', 'department.name', 'site.id', 'site.code', 'site.name'])
            .getMany();

        if (agents.length === 0) {
            return {
                summary: {
                    totalAgents: 0,
                    onlineAgents: 0,
                    totalResolvedThisMonth: 0,
                    avgTicketsPerAgent: 0,
                    topPerformer: null,
                },
                agents: [],
            };
        }

        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);

        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const agentIds = agents.map(a => a.id);

        // OPTIMIZED: Single query for all ticket stats grouped by agent
        const ticketStatsRaw = await this.ticketRepo
            .createQueryBuilder('ticket')
            .select('ticket."assignedToId"', 'agentId')
            .addSelect(`COUNT(*) FILTER (WHERE ticket.status = '${TicketStatus.TODO}')`, 'openTickets')
            .addSelect(`COUNT(*) FILTER (WHERE ticket.status = '${TicketStatus.IN_PROGRESS}')`, 'inProgressTickets')
            .addSelect(`COUNT(*) FILTER (WHERE ticket.status = '${TicketStatus.RESOLVED}')`, 'resolvedTotal')
            .addSelect(`COUNT(*) FILTER (WHERE ticket.status = '${TicketStatus.RESOLVED}' AND ticket."updatedAt" >= :startOfWeek)`, 'resolvedThisWeek')
            .addSelect(`COUNT(*) FILTER (WHERE ticket.status = '${TicketStatus.RESOLVED}' AND ticket."updatedAt" >= :startOfMonth)`, 'resolvedThisMonth')
            .where('ticket."assignedToId" IN (:...agentIds)', { agentIds })
            .setParameter('startOfWeek', startOfWeek)
            .setParameter('startOfMonth', startOfMonth)
            .groupBy('ticket."assignedToId"')
            .getRawMany();

        // OPTIMIZED: Single query for all SLA stats grouped by agent
        const slaStatsRaw = await this.ticketRepo
            .createQueryBuilder('ticket')
            .select('ticket."assignedToId"', 'agentId')
            .addSelect('COUNT(*)', 'totalWithSla')
            .addSelect(`COUNT(*) FILTER (WHERE ticket."isOverdue" = false OR ticket.status = '${TicketStatus.RESOLVED}')`, 'withinSla')
            .where('ticket."assignedToId" IN (:...agentIds)', { agentIds })
            .andWhere('ticket."slaTarget" IS NOT NULL')
            .groupBy('ticket."assignedToId"')
            .getRawMany();

        // Create lookup maps for O(1) access
        const ticketStatsMap = new Map<string, any>();
        for (const stat of ticketStatsRaw) {
            ticketStatsMap.set(stat.agentId, stat);
        }

        const slaStatsMap = new Map<string, any>();
        for (const stat of slaStatsRaw) {
            slaStatsMap.set(stat.agentId, stat);
        }

        // Fetch today's workload points
        const todayStr = now.toISOString().split('T')[0];
        const workloadRaw = await this.userRepo.manager
            .createQueryBuilder()
            .select('workload."agentId"', 'agentId')
            .addSelect('workload."totalPoints"', 'activeWorkloadPoints')
            .from('agent_daily_workload', 'workload')
            .where('workload."workDate" = :date', { date: todayStr })
            .andWhere('workload."agentId" IN (:...agentIds)', { agentIds })
            .getRawMany();

        const workloadMap = new Map<string, any>();
        for (const stat of workloadRaw) {
            workloadMap.set(stat.agentId, stat);
        }

        // Merge agent data with stats (in memory - O(n))
        const agentStats = agents.map(agent => {
            const stats = ticketStatsMap.get(agent.id) || {};
            const slaStats = slaStatsMap.get(agent.id) || {};

            const totalWithSla = parseInt(slaStats.totalWithSla || '0');
            const withinSla = parseInt(slaStats.withinSla || '0');
            const slaCompliance = totalWithSla > 0 ? Math.round((withinSla / totalWithSla) * 100) : 100;

            return {
                id: agent.id,
                fullName: agent.fullName,
                email: agent.email,
                role: agent.role,
                avatarUrl: agent.avatarUrl,
                department: agent.department?.name || null,
                site: agent.site || null,
                openTickets: parseInt(stats.openTickets || '0'),
                inProgressTickets: parseInt(stats.inProgressTickets || '0'),
                resolvedTotal: parseInt(stats.resolvedTotal || '0'),
                resolvedThisWeek: parseInt(stats.resolvedThisWeek || '0'),
                resolvedThisMonth: parseInt(stats.resolvedThisMonth || '0'),
                slaCompliance,
                appraisalPoints: agent.appraisalPoints || 0,
                activeWorkloadPoints: parseInt(workloadMap.get(agent.id)?._activeWorkloadPoints || workloadMap.get(agent.id)?.activeWorkloadPoints || '0'),
            };
        });

        // Calculate summary stats
        const totalAgents = agentStats.length;
        const onlineAgents = agentStats.length; // Placeholder - would need presence tracking
        const totalResolved = agentStats.reduce((sum, a) => sum + a.resolvedThisMonth, 0);
        const avgTicketsPerAgent = totalAgents > 0 ? Math.round(totalResolved / totalAgents) : 0;
        const topPerformer = [...agentStats].sort((a, b) => b.resolvedThisMonth - a.resolvedThisMonth)[0];

        return {
            summary: {
                totalAgents,
                onlineAgents,
                totalResolvedThisMonth: totalResolved,
                avgTicketsPerAgent,
                topPerformer: topPerformer?.fullName || null,
            },
            agents: agentStats,
        };
    }

    async updateUserByAdmin(userId: string, updateData: Partial<User>, adminId?: string): Promise<User> {
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        const oldValue = { email: user.email, fullName: user.fullName, role: user.role };

        // If email is being changed, check for duplicates
        if (updateData.email && updateData.email !== user.email) {
            const existingUser = await this.userRepo.findOne({ where: { email: updateData.email } });
            if (existingUser) {
                throw new ConflictException('Email already exists');
            }
        }

        // Check if role is changing
        const isRoleChange = updateData.role && updateData.role !== user.role;

        await this.userRepo.update(userId, updateData);
        const updatedUser = await this.userRepo.findOne({ where: { id: userId }, relations: ['department'] });
        if (!updatedUser) throw new Error('Failed to retrieve updated user');

        // Audit log for user update
        this.auditService.logAsync({
            userId: adminId || 'system',
            action: isRoleChange ? AuditAction.USER_ROLE_CHANGE : AuditAction.USER_UPDATE,
            entityType: 'user',
            entityId: userId,
            oldValue,
            newValue: { email: updatedUser.email, fullName: updatedUser.fullName, role: updatedUser.role },
            description: isRoleChange
                ? `Role changed for ${user.fullName}: ${user.role} → ${updatedUser.role}`
                : `User ${user.fullName} updated`,
        });

        return updatedUser;
    }

    async toggleUserStatus(userId: string, isActive: boolean, adminId?: string): Promise<{ success: boolean; message: string; user: User }> {
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        await this.userRepo.update(userId, { isActive });
        const updatedUser = await this.userRepo.findOne({ where: { id: userId }, relations: ['department'] });
        if (!updatedUser) throw new Error('Failed to retrieve updated user');

        // Audit log for status toggle
        this.auditService.logAsync({
            userId: adminId || 'system',
            action: AuditAction.USER_STATUS_TOGGLE,
            entityType: 'user',
            entityId: userId,
            oldValue: { isActive: user.isActive },
            newValue: { isActive },
            description: `User ${user.fullName} ${isActive ? 'activated' : 'deactivated'}`,
        });

        return {
            success: true,
            message: `User ${user.fullName} is now ${isActive ? 'active' : 'inactive'}`,
            user: updatedUser,
        };
    }

    async bulkDeleteUsers(userIds: string[], adminId: string): Promise<{ success: boolean; deleted: number; errors: string[] }> {
        const errors: string[] = [];
        let deleted = 0;

        // Filter out admin's own ID
        const idsToDelete = userIds.filter(id => id !== adminId);
        if (userIds.length !== idsToDelete.length) {
            errors.push('Cannot delete your own account');
        }

        if (idsToDelete.length > 0) {
            // Fetch users all at once to fix N+1 querying
            const users = await this.userRepo.find({ where: { id: In(idsToDelete) } });
            const userMap = new Map(users.map(u => [u.id, u]));
            const existingIds = users.map(u => u.id);

            if (existingIds.length > 0) {
                // P1 perf: was a per-id delete loop. Single DELETE ... WHERE id IN (...)
                // is 1 round-trip and lets PG plan a fast index scan.
                const { affected } = await this.userRepo.delete({ id: In(existingIds) });
                deleted = affected ?? 0;

                // Audit log per user (still per-user, but DB write is single-shot now)
                for (const user of users) {
                    this.auditService.logAsync({
                        userId: adminId,
                        action: AuditAction.USER_DELETE,
                        entityType: 'user',
                        entityId: user.id,
                        oldValue: { email: user.email, fullName: user.fullName, role: user.role },
                        description: `User ${user.fullName} permanently bulk deleted`,
                    });
                }
            }

            for (const userId of idsToDelete) {
                if (!userMap.has(userId)) {
                    errors.push(`User ${userId} not found`);
                }
            }
        }

        return { success: deleted > 0, deleted, errors };
    }

    async bulkUpdateStatus(userIds: string[], isActive: boolean): Promise<{ success: boolean; updated: number }> {
        const result = await this.userRepo.update(
            { id: In(userIds) },
            { isActive }
        );

        return {
            success: true,
            updated: result.affected || 0,
        };
    }

    async getTechnicians(): Promise<Array<{ id: string; fullName: string }>> {
        const users = await this.permissionsService.listUsersWithRole('ICT_STAFF');
        return users.map((u) => ({ id: u.id, fullName: u.fullName }));
    }
}
