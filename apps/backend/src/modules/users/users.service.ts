import { Injectable } from '@nestjs/common';
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

import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        private readonly mailerService: MailerService,
    ) { }

    async createAgent(dto: CreateAgentDto): Promise<User> {
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
    async update(userId: string, updateData: any): Promise<User> {
        await this.userRepo.update(userId, updateData);
        return this.userRepo.findOne({ where: { id: userId }, relations: ['department'] });
    }

    async updateRole(userId: string, role: UserRole): Promise<User> {
        await this.userRepo.update(userId, { role });
        return this.userRepo.findOne({ where: { id: userId } });
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
                                throw new Error(`Missing required fields in row: ${JSON.stringify(row)}`);
                            }

                            // Check duplicate
                            const existingUser = await this.userRepo.findOne({ where: { email: row.email } });
                            if (existingUser) {
                                throw new Error(`Email ${row.email} already exists`);
                            }

                            // Create User
                            const hashedPassword = await bcrypt.hash('Helpdesk@2025', 10);
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
                                        password: 'Helpdesk@2025',
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
            where: { role: UserRole.AGENT },
            order: { fullName: 'ASC' },
        });
    }
    async createUser(dto: CreateUserDto): Promise<User> {
        const existingUser = await this.userRepo.findOne({ where: { email: dto.email } });
        if (existingUser) {
            throw new Error('Email already exists');
        }

        let password = dto.password;
        if (dto.autoGeneratePassword || !password) {
            password = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8); // Simple random password
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

        // Delete old avatar if it exists and is a local file (starts with /uploads/)
        if (user.avatarUrl && user.avatarUrl.startsWith('/uploads/')) {
            const oldFilePath = `.${user.avatarUrl}`; // Convert /uploads/xyz.jpg to ./uploads/xyz.jpg
            if (fs.existsSync(oldFilePath)) {
                try {
                    fs.unlinkSync(oldFilePath);
                } catch (err) {
                    console.error('Failed to delete old avatar:', err);
                }
            }
        }

        user.avatarUrl = avatarUrl;
        return this.userRepo.save(user);
    }

    async findByEmail(email: string): Promise<User | undefined> {
        return this.userRepo.findOne({ where: { email } });
    }
}
