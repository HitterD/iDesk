import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger, ForbiddenException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, SelectQueryBuilder } from 'typeorm';
import * as fs from 'fs';
import { User } from './entities/user.entity';
import { UserRole } from './enums/user-role.enum';
import { CreateAgentDto } from './dto/create-agent.dto';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';
import { BCRYPT_ROUNDS } from '../../shared/core/config/security.config';
import * as crypto from 'crypto';

import { MailDispatchService } from '../../shared/mail/mail-dispatch.service';
import { Ticket, TicketStatus } from '../ticketing/entities/ticket.entity';
import { TicketModule } from '../ticketing/entities/ticket-module.entity';
import { Site } from '../sites/entities/site.entity';
import { Department } from './entities/department.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { validatePasswordPolicy } from '../auth/application/password-policy';
import { PermissionsService } from '../permissions/permissions.service';
import { isMobileDevCategory, isWebDevCategory, isOracleDevCategory, isOracleK2Category } from '../ticketing/utils/oracle-ticket-access.util';

const OPERATIONAL_AGENT_ROLES = [
    UserRole.AGENT,
    UserRole.ADMIN,
    UserRole.AGENT_OPERATIONAL_SUPPORT,
];

const AGENT_STATS_ROLES = [
    UserRole.AGENT,
    UserRole.AGENT_ORACLE,
    UserRole.AGENT_ADMIN,
    UserRole.AGENT_OPERATIONAL_SUPPORT,
];

@Injectable()
export class UserCrudService implements OnModuleInit {
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
        private readonly mailDispatch: MailDispatchService,
        private readonly auditService: AuditService,
        private readonly permissionsService: PermissionsService,
        @InjectRepository(TicketModule)
        private readonly ticketModuleRepo?: Repository<TicketModule>,
    ) { }

    async onModuleInit() {
        try {
            await this.userRepo.query(`
                UPDATE "users" AS user_record
                SET
                    "appliedPresetId" = preset.id,
                    "appliedPresetName" = preset.name
                FROM "permission_presets" AS preset
                WHERE user_record."appliedPresetId" IS NULL
                  AND preset."isSystem" = true
                  AND preset."isActive" = true
                  AND (
                    (user_record.role = 'USER' AND preset.name = 'User') OR
                    (user_record.role = 'AGENT' AND preset.name = 'Agent') OR
                    (user_record.role = 'AGENT_ADMIN' AND preset.name = 'Agent') OR
                    (user_record.role = 'AGENT_OPERATIONAL_SUPPORT' AND preset.name = 'Agent Operational Support') OR
                    (user_record.role = 'AGENT_ORACLE' AND preset.name = 'Agent Oracle') OR
                    (user_record.role = 'MANAGER' AND preset.name = 'Manager') OR
                    (user_record.role = 'ADMIN' AND preset.name = 'Admin')
                  )
            `);
            this.logger.log('Backfilled default permission presets for users without appliedPresetId');
        } catch (err) {
            this.logger.warn(`Failed to backfill default permission presets: ${err.message}`);
        }
    }

    async createAgent(dto: CreateAgentDto, createdByUserId?: string): Promise<User> {
        const existingUser = await this.userRepo.findOne({ where: { email: dto.email } });
        if (existingUser) {
            throw new ConflictException('Email already exists');
        }

        const agentPolicy = validatePasswordPolicy(dto.password, { email: dto.email, fullName: dto.fullName });
        if (!agentPolicy.valid) {
            throw new BadRequestException(agentPolicy.message || `Password policy violation: ${agentPolicy.reason}`);
        }

        const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
        const user = this.userRepo.create({
            ...dto,
            password: hashedPassword,
            role: UserRole.AGENT,
            mustChangePassword: true,
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

    private applyUserListFilters(
        qb: SelectQueryBuilder<User>,
        options: { search?: string; siteCode?: string; role?: string },
        includeRole = true,
    ): void {
        if (options.search) {
            qb.andWhere('(user.fullName ILIKE :search OR user.email ILIKE :search)', {
                search: `%${options.search}%`,
            });
        }
        if (options.siteCode && options.siteCode !== 'ALL') {
            qb.andWhere('site.code = :siteCode', { siteCode: options.siteCode });
        }
        if (includeRole && options.role) {
            qb.andWhere('user.role = :role', { role: options.role });
        }
        qb.andWhere("user.email NOT LIKE :deletedPrefix", { deletedPrefix: 'deleted_%' });
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

        this.applyUserListFilters(qb, { search, siteCode, role });

        const validSortFields = ['fullName', 'email', 'createdAt', 'role'];
        const actualSortBy = validSortFields.includes(sortBy) ? sortBy : 'fullName';
        qb.orderBy(`user.${actualSortBy}`, sortOrder);

        const skip = (page - 1) * limit;
        qb.skip(skip).take(limit);

        const [data, total] = await qb.getManyAndCount();

        const roleCountsQb = this.userRepo
            .createQueryBuilder('user')
            .leftJoin('user.site', 'site');
        this.applyUserListFilters(roleCountsQb, { search, siteCode, role }, false);
        const rawRoleCounts = await roleCountsQb
            .select('user.role', 'role')
            .addSelect('COUNT(*)', 'count')
            .groupBy('user.role')
            .getRawMany<{ role: UserRole; count: string }>();
        const roleCounts = Object.fromEntries(
            rawRoleCounts.map(({ role: r, count }) => [r, Number.parseInt(count, 10)]),
        ) as Partial<Record<UserRole, number>>;

        const siteCountQb = this.userRepo
            .createQueryBuilder('user')
            .leftJoin('user.site', 'site');
        this.applyUserListFilters(siteCountQb, { search, siteCode: undefined, role });
        const rawSiteCounts = await siteCountQb
            .select('site.code', 'siteCode')
            .addSelect('COUNT(*)', 'count')
            .andWhere('site.code IS NOT NULL')
            .groupBy('site.code')
            .getRawMany<{ siteCode: string; count: string }>();
        const siteCounts = Object.fromEntries(
            rawSiteCounts.map(({ siteCode: sc, count }) => [sc, Number.parseInt(count, 10)]),
        );

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
                roleCounts,
                siteCounts,
            },
        };
    }

    async update(userId: string, updateData: any): Promise<User> {
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

        const isAutoGenerated = dto.autoGeneratePassword || !dto.password;
        let password: string;
        if (isAutoGenerated) {
            password = crypto.randomBytes(8).toString('hex') + 'A1!';
        } else {
            password = dto.password!;
            const createUserPolicy = validatePasswordPolicy(password, { email: dto.email, fullName: dto.fullName });
            if (!createUserPolicy.valid) {
                throw new BadRequestException(createUserPolicy.message || `Password policy violation: ${createUserPolicy.reason}`);
            }
        }

        const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

        const presetId = dto.presetId || (dto.role ? await this.permissionsService.resolveDefaultPresetId(dto.role) : null);

        const user = this.userRepo.create({
            email: dto.email,
            fullName: dto.fullName,
            role: dto.role,
            password: hashedPassword,
            departmentId: dto.departmentId,
            siteId: dto.siteId, // P3: Site support
            mustChangePassword: true,
        });

        let savedUser = await this.userRepo.save(user);

        if (presetId) {
            const { presetName } = await this.permissionsService.applyPresetToUser(savedUser.id, presetId);
            savedUser = { ...savedUser, appliedPresetId: presetId, appliedPresetName: presetName };
        }

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
            await this.mailDispatch.send({
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

    async getAgents(
        siteId?: string,
        callerRole?: UserRole,
        category?: string,
        ticketType?: string,
        explicitRoles?: UserRole[],
        moduleSlug?: string,
    ): Promise<User[]> {
        let roles: UserRole[] | undefined = explicitRoles && explicitRoles.length > 0 ? explicitRoles : undefined;
        let isDevContext = false;

        // If roles not explicitly passed, attempt to find matching TicketModule
        if (!roles && this.ticketModuleRepo) {
            try {
                let moduleRecord: TicketModule | null = null;
                if (moduleSlug) {
                    moduleRecord = await this.ticketModuleRepo.findOne({ where: { slug: moduleSlug, isActive: true } });
                }
                if (!moduleRecord && ticketType) {
                    moduleRecord = await this.ticketModuleRepo
                        .createQueryBuilder('m')
                        .where('m.isActive = true')
                        .andWhere(':ticketType = ANY(m.ticketTypes)', { ticketType })
                        .getOne();
                }
                if (!moduleRecord && category) {
                    moduleRecord = await this.ticketModuleRepo
                        .createQueryBuilder('m')
                        .where('m.isActive = true')
                        .andWhere(':category = ANY(m.categories)', { category })
                        .getOne();
                }
                if (moduleRecord && moduleRecord.assigneeRoles && moduleRecord.assigneeRoles.length > 0) {
                    roles = moduleRecord.assigneeRoles;
                }
            } catch (err) {
                this.logger.warn(`Failed to resolve assigneeRoles from TicketModule: ${err.message}`);
            }
        }

        if (roles && roles.length > 0) {
            isDevContext = roles.some((r) =>
                [UserRole.AGENT_ORACLE, UserRole.AGENT_WEB_DEV, UserRole.AGENT_MOBILE_DEV].includes(r)
            );
        } else if (
            callerRole === UserRole.AGENT_MOBILE_DEV ||
            callerRole === UserRole.AGENT_WEB_DEV ||
            callerRole === UserRole.AGENT_ORACLE ||
            isMobileDevCategory(category, ticketType) ||
            isWebDevCategory(category, ticketType) ||
            isOracleDevCategory(category, ticketType)
        ) {
            roles = [UserRole.AGENT_ORACLE, UserRole.AGENT_WEB_DEV, UserRole.AGENT_MOBILE_DEV, UserRole.ADMIN];
            isDevContext = true;
        } else {
            roles = [UserRole.AGENT, UserRole.ADMIN, UserRole.AGENT_OPERATIONAL_SUPPORT, UserRole.AGENT_ADMIN];
        }

        const qb = this.userRepo
            .createQueryBuilder('user')
            .leftJoinAndSelect('user.site', 'site')
            .where('user.isActive = :isActive', { isActive: true })
            .andWhere('user.role IN (:...roles)', { roles })
            .select([
                'user.id', 'user.fullName', 'user.email', 'user.role',
                'user.avatarUrl', 'user.siteId', 'user.appraisalPoints',
                'site.id', 'site.code', 'site.name',
            ])
            .orderBy('user.fullName', 'ASC');

        if (siteId && !isDevContext) {
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

    async getAgentStats(options: { search?: string; siteCode?: string; role?: string } = {}): Promise<any> {
        const agentQb = this.userRepo
            .createQueryBuilder('user')
            .leftJoinAndSelect('user.department', 'department')
            .leftJoinAndSelect('user.site', 'site')
            .andWhere('user.role IN (:...agentStatsRoles)', { agentStatsRoles: AGENT_STATS_ROLES });

        this.applyUserListFilters(agentQb, options);

        const agents = await agentQb
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

    async updateUserByAdmin(userId: string, updateData: any, adminId?: string): Promise<User> {
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        const oldValue = { email: user.email, fullName: user.fullName, role: user.role };

        // If email is being changed, check for duplicates
        const isEmailChange = updateData.email && updateData.email !== user.email;
        if (isEmailChange) {
            const existingUser = await this.userRepo.findOne({ where: { email: updateData.email } });
            if (existingUser) {
                throw new ConflictException('Email already exists');
            }
        }

        // Check if role is changing
        const isRoleChange = updateData.role && updateData.role !== user.role;

        // An admin correcting an email is as deliberate as the user doing it, so
        // it is stamped the same way and the HRIS sync / CSV import leave it be.
        await this.userRepo.update(userId, {
            ...updateData,
            ...(isEmailChange
                ? { emailOverriddenAt: new Date(), emailOverriddenBy: adminId ?? null }
                : {}),
        });
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

    async getTechnicians(siteId?: string | null): Promise<Array<{ id: string; fullName: string; role?: string; email?: string; avatarUrl?: string }>> {
        const query = this.userRepo.createQueryBuilder('user')
            .where('user.role = :role', { role: UserRole.AGENT_OPERATIONAL_SUPPORT })
            .andWhere('user.isActive = :isActive', { isActive: true });

        if (siteId) {
            query.andWhere('(user.siteId = :siteId OR user.siteId IS NULL)', { siteId });
        }

        const users = await query.orderBy('user.fullName', 'ASC').getMany();

        return users.map((u) => ({
            id: u.id,
            fullName: u.fullName,
            role: u.role,
            email: u.email,
            avatarUrl: u.avatarUrl,
        }));
    }
}
