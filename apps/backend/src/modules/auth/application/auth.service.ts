import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from '../presentation/dto/register.dto';
import { ChangePasswordDto } from '../presentation/dto/change-password.dto';
import { UsersService } from '../../users/users.service';
import { AuditService } from '../../audit/audit.service';
import { AuditAction } from '../../audit/entities/audit-log.entity';
import * as bcrypt from 'bcrypt';
import { Request } from 'express';
import { BCRYPT_ROUNDS } from '../../../shared/core/config/security.config';

// Login validation result types
export interface LoginValidationResult {
    success: boolean;
    user?: any;
    errorCode?: 'USER_NOT_FOUND' | 'WRONG_PASSWORD' | 'ACCOUNT_DISABLED';
}

@Injectable()
export class AuthService {
    constructor(
        private jwtService: JwtService,
        private usersService: UsersService,
        private auditService: AuditService,
    ) { }

    async changePassword(userId: string, dto: ChangePasswordDto, request?: Request) {
        const user = await this.usersService.findById(userId);
        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        const isMatch = await bcrypt.compare(dto.currentPassword, user.password || '');
        if (!isMatch) {
            throw new BadRequestException('Current password is incorrect');
        }

        const newPasswordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
        await this.usersService.updatePassword(userId, newPasswordHash);

        // Audit log for password change
        this.auditService.logAsync({
            userId,
            action: AuditAction.PASSWORD_CHANGE,
            entityType: 'user',
            entityId: userId,
            description: `User ${user.fullName} changed their password`,
            request,
        });

        return { message: 'Password updated successfully' };
    }

    /**
     * Validate user credentials with specific error codes
     * Returns result object with error code instead of just null
     */
    async validateUserWithDetails(email: string, pass: string, request?: Request): Promise<LoginValidationResult> {
        const user = await this.usersService.findByEmail(email);

        // User not found
        if (!user) {
            // Log failed attempt (user not found)
            this.auditService.logAsync({
                userId: 'system',
                action: AuditAction.LOGIN_FAILED,
                entityType: 'auth',
                description: `Login failed: User not found for email ${email}`,
                newValue: { email, reason: 'USER_NOT_FOUND' },
                request,
            });

            return {
                success: false,
                errorCode: 'USER_NOT_FOUND',
            };
        }

        // Check if user is active (if such field exists)
        if ((user as any).isActive === false || (user as any).status === 'DISABLED') {
            // Log failed attempt (account disabled)
            this.auditService.logAsync({
                userId: user.id,
                action: AuditAction.LOGIN_FAILED,
                entityType: 'auth',
                entityId: user.id,
                description: `Login failed: Account disabled for ${user.fullName}`,
                newValue: { email, reason: 'ACCOUNT_DISABLED' },
                request,
            });

            return {
                success: false,
                errorCode: 'ACCOUNT_DISABLED',
            };
        }

        // Password check
        const isPasswordValid = await bcrypt.compare(pass, user.password || '');
        if (!isPasswordValid) {
            // Log failed attempt (wrong password)
            this.auditService.logAsync({
                userId: user.id,
                action: AuditAction.LOGIN_FAILED,
                entityType: 'auth',
                entityId: user.id,
                description: `Login failed: Wrong password for ${user.fullName}`,
                newValue: { email, reason: 'WRONG_PASSWORD' },
                request,
            });

            return {
                success: false,
                errorCode: 'WRONG_PASSWORD',
            };
        }

        // Success - return user without password
        const { password, ...result } = user;
        return {
            success: true,
            user: result,
        };
    }

    async validateUser(email: string, pass: string): Promise<any> {
        const user = await this.usersService.findByEmail(email);
        if (user && await bcrypt.compare(pass, user.password || '')) {
            const { password, ...result } = user;
            return result;
        }
        return null;
    }

    /**
     * Get JWT expiration time based on user role
     * Admin/Agent: 3 hours for extended work sessions
     * User: 1 hour for security purposes
     */
    private getExpirationByRole(role: string): string {
        return '15m'; // M4: 15m access token for all roles
    }

    async login(user: any, request?: Request) {
        const payload = { username: user.email, sub: user.id, role: user.role, type: 'access' };
        const refreshPayload = { username: user.email, sub: user.id, role: user.role, type: 'refresh' };
        const expiresIn = this.getExpirationByRole(user.role);
        const refreshExpiresIn = '7d';

        // M2: Update lastActiveAt on login
        await this.usersService.update(user.id, { lastActiveAt: new Date() });

        const access_token = this.jwtService.sign(payload, { expiresIn: expiresIn as `${number}${'s' | 'm' | 'h' | 'd'}` });
        const refresh_token = this.jwtService.sign(refreshPayload, { expiresIn: refreshExpiresIn as `${number}${'s' | 'm' | 'h' | 'd'}` });
        
        await this.usersService.setCurrentRefreshToken(refresh_token, user.id);

        // Audit log for successful login
        this.auditService.logAsync({
            userId: user.id,
            action: AuditAction.USER_LOGIN,
            entityType: 'auth',
            entityId: user.id,
            description: `User ${user.fullName} logged in`,
            newValue: { email: user.email, role: user.role },
            request,
        });

        return {
            access_token,
            refresh_token, // Added refresh token
            user: user,
            expiresIn, // Return expiration info to frontend
        };
    }

    async refreshToken(token: string, request?: Request) {
        try {
            const decoded = this.jwtService.verify(token);
            if (decoded.type !== 'refresh') throw new UnauthorizedException('Invalid token type');
            
            const user = await this.usersService.getUserIfRefreshTokenMatches(token, decoded.sub);
            if (!user) throw new UnauthorizedException('Invalid refresh token');

            // Rotate tokens by calling login again
            return this.login(user, request);
        } catch(e) {
            throw new UnauthorizedException('Refresh token is invalid or expired');
        }
    }

    async logout(user: any, request?: Request) {
        if (user && user.userId) {
            await this.usersService.removeRefreshToken(user.userId);
            this.auditService.logAsync({
                userId: user.userId,
                action: AuditAction.USER_LOGOUT,
                entityType: 'auth',
                entityId: user.userId,
                description: `User logged out`,
                request,
            });
        }
    }

    async register(registerDto: RegisterDto) {
        return this.usersService.createUser({
            ...registerDto,
            role: registerDto.role || 'USER',
        } as any);
    }
}

