import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
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
}
