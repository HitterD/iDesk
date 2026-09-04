import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import { AuditService } from '../../audit/audit.service';
import { AuditAction } from '../../audit/entities/audit-log.entity';
import { HrisGatewayAdapter, HrisInvalidResponseError, HrisUnavailableError, HrisVerifyResult, isHrisLoginVerifyEnabled } from '../../hris-gateway/hris-gateway.adapter';
import { HrisProvisioningService } from './hris-provisioning.service';
import { HrisSyncService } from '../../hris-gateway/hris-sync.service';
import { UsersService } from '../../users/users.service';
import { LoginValidationResult } from './auth-validation.types';
import { toValidatedUser } from './auth-user.mapper';
import { DUMMY_PASSWORD_HASH, verifyPassword } from './password-verifier';
import { maskIdentifier } from '../../../shared/security/sensitive-data';
import { AuthEventPublisher, AUTH_EVENT } from './auth-events';

@Injectable()
export class CredentialValidatorService {
    constructor(
        private readonly usersService: UsersService,
        private readonly auditService: AuditService,
        private readonly hrisGateway: HrisGatewayAdapter,
        private readonly hrisSync: HrisSyncService,
        private readonly hrisProvisioning: HrisProvisioningService,
        private readonly authEvents: AuthEventPublisher,
    ) {}

    async validate(identifier: string, pass: string, request?: Request): Promise<LoginValidationResult> {
        const normalized = identifier.trim();
        return normalized.includes('@')
            ? this.validateEmail(normalized.toLowerCase(), pass, request)
            : this.validateNik(normalized, pass, request);
    }

    private async validateEmail(email: string, pass: string, request?: Request): Promise<LoginValidationResult> {
        const user = await this.usersService.findByEmail(email);
        const valid = await verifyPassword(pass, user?.password ?? DUMMY_PASSWORD_HASH);
        const maskedEmail = this.maskEmail(email);

        if (!user) {
            this.auditService.logAsync({
                userId: 'system', action: AuditAction.LOGIN_FAILED, entityType: 'auth',
                description: `Login failed: User not found for email ${maskedEmail}`,
                newValue: { email: maskedEmail, reason: 'USER_NOT_FOUND' }, request,
            });
            this.emitLoginFailure('email', 'USER_NOT_FOUND');
            return { success: false, errorCode: 'USER_NOT_FOUND' };
        }
        if (user.isActive === false) {
            this.auditService.logAsync({
                userId: user.id, action: AuditAction.LOGIN_FAILED, entityType: 'auth', entityId: user.id,
                description: `Login failed: Account disabled for ${user.fullName}`,
                newValue: { email: maskedEmail, reason: 'ACCOUNT_DISABLED' }, request,
            });
            this.emitLoginFailure('email', 'ACCOUNT_DISABLED');
            return { success: false, errorCode: 'ACCOUNT_DISABLED' };
        }
        if (!valid) {
            this.auditService.logAsync({
                userId: user.id, action: AuditAction.LOGIN_FAILED, entityType: 'auth', entityId: user.id,
                description: `Login failed: Wrong password for ${user.fullName}`,
                newValue: { email: maskedEmail, reason: 'WRONG_PASSWORD' }, request,
            });
            this.emitLoginFailure('email', 'WRONG_PASSWORD');
            return { success: false, errorCode: 'WRONG_PASSWORD' };
        }
        return { success: true, user: toValidatedUser(user) };
    }

    private async validateNik(nik: string, pass: string, request?: Request): Promise<LoginValidationResult> {
        // Development escape hatch: skip the gateway entirely so an unreachable HRIS
        // cannot stall every NIK login for the request timeout.
        if (!isHrisLoginVerifyEnabled()) {
            return this.validateNikLocal(nik, pass, 'HRIS verification disabled, local only', request);
        }

        let verification: HrisVerifyResult;
        try {
            verification = await this.hrisGateway.verifyPassword(nik, pass);
        } catch (error) {
            if (error instanceof HrisUnavailableError || error instanceof HrisInvalidResponseError) {
                // HRIS unreachable: fall back to the locally stored password so admin-reset
                // credentials still work while the gateway is down.
                return this.validateNikLocal(nik, pass, 'HRIS unavailable, local fallback', request);
            }
            throw error;
        }

        // HRIS is the authority on employment status: an employee it marks ineligible
        // (e.g. resigned) is denied even if a local password would match.
        if (verification.valid && !verification.eligible) {
            return this.logNikFailure(nik, 'ACCOUNT_DISABLED', 'not eligible in HRIS', request);
        }

        // Primary path: the HRIS password itself matched.
        if (verification.valid && verification.eligible && verification.match === true) {
            let user = await this.usersService.findByEmployeeId(nik);
            if (!user) user = await this.hrisProvisioning.provision(nik);
            if (!user) return this.logNikFailure(nik, 'USER_NOT_FOUND', 'profile unavailable for provisioning', request);
            if (user.isActive === false) return this.logNikFailure(nik, 'ACCOUNT_DISABLED', 'account disabled locally', request, user.id);
            return { success: true, user: toValidatedUser(user) };
        }

        // HRIS did not authenticate the password (wrong HRIS password, or NIK absent from HRIS):
        // fall back to the locally stored password, which covers admin password resets.
        const reason = verification.valid ? 'HRIS password rejected, local fallback' : 'NIK not in HRIS, local fallback';
        return this.validateNikLocal(nik, pass, reason, request);
    }

    /**
     * Verify a NIK login against the locally stored password. Used as a fallback when HRIS
     * does not authenticate the credential (rejected password, NIK absent from HRIS, or the
     * gateway being unavailable). A fixed dummy hash keeps timing uniform for unknown NIKs.
     */
    private async validateNikLocal(nik: string, pass: string, reason: string, request?: Request): Promise<LoginValidationResult> {
        const user = await this.usersService.findByEmployeeId(nik);
        const valid = await verifyPassword(pass, user?.password ?? DUMMY_PASSWORD_HASH);
        if (!user || !valid) {
            return this.logNikFailure(nik, user ? 'WRONG_PASSWORD' : 'USER_NOT_FOUND', reason, request, user?.id);
        }
        if (user.isActive === false) {
            return this.logNikFailure(nik, 'ACCOUNT_DISABLED', 'account disabled locally', request, user.id);
        }
        return { success: true, user: toValidatedUser(user) };
    }

    private logNikFailure(nik: string, errorCode: NonNullable<LoginValidationResult['errorCode']>, reason: string, request?: Request, userId = 'system'): LoginValidationResult {
        const maskedNik = maskIdentifier(nik);
        this.auditService.logAsync({
            userId, action: AuditAction.LOGIN_FAILED, entityType: 'auth', entityId: userId === 'system' ? undefined : userId,
            description: `Login failed for NIK ${maskedNik}: ${reason}`,
            newValue: { nik: maskedNik, reason: errorCode }, request,
        });
        this.emitLoginFailure('nik', errorCode);
        return { success: false, errorCode };
    }

    private emitLoginFailure(method: 'email' | 'nik', reason: string): void {
        this.authEvents.emit(AUTH_EVENT.LOGIN_FAILED, { method, reason, outcome: 'failed' });
    }

    private maskEmail(email: string): string {
        const [localPart, domain] = email.split('@');
        return `${localPart.slice(0, 1)}***@${domain?.slice(0, 1) ?? '*'}***`;
    }
}
