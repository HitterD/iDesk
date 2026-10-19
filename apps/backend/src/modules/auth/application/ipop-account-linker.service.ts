import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import { AuditService } from '../../audit/audit.service';
import { AuditAction } from '../../audit/entities/audit-log.entity';
import { UsersService } from '../../users/users.service';
import { maskIdentifier } from '../../../shared/security/sensitive-data';
import { IpopIdentity } from '../infrastructure/ipop-oidc.client';
import { toValidatedUser } from './auth-user.mapper';
import { ValidatedUser } from './auth-user.types';

export type IpopLinkResult =
    | { ok: true; user: ValidatedUser; linked: boolean }
    | { ok: false; reason: 'NOT_LINKED' | 'ACCOUNT_DISABLED' | 'NIK_CONFLICT' };

/**
 * Finds the iDesk account for an iPop identity. NIK (users.employeeId) is the key; an account without a NIK is
 * linked once by its email. Never creates an account and never overwrites a different NIK.
 */
@Injectable()
export class IpopAccountLinker {
    constructor(
        private readonly usersService: UsersService,
        private readonly auditService: AuditService,
    ) {}

    async resolve(identity: IpopIdentity, request?: Request): Promise<IpopLinkResult> {
        const byNik = await this.usersService.findByEmployeeId(identity.nik);
        if (byNik) {
            if (byNik.isActive === false) return this.refuse(identity, 'ACCOUNT_DISABLED', request, byNik.id);
            return { ok: true, user: toValidatedUser(byNik), linked: false };
        }

        const byEmail = identity.email ? await this.usersService.findByEmail(identity.email) : undefined;
        if (!byEmail) return this.refuse(identity, 'NOT_LINKED', request);
        if (byEmail.employeeId && byEmail.employeeId !== identity.nik) {
            return this.refuse(identity, 'NIK_CONFLICT', request, byEmail.id);
        }
        if (byEmail.isActive === false) return this.refuse(identity, 'ACCOUNT_DISABLED', request, byEmail.id);

        const updated = await this.usersService.update(byEmail.id, { employeeId: identity.nik });
        await this.auditService.log({
            userId: byEmail.id, action: AuditAction.USER_UPDATE, entityType: 'user', entityId: byEmail.id,
            description: `Linked ${byEmail.fullName} to iPop by email (one-time NIK link)`,
            oldValue: { employeeId: null },
            newValue: { employeeId: maskIdentifier(identity.nik), source: 'ipop-oidc' },
            request,
        });
        return { ok: true, user: toValidatedUser({ ...byEmail, ...updated, employeeId: identity.nik }), linked: true };
    }

    private refuse(identity: IpopIdentity, reason: 'NOT_LINKED' | 'ACCOUNT_DISABLED' | 'NIK_CONFLICT', request?: Request, userId = 'system'): IpopLinkResult {
        this.auditService.logAsync({
            userId, action: AuditAction.LOGIN_FAILED, entityType: 'auth', entityId: userId === 'system' ? undefined : userId,
            description: `Sign in with iPop refused for NIK ${maskIdentifier(identity.nik)}: ${reason}`,
            newValue: { nik: maskIdentifier(identity.nik), reason, source: 'ipop-oidc' },
            request,
        });
        return { ok: false, reason };
    }
}
