import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as fs from 'fs';
import { User } from './entities/user.entity';
import { UserRole } from './enums/user-role.enum';
import { CreateAgentDto } from './dto/create-agent.dto';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';
import * as csv from 'csv-parser';
import { Readable } from 'stream';
import { BCRYPT_ROUNDS } from '../../shared/core/config/security.config';
import * as crypto from 'crypto';
import * as ExcelJS from 'exceljs';

import { MailerService } from '@nestjs-modules/mailer';
import { Ticket, TicketStatus } from '../ticketing/entities/ticket.entity';
import { Site } from '../sites/entities/site.entity';
import { Department } from './entities/department.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { PermissionsService } from '../permissions/permissions.service';

@Injectable()
export class UsersService {
    private readonly logger = new Logger(UsersService.name);

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


        // Get total count before pagination
        const total = await qb.getCount();

        // Sorting
        const validSortFields = ['fullName', 'email', 'createdAt', 'role'];
        const actualSortBy = validSortFields.includes(sortBy) ? sortBy : 'fullName';
        qb.orderBy(`user.${actualSortBy}`, sortOrder);

        // Pagination
        const skip = (page - 1) * limit;
        qb.skip(skip).take(limit);

        const data = await qb.getMany();
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

    async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ success: boolean }> {
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        if (!user.password) {
            throw new BadRequestException('User does not have a password set');
        }

        const isValidPassword = await bcrypt.compare(currentPassword, user.password);
        if (!isValidPassword) {
            throw new BadRequestException('Current password is incorrect');
        }

        const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
        await this.userRepo.update(userId, { password: hashedPassword });

        return { success: true };
    }

    async updateRole(userId: string, role: UserRole): Promise<User> {
        await this.userRepo.update(userId, { role });
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException('User not found');
        }
        return user;
    }

    async setCurrentRefreshToken(refreshToken: string, userId: string) {
        const hashedRefreshToken = await bcrypt.hash(refreshToken, BCRYPT_ROUNDS);
        await this.userRepo.update(userId, { hashedRefreshToken });
    }

    async removeRefreshToken(userId: string) {
        await this.userRepo.update(userId, { hashedRefreshToken: null as unknown as string });
    }

    async getUserIfRefreshTokenMatches(refreshToken: string, userId: string) {
        const user = await this.findById(userId);
        if (!user || !user.hashedRefreshToken) {
            return null;
        }
        const isRefreshTokenMatching = await bcrypt.compare(refreshToken, user.hashedRefreshToken);
        if (isRefreshTokenMatching) {
            return user;
        }
        return null;
    }

    /**
     * H1: Enhanced import with siteCode, jobTitle, phoneNumber fields
     * Format: email,fullName,role,siteCode,employeeId,jobTitle,phoneNumber,isActive
     */
    async importUsers(file: Express.Multer.File): Promise<any> {
        const results: any[] = [];
        const errors: string[] = [];
        let successCount = 0;
        let failedCount = 0;

        // Pre-load sites for lookup
        const sites = await this.siteRepo.find();
        const siteMap = new Map<string, Site>();
        sites.forEach(s => siteMap.set(s.code.toUpperCase(), s));

        // Pre-load departments for lookup
        const departments = await this.departmentRepo.find();
        const deptMap = new Map<string, Department>();
        departments.forEach(d => deptMap.set(d.code?.toUpperCase() || d.name.toUpperCase(), d));

        const stream = Readable.from(file.buffer.toString());

        return new Promise((resolve, reject) => {
            stream
                .pipe(csv())
                .on('data', (data) => {
                    // Skip comment rows (starting with #)
                    if (!data.email?.startsWith('#')) {
                        results.push(data);
                    }
                })
                .on('end', async () => {
                    for (const row of results) {
                        try {
                            // Validation - required fields
                            if (!row.email || !row.fullName || !row.role) {
                                throw new BadRequestException(`Missing required fields (email, fullName, role) in row: ${JSON.stringify(row)}`);
                            }

                            // Normalize role
                            const role = row.role.toUpperCase() as UserRole;
                            if (!Object.values(UserRole).includes(role)) {
                                throw new BadRequestException(`Invalid role: ${row.role}. Must be ADMIN, MANAGER, AGENT, or USER`);
                            }

                            // Check duplicate
                            const existingUser = await this.userRepo.findOne({ where: { email: row.email } });
                            if (existingUser) {
                                throw new ConflictException(`Email ${row.email} already exists`);
                            }

                            // Lookup site by code
                            let siteId: string | undefined;
                            if (row.siteCode) {
                                const site = siteMap.get(row.siteCode.toUpperCase());
                                if (site) {
                                    siteId = site.id;
                                } else {
                                    this.logger.warn(`Site code ${row.siteCode} not found for ${row.email}`);
                                }
                            }

                            // Lookup department by code
                            let departmentId: string | undefined;
                            if (row.departmentCode) {
                                const dept = deptMap.get(row.departmentCode.toUpperCase());
                                if (dept) {
                                    departmentId = dept.id;
                                } else {
                                    this.logger.warn(`Department code ${row.departmentCode} not found for ${row.email}`);
                                }
                            }

                            // Generate Random Password
                            const randomPassword = crypto.randomBytes(8).toString('hex') + 'A1!';
                            const hashedPassword = await bcrypt.hash(randomPassword, BCRYPT_ROUNDS);

                            // Normalize isActive (default true)
                            const isActive = row.isActive?.toLowerCase() === 'false' || row.isActive === '0' ? false : true;

                            const newUser = this.userRepo.create({
                                email: row.email.trim(),
                                fullName: row.fullName.trim(),
                                role,
                                employeeId: row.employeeId?.trim() || null,
                                jobTitle: row.jobTitle?.trim() || null,
                                phoneNumber: row.phoneNumber?.trim() || null,
                                siteId,
                                departmentId,
                                isActive,
                                password: hashedPassword,
                            });

                            await this.userRepo.save(newUser);

                            // Send Welcome Email
                            try {
                                await this.mailerService.sendMail({
                                    to: newUser.email,
                                    subject: 'Welcome to iDesk Helpdesk',
                                    template: 'welcome-user',
                                    context: {
                                        name: newUser.fullName,
                                        email: newUser.email,
                                        password: randomPassword,
                                    },
                                });
                            } catch (emailError) {
                                this.logger.warn(`Failed to send email to ${newUser.email}: ${emailError.message}`);
                                errors.push(`User created but email failed for ${newUser.email}`);
                            }

                            successCount++;
                        } catch (error) {
                            failedCount++;
                            errors.push(`Row ${row.email || 'unknown'}: ${error.message}`);
                        }
                    }
                    resolve({
                        success: successCount,
                        failed: failedCount,
                        errors,
                    });
                })
                .on('error', (error) => {
                    reject(error);
                });
        });
    }

    /**
     * H3: Generate import template CSV
     * Includes all available site codes: SPJ, SMG, KRW, JTB
     * Roles: USER, AGENT, MANAGER, ADMIN
     */
    generateImportTemplate(): { data: string; filename: string } {
        // Headers match the importUsers processing (P4: Added presetName)
        const headers = [
            'email',
            'fullName',
            'role',
            'siteCode',
            'departmentCode',
            'presetName', // P4: Permission preset name
            'employeeId',
            'jobTitle',
            'phoneNumber',
            'isActive'
        ];

        // Example rows showing all 4 roles and 4 sites (P4: Added preset examples)
        const exampleRows = [
            // USER role examples - different sites
            ['user1@example.com', 'John Doe', 'USER', 'SPJ', 'IT', 'User', 'EMP001', 'Staff', '+6281234567890', 'true'],
            ['user2@example.com', 'Jane Smith', 'USER', 'SMG', 'HR', 'User', 'EMP002', 'Employee', '', 'true'],
            ['user3@example.com', 'Bob Wilson', 'USER', 'KRW', 'FIN', 'User', 'EMP003', 'Clerk', '+6281122334455', 'true'],
            ['user4@example.com', 'Alice Brown', 'USER', 'JTB', 'OPS', 'User', 'EMP004', 'Assistant', '', 'true'],
            // AGENT role examples
            ['agent1@example.com', 'Charlie Agent', 'AGENT', 'SPJ', 'IT', 'Agent', 'AGT001', 'Support Agent', '+6281234500001', 'true'],
            ['agent2@example.com', 'Diana Support', 'AGENT', 'SMG', 'IT', 'Agent', 'AGT002', 'Helpdesk Agent', '+6281234500002', 'true'],
            // MANAGER role
            ['manager@example.com', 'Mike Manager', 'MANAGER', 'SPJ', 'IT', 'Manager', 'MGR001', 'IT Manager', '+6281234500003', 'true'],
            // ADMIN role
            ['admin@example.com', 'Admin User', 'ADMIN', 'SPJ', '', 'Admin', 'ADM001', 'System Admin', '+6287654321098', 'true'],
        ];

        // Add comment row explaining available options
        const commentRow = [
            '# Valid roles: USER,AGENT,MANAGER,ADMIN',
            '# Valid sites: SPJ,SMG,KRW,JTB',
            '# Presets: User,Agent,Manager,Admin (or custom preset names)',
            '# Departments: IT,HR,FIN,OPS,MKT,SALES',
            '', '', '', '', '', '', ''
        ];

        const csvContent = [
            '# Import Users Template - iDesk Helpdesk',
            '# Available Site Codes: SPJ (Surabaya Pusat), SMG (Semarang), KRW (Karawang), JTB (Jakarta Barat)',
            '# Available Roles: USER, AGENT, MANAGER, ADMIN',
            '# Available Presets: User, Agent, Manager, Admin (or any custom preset name)',
            '# Departments are optional - leave blank if not applicable',
            headers.join(','),
            ...exampleRows.map(row => row.map(cell => `"${cell}"`).join(',')),
        ].join('\n');

        return {
            data: csvContent,
            filename: 'import-users-template.csv',
        };
    }

    // Old methods removed to prevent duplication

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

    async updatePassword(userId: string, newPasswordHash: string): Promise<void> {
        await this.userRepo.update(userId, { password: newPasswordHash });
    }

    async resetPassword(userId: string, newPassword: string, adminId?: string): Promise<{ success: boolean; message: string }> {
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
        await this.userRepo.update(userId, { password: hashedPassword });

        // Audit log for password reset
        this.auditService.logAsync({
            userId: adminId || 'system',
            action: AuditAction.PASSWORD_RESET,
            entityType: 'user',
            entityId: userId,
            description: `Password reset for ${user.fullName} by admin`,
        });

        return { success: true, message: 'Password reset successfully' };
    }

    async getAgents(): Promise<User[]> {
        return this.userRepo.find({
            where: [
                { role: UserRole.AGENT, isActive: true },
                { role: UserRole.ADMIN, isActive: true }
            ],
            order: { fullName: 'ASC' },
        });
    }

    async getAllUsers(): Promise<User[]> {
        return this.userRepo.find({
            order: { fullName: 'ASC' },
            relations: ['department', 'site'],
        });
    }

    async getApprovers(): Promise<User[]> {
        return this.userRepo.find({
            where: [
                { role: UserRole.MANAGER, isActive: true },
                { role: UserRole.ADMIN, isActive: true }
            ],
            order: { fullName: 'ASC' },
            relations: ['department'],
        });
    }
    // ... (keep createUser as is, I am not touching it, but I need to match the start line correctly) ...
    // Wait, replace_file_content targets a block. I will target deleteUser specifically first.

    // Actually, I will just target deleteUser. I will do getAgents separately to keep it clean or combine if close.
    // They are far apart (362 vs 486). I will do deleteUser first.

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

        // Audit log
        this.auditService.logAsync({
            userId: adminId,
            action: AuditAction.USER_DELETE,
            entityType: 'user',
            entityId: userId,
            oldValue: { email: user.email, fullName: user.fullName, role: user.role },
            description: `User ${user.fullName} permanently deleted`,
        });

        // HARD DELETE
        await this.userRepo.delete(userId);

        return { success: true, message: `User deleted completely` };
    }

    /**
     * Get agent performance statistics computed on the server side
     * Returns ticket counts for each agent
     * 
     * OPTIMIZED: Uses 2 GROUP BY queries instead of N+1 queries
     * Before: 20+ queries for 10 agents
     * After: 3 queries total (agents + stats + sla)
     */
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

    /**
     * Update user by admin - allows changing email, role, department, etc.
     */
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

    /**
     * Toggle user active/inactive status
     */
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

    /**
     * H2: Export users to CSV format - RE-IMPORTABLE format
     * Headers match import template for round-trip compatibility
     */
    async exportUsers(): Promise<{ data: string; filename: string }> {
        const users = await this.userRepo.find({
            relations: ['department', 'site'],
            order: { fullName: 'ASC' },
            where: {
                email: require('typeorm').Not(require('typeorm').Like('deleted_%'))
            }
        });

        // H2: Headers now match import format for re-importability
        const headers = ['email', 'fullName', 'role', 'siteCode', 'employeeId', 'jobTitle', 'phoneNumber', 'isActive'];
        const rows = users.map(user => [
            user.email,
            user.fullName,
            user.role,
            user.site?.code || '',
            user.employeeId || '',
            user.jobTitle || '',
            user.phoneNumber || '',
            user.isActive ? 'true' : 'false',
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
        ].join('\n');

        return {
            data: csvContent,
            filename: `users-export-${new Date().toISOString().split('T')[0]}.csv`,
        };
    }

    /**
     * Export users to XLSX format with separate sheets per site
     */
    async exportUsersXlsx(siteFilter: string = 'ALL'): Promise<Buffer> {
        const users = await this.userRepo.find({
            relations: ['department', 'site'],
            order: { fullName: 'ASC' },
            where: {
                email: require('typeorm').Not(require('typeorm').Like('deleted_%'))
            }
        });

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'iDesk System';
        workbook.created = new Date();

        const SITES = ['SPJ', 'SMG', 'KRW', 'JTB'];
        const headers = ['Email', 'Full Name', 'Role', 'Department', 'Employee ID', 'Job Title', 'Phone Number', 'Active', 'Created At'];

        const headerStyle = {
            font: { bold: true, color: { argb: 'FFFFFFFF' } },
            fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF2563EB' } },
            alignment: { horizontal: 'center' as const },
        };

        const sitesToExport = siteFilter === 'ALL' ? SITES : [siteFilter];

        for (const siteCode of sitesToExport) {
            const siteUsers = users.filter(u => u.site?.code === siteCode);
            const sheet = workbook.addWorksheet(siteCode);

            // Add headers
            const headerRow = sheet.addRow(headers);
            headerRow.eachCell((cell) => {
                cell.font = headerStyle.font;
                cell.fill = headerStyle.fill;
                cell.alignment = headerStyle.alignment;
            });

            // Add data
            for (const user of siteUsers) {
                sheet.addRow([
                    user.email,
                    user.fullName,
                    user.role,
                    user.department?.name || '',
                    user.employeeId || '',
                    user.jobTitle || '',
                    user.phoneNumber || '',
                    user.isActive ? 'Yes' : 'No',
                    user.createdAt.toISOString().split('T')[0],
                ]);
            }

            // Auto-fit columns
            sheet.columns.forEach((column) => {
                column.width = 20;
            });
        }

        // Add Summary sheet if exporting all sites
        if (siteFilter === 'ALL') {
            const summarySheet = workbook.addWorksheet('Summary');
            const summaryHeaders = ['Site', 'Administrators', 'Agents', 'Users', 'Total'];

            const summaryHeaderRow = summarySheet.addRow(summaryHeaders);
            summaryHeaderRow.eachCell((cell) => {
                cell.font = headerStyle.font;
                cell.fill = headerStyle.fill;
                cell.alignment = headerStyle.alignment;
            });

            for (const siteCode of SITES) {
                const siteUsers = users.filter(u => u.site?.code === siteCode);
                const admins = siteUsers.filter(u => u.role === UserRole.ADMIN).length;
                const agents = siteUsers.filter(u => u.role === UserRole.AGENT).length;
                const usersCount = siteUsers.filter(u => u.role === UserRole.USER).length;
                summarySheet.addRow([siteCode, admins, agents, usersCount, siteUsers.length]);
            }

            summarySheet.columns.forEach((column) => {
                column.width = 15;
            });
        }

        return Buffer.from(await workbook.xlsx.writeBuffer());
    }

    /**
     * Bulk delete multiple users
     * Uses HARD DELETE as foreign key constraints are now properly managed
     */
    async bulkDeleteUsers(userIds: string[], adminId: string): Promise<{ success: boolean; deleted: number; errors: string[] }> {
        const errors: string[] = [];
        let deleted = 0;

        // Filter out admin's own ID
        const idsToDelete = userIds.filter(id => id !== adminId);
        if (userIds.length !== idsToDelete.length) {
            errors.push('Cannot delete your own account');
        }

        for (const userId of idsToDelete) {
            try {
                const user = await this.userRepo.findOne({ where: { id: userId } });
                if (user) {
                    // HARD DELETE
                    await this.userRepo.delete(userId);

                    // Audit log per user
                    this.auditService.logAsync({
                        userId: adminId,
                        action: AuditAction.USER_DELETE,
                        entityType: 'user',
                        entityId: userId,
                        oldValue: { email: user.email, fullName: user.fullName, role: user.role },
                        description: `User ${user.fullName} permanently bulk deleted`,
                    });

                    deleted++;
                } else {
                    errors.push(`User ${userId} not found`);
                }
            } catch (error) {
                errors.push(`Failed to delete user ${userId}: ${error.message}`);
            }
        }

        return { success: deleted > 0, deleted, errors };
    }

    /**
     * Bulk update status for multiple users
     */
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

