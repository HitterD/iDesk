import { Injectable, UnauthorizedException, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { RegisterDto } from '../presentation/dto/register.dto';
import { ChangePasswordDto } from '../presentation/dto/change-password.dto';
import { UsersService } from '../../users/users.service';
import { AuditService } from '../../audit/audit.service';
import { AuditAction } from '../../audit/entities/audit-log.entity';
import * as bcrypt from 'bcrypt';
import { Request } from 'express';
import { BCRYPT_ROUNDS } from '../../../shared/core/config/security.config';
import { TokenService } from './token.service';
import { SessionService } from './session.service';
import { ValidatedUser } from './auth-user.types';
import { toValidatedUser } from './auth-user.mapper';
import { validatePasswordPolicy } from './password-policy';
import { CredentialValidatorService } from './credential-validator.service';
import { LoginValidationResult } from './auth-validation.types';

export type { LoginValidationResult } from './auth-validation.types';


@Injectable()
export class AuthService {
    constructor(
        private usersService: UsersService,
        private auditService: AuditService,
        private readonly tokenService: TokenService,
        private readonly sessionService: SessionService,
        private readonly credentialValidator: CredentialValidatorService,
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
        const passwordPolicy = validatePasswordPolicy(dto.newPassword, {
            email: user.email,
            fullName: user.fullName,
            nik: user.employeeId,
        });
        if (!passwordPolicy.valid) {
            throw new BadRequestException(`Password policy violation: ${passwordPolicy.reason}`);
        }

        const newPasswordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
        await this.usersService.updatePassword(userId, newPasswordHash);
        await this.usersService.update(userId, { mustChangePassword: false });

        // A changed password must not leave old refresh families usable. Synchronous:
        // if the store is unavailable the change fails rather than leaving live sessions.
        await this.sessionService.invalidateUser(userId);

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

    /** Validate credentials with one typed boundary for email and NIK identities. */
    async validateUserWithDetails(identifier: string, pass: string, request?: Request): Promise<LoginValidationResult> {
        return this.credentialValidator.validate(identifier, pass, request);
    }

    /** Compatibility surface for callers that only need a boolean credential check. */
    async validateUser(email: string, pass: string): Promise<ValidatedUser | null> {
        const user = await this.usersService.findByEmail(email);
        if (user && await bcrypt.compare(pass, user.password || '')) return toValidatedUser(user);
        return null;
    }

    async login(user: ValidatedUser, request?: Request, rememberMe = false, familyId?: string, parentId?: string) {
        await this.usersService.update(user.id, { lastActiveAt: new Date() });
        const tokens = this.tokenService.issueRefreshToken(user, familyId, parentId, rememberMe);
        await this.sessionService.persist(user, tokens);

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
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            user,
            expiresIn: tokens.expiresIn,
            refreshExpiresIn: tokens.refreshExpiresIn,
        };
    }

    async refreshToken(token: string, request?: Request) {
        try {
            const decoded = this.tokenService.verifyRefreshToken(token);
            const user = await this.sessionService.rotate(token, decoded);
            return this.login(
                toValidatedUser(user),
                request,
                decoded.rememberMe === true,
                decoded.familyId,
                decoded.tokenId,
            );
        } catch (error) {
            if (error instanceof UnauthorizedException) throw error;
            if (error instanceof ServiceUnavailableException) throw error;
            throw new UnauthorizedException('Refresh token is invalid or expired');
        }
    }

    async logout(user: { userId: string } | null | undefined, request?: Request) {
        if (user?.userId) {
            await this.sessionService.invalidateUser(user.userId);
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
            role: registerDto.role,
        });
    }
}

