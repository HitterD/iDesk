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
import { HrisGatewayAdapter, HrisInvalidResponseError, HrisUnavailableError } from '../../hris-gateway/hris-gateway.adapter';
import { HrisSyncService } from '../../hris-gateway/hris-sync.service';
import { ValidatedUser } from './auth-user.types';
import { toValidatedUser } from './auth-user.mapper';
import { DUMMY_PASSWORD_HASH, verifyPassword } from './password-verifier';
import { validatePasswordPolicy } from './password-policy';
import { maskIdentifier } from '../../../shared/security/sensitive-data';

// Login validation result types
export interface LoginValidationResult {
    success: boolean;
    user?: ValidatedUser;
    errorCode?: 'USER_NOT_FOUND' | 'WRONG_PASSWORD' | 'ACCOUNT_DISABLED';
}

@Injectable()
export class AuthService {
    constructor(
        private usersService: UsersService,
        private auditService: AuditService,
        private hrisGateway: HrisGatewayAdapter,
        private hrisSync: HrisSyncService,
        private readonly tokenService: TokenService,
        private readonly sessionService: SessionService,
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

    /**
     * Validate user credentials with specific error codes
     * Returns result object with error code instead of just null
     */
    async validateUserWithDetails(identifier: string, pass: string, request?: Request): Promise<LoginValidationResult> {
        const normalizedIdentifier = identifier.trim();
        if (!normalizedIdentifier.includes('@')) {
            return this.validateNikUser(normalizedIdentifier, pass, request);
        }

        const email = normalizedIdentifier.toLowerCase();
        const user = await this.usersService.findByEmail(email);
        const isPasswordValid = await verifyPassword(pass, user?.password ?? DUMMY_PASSWORD_HASH);
        const maskedEmail = this.maskEmail(email);

        if (!user) {
            this.auditService.logAsync({
                userId: 'system',
                action: AuditAction.LOGIN_FAILED,
                entityType: 'auth',
                description: `Login failed: User not found for email ${maskedEmail}`,
                newValue: { email: maskedEmail, reason: 'USER_NOT_FOUND' },
                request,
            });

            return {
                success: false,
                errorCode: 'USER_NOT_FOUND',
            };
        }

        if (user.isActive === false) {
            this.auditService.logAsync({
                userId: user.id,
                action: AuditAction.LOGIN_FAILED,
                entityType: 'auth',
                entityId: user.id,
                description: `Login failed: Account disabled for ${user.fullName}`,
                newValue: { email: maskedEmail, reason: 'ACCOUNT_DISABLED' },
                request,
            });

            return {
                success: false,
                errorCode: 'ACCOUNT_DISABLED',
            };
        }

        if (!isPasswordValid) {
            this.auditService.logAsync({
                userId: user.id,
                action: AuditAction.LOGIN_FAILED,
                entityType: 'auth',
                entityId: user.id,
                description: `Login failed: Wrong password for ${user.fullName}`,
                newValue: { email: maskedEmail, reason: 'WRONG_PASSWORD' },
                request,
            });

            return {
                success: false,
                errorCode: 'WRONG_PASSWORD',
            };
        }

        return {
            success: true,
            user: toValidatedUser(user),
        };
    }

    private maskEmail(email: string): string {
        const [localPart, domain] = email.split('@');
        return `${localPart.slice(0, 1)}***@${domain?.slice(0, 1) ?? '*'}***`;
    }

    private async validateNikUser(nik: string, pass: string, request?: Request): Promise<LoginValidationResult> {
        let verification;
        try {
            verification = await this.hrisGateway.verifyPassword(nik, pass);
        } catch (error) {
            if (error instanceof HrisUnavailableError || error instanceof HrisInvalidResponseError) {
                return this.logNikFailure(nik, 'USER_NOT_FOUND', 'HRIS unavailable', request);
            }
            throw error;
        }

        if (!verification.valid) {
            return this.logNikFailure(nik, 'USER_NOT_FOUND', 'not found in HRIS', request);
        }
        if (!verification.eligible) {
            return this.logNikFailure(nik, 'ACCOUNT_DISABLED', 'not eligible in HRIS', request);
        }

        let user = await this.usersService.findByEmployeeId(nik);
        const authenticated = verification.match === true;
        if (!authenticated) {
            return this.logNikFailure(nik, user ? 'WRONG_PASSWORD' : 'USER_NOT_FOUND', 'password rejected', request, user?.id);
        }

        if (!user) {
            const employee = await this.hrisGateway.getEmployee(nik);
            if (!employee) {
                return this.logNikFailure(nik, 'USER_NOT_FOUND', 'profile unavailable for provisioning', request);
            }
            user = await this.hrisSync.provisionEmployee(employee);
        }

        if (user.isActive === false) {
            return this.logNikFailure(nik, 'ACCOUNT_DISABLED', 'account disabled locally', request, user.id);
        }

        return { success: true, user: toValidatedUser(user) };
    }

    private logNikFailure(
        nik: string,
        errorCode: NonNullable<LoginValidationResult['errorCode']>,
        reason: string,
        request?: Request,
        userId = 'system',
    ): LoginValidationResult {
        const maskedNik = maskIdentifier(nik);
        this.auditService.logAsync({
            userId,
            action: AuditAction.LOGIN_FAILED,
            entityType: 'auth',
            entityId: userId === 'system' ? undefined : userId,
            description: `Login failed for NIK ${maskedNik}: ${reason}`,
            newValue: { nik: maskedNik, reason: errorCode },
            request,
        });
        return { success: false, errorCode };
    }

    async validateUser(email: string, pass: string): Promise<ValidatedUser | null> {
        const user = await this.usersService.findByEmail(email);
        if (user && await bcrypt.compare(pass, user.password || '')) {
            return toValidatedUser(user);
        }
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

