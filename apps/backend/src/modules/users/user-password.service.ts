import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { UserRole } from './enums/user-role.enum';
import { BCRYPT_ROUNDS } from '../../shared/core/config/security.config';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';

@Injectable()
export class UserPasswordService {
    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        private readonly auditService: AuditService,
    ) {}

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

    async setCurrentRefreshToken(refreshToken: string, userId: string) {
        const hashedRefreshToken = await bcrypt.hash(refreshToken, BCRYPT_ROUNDS);
        await this.userRepo.update(userId, { hashedRefreshToken });
    }

    async removeRefreshToken(userId: string) {
        await this.userRepo.update(userId, { hashedRefreshToken: null as unknown as string });
    }

    async getUserIfRefreshTokenMatches(refreshToken: string, userId: string) {
        const user = await this.userRepo.findOne({ where: { id: userId }, relations: ['department'] });
        if (!user || !user.hashedRefreshToken) {
            return null;
        }
        const isRefreshTokenMatching = await bcrypt.compare(refreshToken, user.hashedRefreshToken);
        if (isRefreshTokenMatching) {
            return user;
        }
        return null;
    }

    async updatePassword(userId: string, newPasswordHash: string): Promise<void> {
        await this.userRepo.update(userId, { password: newPasswordHash });
    }

    async resetPassword(userId: string, newPassword: string, callerId?: string, callerRole?: string): Promise<{ success: boolean; message: string }> {
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        if (callerRole === UserRole.AGENT) {
            if (user.role === UserRole.ADMIN || user.role === UserRole.AGENT) {
                throw new ForbiddenException('Agents can only reset passwords for regular users');
            }
        }

        const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
        await this.userRepo.update(userId, { password: hashedPassword });

        // Audit log for password reset
        this.auditService.logAsync({
            userId: callerId || 'system',
            action: AuditAction.PASSWORD_RESET,
            entityType: 'user',
            entityId: userId,
            description: `Password reset for ${user.fullName} by admin`,
        });

        return { success: true, message: 'Password reset successfully' };
    }
}
