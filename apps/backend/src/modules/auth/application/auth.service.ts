import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from '../presentation/dto/register.dto';
import { ChangePasswordDto } from '../presentation/dto/change-password.dto';
import { UsersService } from '../../users/users.service';
import { AuditService } from '../../audit/audit.service';
import { AuditAction } from '../../audit/entities/audit-log.entity';
import * as bcrypt from 'bcrypt';
import { Request } from 'express';
import { randomUUID } from 'crypto';
import { BCRYPT_ROUNDS, resolveRefreshSessionMode } from '../../../shared/core/config/security.config';
import { RefreshSessionStore } from '../infrastructure/refresh-session.store';
import { RefreshTokenClaims } from './refresh-session.types';

const REFRESH_SESSION_MODE = resolveRefreshSessionMode();
const REFRESH_EXPIRY_SECONDS = { '7d': 7 * 24 * 60 * 60, '90d': 90 * 24 * 60 * 60 } as const;
import { HrisGatewayAdapter, HrisInvalidResponseError, HrisUnavailableError } from '../../hris-gateway/hris-gateway.adapter';
import { HrisSyncService } from '../../hris-gateway/hris-sync.service';
import { ValidatedUser } from './auth.types';
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
        private jwtService: JwtService,
        private usersService: UsersService,
        private auditService: AuditService,
        private hrisGateway: HrisGatewayAdapter,
        private hrisSync: HrisSyncService,
        private readonly refreshSessionStore: RefreshSessionStore,
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

        if ((user as any).isActive === false || (user as any).status === 'DISABLED') {
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

        const { password, ...result } = user;
        return {
            success: true,
            user: result as ValidatedUser,
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

        if ((user as any).isActive === false || (user as any).status === 'DISABLED') {
            return this.logNikFailure(nik, 'ACCOUNT_DISABLED', 'account disabled locally', request, user.id);
        }

        const { password, ...result } = user;
        return { success: true, user: result };
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

    async validateUser(email: string, pass: string): Promise<any> {
        const user = await this.usersService.findByEmail(email);
        if (user && await bcrypt.compare(pass, user.password || '')) {
            const { password, ...result } = user;
            return result;
        }
        return null;
    }

    private static readonly STAFF_ROLES = new Set([
        'ADMIN',
        'AGENT',
        'AGENT_OPERATIONAL_SUPPORT',
        'AGENT_ORACLE',
        'MANAGER',
    ]);

    /**
     * Access token expiry by role: staff roles get 8h for extended work
     * sessions, USER (and any unrecognized role) gets 1h.
     */
    private getExpirationByRole(role: string): string {
        return AuthService.STAFF_ROLES.has(role) ? '8h' : '1h';
    }

    async login(user: any, request?: Request, rememberMe = false, familyId: string = randomUUID(), parentId?: string) {
        const payload = { username: user.email, sub: user.id, role: user.role, type: 'access', fullName: user.fullName };
        const tokenId = randomUUID();
        const refreshPayload = {
            username: user.email,
            sub: user.id,
            role: user.role,
            type: 'refresh' as const,
            fullName: user.fullName,
            rememberMe,
            tokenId,
            familyId,
            ...(parentId ? { parentId } : {}),
        };
        const expiresIn = this.getExpirationByRole(user.role);
        const refreshExpiresIn = rememberMe ? '90d' : '7d';

        await this.usersService.update(user.id, { lastActiveAt: new Date() });

        const access_token = this.jwtService.sign(payload, { expiresIn: expiresIn as `${number}${'s' | 'm' | 'h' | 'd'}` });
        const refresh_token = this.jwtService.sign(refreshPayload, { expiresIn: refreshExpiresIn as `${number}${'s' | 'm' | 'h' | 'd'}` });
        const refreshTtl = REFRESH_EXPIRY_SECONDS[refreshExpiresIn];

        if (REFRESH_SESSION_MODE === 'redis' || REFRESH_SESSION_MODE === 'dual') {
            await this.refreshSessionStore.create({
                token: refresh_token,
                tokenId,
                familyId,
                parentId,
                userId: user.id,
                expiresAt: Date.now() + refreshTtl * 1000,
            });
        }
        if (REFRESH_SESSION_MODE !== 'redis') {
            await this.usersService.setCurrentRefreshToken(refresh_token, user.id);
        }

        this.auditService.logAsync({
            userId: user.id,
            action: AuditAction.USER_LOGIN,
            entityType: 'auth',
            entityId: user.id,
            description: `User ${user.fullName} logged in`,
            newValue: { email: user.email, role: user.role },
            request,
        });

        return { access_token, refresh_token, user, expiresIn, refreshExpiresIn };
    }

    async refreshToken(token: string, request?: Request) {
        try {
            const decoded = this.jwtService.verify(token) as RefreshTokenClaims;
            if (decoded.type !== 'refresh') {
                throw new UnauthorizedException('Invalid token type');
            }
            if (REFRESH_SESSION_MODE !== 'legacy' && (!decoded.tokenId || !decoded.familyId)) {
                throw new UnauthorizedException('Invalid token type');
            }

            let user;
            if (REFRESH_SESSION_MODE === 'redis' || REFRESH_SESSION_MODE === 'dual') {
                const consumed = await this.refreshSessionStore.consume(decoded.familyId, decoded.tokenId);
                if (consumed.status === 'reused') {
                    await this.refreshSessionStore.invalidateFamily(decoded.familyId);
                    throw new UnauthorizedException('Invalid refresh token');
                }
                if (consumed.status !== 'valid' || consumed.session.userId !== decoded.sub) {
                    throw new UnauthorizedException('Invalid refresh token');
                }
                user = await this.usersService.findById(decoded.sub);
            } else {
                user = await this.usersService.getUserIfRefreshTokenMatches(token, decoded.sub);
            }
            if (!user) throw new UnauthorizedException('Invalid refresh token');

            return this.login(user, request, decoded.rememberMe === true, decoded.familyId, decoded.tokenId);
        } catch (error) {
            if (error instanceof UnauthorizedException) throw error;
            throw new UnauthorizedException('Refresh token is invalid or expired');
        }
    }

    async invalidateUserSessions(userId: string): Promise<void> {
        if (REFRESH_SESSION_MODE === 'redis' || REFRESH_SESSION_MODE === 'dual') {
            await this.refreshSessionStore.invalidateUserSessions(userId);
        }
        if (REFRESH_SESSION_MODE !== 'redis') {
            await this.usersService.removeRefreshToken(userId);
        }
    }

    async logout(user: any, request?: Request) {
        if (user && user.userId) {
            await this.invalidateUserSessions(user.userId);
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

