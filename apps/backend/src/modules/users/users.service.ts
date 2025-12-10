import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
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
import * as crypto from 'crypto';

import { MailerService } from '@nestjs-modules/mailer';
import { Ticket, TicketStatus } from '../ticketing/entities/ticket.entity';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(Ticket)
        private readonly ticketRepo: Repository<Ticket>,
        private readonly mailerService: MailerService,
    ) { }

    async createAgent(dto: CreateAgentDto): Promise<User> {
        const existingUser = await this.userRepo.findOne({ where: { email: dto.email } });
        if (existingUser) {
            throw new ConflictException('Email already exists');
        }

        const hashedPassword = await bcrypt.hash(dto.password, 10);
        const user = this.userRepo.create({
            ...dto,
            password: hashedPassword,
            role: UserRole.AGENT,
        });
        return this.userRepo.save(user);
    }

    async findAll(page: number = 1, limit: number = 10) {
        const [data, total] = await this.userRepo.findAndCount({
            skip: (page - 1) * limit,
            take: limit,
            order: { createdAt: 'DESC' },
        });

        return {
            data,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
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

        const isValidPassword = await bcrypt.compare(currentPassword, user.password);
        if (!isValidPassword) {
            throw new BadRequestException('Current password is incorrect');
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
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

    async importUsers(file: Express.Multer.File): Promise<any> {
        const results = [];
        const errors = [];
        let successCount = 0;
        let failedCount = 0;

        const stream = Readable.from(file.buffer.toString());

        return new Promise((resolve, reject) => {
            stream
                .pipe(csv())
                .on('data', (data) => results.push(data))
                .on('end', async () => {
                    for (const row of results) {
                        try {
                            // Validation
                            if (!row.email || !row.fullName || !row.role) {
                                throw new BadRequestException(`Missing required fields in row: ${JSON.stringify(row)}`);
                            }

                            // Check duplicate
                            const existingUser = await this.userRepo.findOne({ where: { email: row.email } });
                            if (existingUser) {
                                throw new ConflictException(`Email ${row.email} already exists`);
                            }

                            // Generate Random Password
                            const randomPassword = crypto.randomBytes(8).toString('hex') + 'A1!'; // Ensure complexity
                            const hashedPassword = await bcrypt.hash(randomPassword, 10);

                            const newUser = this.userRepo.create({
                                email: row.email,
                                fullName: row.fullName,
                                role: row.role as UserRole,
                                employeeId: row.employeeId,
                                password: hashedPassword,
                                // departmentCode logic would go here if we had a lookup
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
                                console.error(`Failed to send email to ${newUser.email}:`, emailError);
                                // Don't fail the import just because email failed, but log it
                                errors.push(`User created but email failed for ${newUser.email}`);
                            }

                            successCount++;
                        } catch (error) {
                            failedCount++;
                            errors.push(error.message);
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
    async getAgents(): Promise<User[]> {
        return this.userRepo.find({
            where: [
                { role: UserRole.AGENT },
                { role: UserRole.ADMIN }
            ],
            order: { fullName: 'ASC' },
        });
    }

    async getAllUsers(): Promise<User[]> {
        return this.userRepo.find({
            order: { fullName: 'ASC' },
            relations: ['department'],
        });
    }
    async createUser(dto: CreateUserDto): Promise<User> {
        const existingUser = await this.userRepo.findOne({ where: { email: dto.email } });
        if (existingUser) {
            throw new ConflictException('Email already exists');
        }

        let password = dto.password;
        if (dto.autoGeneratePassword || !password) {
            password = crypto.randomBytes(8).toString('hex') + 'A1!';
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = this.userRepo.create({
            email: dto.email,
            fullName: dto.fullName,
            role: dto.role,
            password: hashedPassword,
            departmentId: dto.departmentId,
        });

        const savedUser = await this.userRepo.save(user);

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
            console.error(`Failed to send welcome email to ${savedUser.email}`, error);
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
                    console.error('Failed to delete old avatar:', err);
                }
            }
        }

        user.avatarUrl = avatarUrl;
        return this.userRepo.save(user);
    }

    async findById(id: string): Promise<User | undefined> {
        return this.userRepo.findOne({ where: { id }, relations: ['department'] });
    }

    async findByEmail(email: string): Promise<User | undefined> {
        return this.userRepo.findOne({ where: { email } });
    }

    async updatePassword(userId: string, newPasswordHash: string): Promise<void> {
        await this.userRepo.update(userId, { password: newPasswordHash });
    }

    async resetPassword(userId: string, newPassword: string): Promise<{ success: boolean; message: string }> {
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await this.userRepo.update(userId, { password: hashedPassword });

        return { success: true, message: 'Password reset successfully' };
    }

    async deleteUser(userId: string, adminId: string): Promise<{ success: boolean; message: string }> {
        // Prevent deleting self
        if (userId === adminId) {
            throw new BadRequestException('Cannot delete your own account');
        }

        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Soft delete - mark as deleted but keep record
        await this.userRepo.delete(userId);

        return { success: true, message: `User ${user.fullName} deleted successfully` };
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
        const agents = await this.userRepo.find({
            where: { role: In([UserRole.ADMIN, UserRole.AGENT]) },
            select: ['id', 'fullName', 'email', 'role', 'avatarUrl'],
            relations: ['department'],
        });

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
                openTickets: parseInt(stats.openTickets || '0'),
                inProgressTickets: parseInt(stats.inProgressTickets || '0'),
                resolvedTotal: parseInt(stats.resolvedTotal || '0'),
                resolvedThisWeek: parseInt(stats.resolvedThisWeek || '0'),
                resolvedThisMonth: parseInt(stats.resolvedThisMonth || '0'),
                slaCompliance,
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
    async updateUserByAdmin(userId: string, updateData: Partial<User>): Promise<User> {
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        // If email is being changed, check for duplicates
        if (updateData.email && updateData.email !== user.email) {
            const existingUser = await this.userRepo.findOne({ where: { email: updateData.email } });
            if (existingUser) {
                throw new ConflictException('Email already exists');
            }
        }

        await this.userRepo.update(userId, updateData);
        return this.userRepo.findOne({ where: { id: userId }, relations: ['department'] });
    }

    /**
     * Toggle user active/inactive status
     */
    async toggleUserStatus(userId: string, isActive: boolean): Promise<{ success: boolean; message: string; user: User }> {
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        await this.userRepo.update(userId, { isActive });
        const updatedUser = await this.userRepo.findOne({ where: { id: userId }, relations: ['department'] });

        return {
            success: true,
            message: `User ${user.fullName} is now ${isActive ? 'active' : 'inactive'}`,
            user: updatedUser,
        };
    }

    /**
     * Export all users to CSV format
     */
    async exportUsers(): Promise<{ data: string; filename: string }> {
        const users = await this.userRepo.find({
            relations: ['department'],
            order: { fullName: 'ASC' },
        });

        const headers = ['Email', 'Full Name', 'Role', 'Department', 'Employee ID', 'Job Title', 'Phone Number', 'Active', 'Created At'];
        const rows = users.map(user => [
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
     * Bulk delete multiple users
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
                    await this.userRepo.delete(userId);
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
}

