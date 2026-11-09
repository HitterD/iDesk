import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { User } from '../../users/entities/user.entity';
import { CsiServiceReportOwner } from '../entities/csi-service-report-owner.entity';
import { CsiAccessReader } from '../guards/csi-access-reader';
import { canAdminCsiScope } from '../guards/csi-admin.guard';
import { CSI_HC_SERVICES } from '../org/csi-org.constants';

const SERVICE_CODES = CSI_HC_SERVICES.map((service) => service.code as string);
const NOT_OWNER_MESSAGE = 'Anda bukan penanggung jawab report layanan ini';

export type CsiReportAccess = { admin: boolean; services: string[] };

/**
 * Who reads which HC service report: scope admins every service, service report owners (csi_service_report_owners)
 * their own service at every location, anyone else nothing.
 */
@Injectable()
export class CsiReportAccessService {
    constructor(
        @InjectRepository(CsiServiceReportOwner) private readonly owners: Repository<CsiServiceReportOwner>,
        @InjectRepository(User) private readonly users: Repository<User>,
        private readonly access: CsiAccessReader,
    ) { }

    async servicesFor(userId: string, scope: ServiceScope): Promise<CsiReportAccess> {
        const account = await this.access.load(userId);
        if (account && canAdminCsiScope(account.role, account.pageAccess, scope)) return { admin: true, services: [...SERVICE_CODES] };
        if (!account) return { admin: false, services: [] };
        const rows = await this.owners.find({ where: { scope, userId } });
        return { admin: false, services: SERVICE_CODES.filter((code) => rows.some((row) => row.serviceCode === code)) };
    }

    async assertService(userId: string, scope: ServiceScope, serviceCode: string): Promise<{ admin: boolean }> {
        const access = await this.servicesFor(userId, scope);
        if (!access.services.includes(serviceCode)) throw new ForbiddenException(NOT_OWNER_MESSAGE);
        return { admin: access.admin };
    }

    async listOwners(scope: ServiceScope) {
        const rows = await this.owners.find({ where: { scope }, relations: { user: true }, order: { createdAt: 'ASC' } });
        return SERVICE_CODES.map((code) => ({
            serviceCode: code,
            users: rows.filter((row) => row.serviceCode === code).map((row) => ({ id: row.userId, fullName: row.user?.fullName ?? '-', email: row.user?.email ?? null })),
        }));
    }

    /** Replaces the owners of one service (duplicates collapse); other services are untouched. */
    async setOwners(scope: ServiceScope, serviceCode: string, userIds: string[]) {
        if (!SERVICE_CODES.includes(serviceCode)) throw new BadRequestException('Layanan tidak dikenal');
        const ids = [...new Set(userIds)];
        const found = ids.length ? await this.users.find({ where: { id: In(ids) }, select: { id: true } }) : [];
        if (found.length !== ids.length) throw new BadRequestException('Pengguna tidak ditemukan');
        await this.owners.delete({ scope, serviceCode });
        if (ids.length) await this.owners.save(ids.map((userId) => ({ scope, serviceCode, userId })));
        return this.listOwners(scope);
    }
}
