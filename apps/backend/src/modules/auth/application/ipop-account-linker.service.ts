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
    | { ok: true; user: ValidatedUser }
    | { ok: false; reason: 'NOT_LINKED' | 'ACCOUNT_DISABLED' };

/**
 * Finds the iDesk account for an iPop identity by HRIS NIK (users.employeeId) only. Email is never used to match:
 * an account without the NIK is not signed in, and no account is created or changed here.
 */
@Injectable()
export class IpopAccountLinker {
    constructor(
        private readonly usersService: UsersService,
        private readonly auditService: AuditService,
    ) {}

    async resolve(identity: IpopIdentity, request?: Request): Promise<IpopLinkResult> {
        const user = await this.usersService.findByEmployeeId(identity.nik);
        if (!user) return this.refuse(identity, 'NOT_LINKED', request);
        if (user.isActive === false) return this.refuse(identity, 'ACCOUNT_DISABLED', request, user.id);
        return { ok: true, user: toValidatedUser(user) };
    }

    private refuse(identity: IpopIdentity, reason: 'NOT_LINKED' | 'ACCOUNT_DISABLED', request?: Request, userId = 'system'): IpopLinkResult {
        this.auditService.logAsync({
            userId, action: AuditAction.LOGIN_FAILED, entityType: 'auth', entityId: userId === 'system' ? undefined : userId,
            description: `Sign in with iPop refused for NIK ${maskIdentifier(identity.nik)}: ${reason}`,
            newValue: { nik: maskIdentifier(identity.nik), reason, source: 'ipop-oidc' },
            request,
        });
        return { ok: false, reason };
    }
}
