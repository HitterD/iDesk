import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { UserRole } from '../../users/enums/user-role.enum';
import { CSI_HC_SERVICES } from './csi-org.constants';

/** A "layanan" a report and its owners are grouped by: HC departments, ICT handling teams. */
export type CsiService = { code: string; name: string };

/** ICT layanan = the ticket handling teams (as in the Reports team filter) plus managers. */
const ICT_SERVICES: readonly CsiService[] = [
    { code: 'OPS', name: 'Operational Support' },
    { code: 'ORACLE', name: 'Oracle / K2' },
    { code: 'WEB', name: 'Web Dev' },
    { code: 'MOBILE', name: 'Mobile Dev' },
    { code: 'MGR', name: 'Manager ICT' },
];

export const CSI_SERVICES: Readonly<Record<ServiceScope, readonly CsiService[]>> = {
    [ServiceScope.HC]: CSI_HC_SERVICES.map(({ code, name }) => ({ code, name })),
    [ServiceScope.ICT]: ICT_SERVICES,
};

const ICT_SERVICE_OF_ROLE: Readonly<Partial<Record<UserRole, string>>> = {
    [UserRole.AGENT]: 'OPS',
    [UserRole.AGENT_ADMIN]: 'OPS',
    [UserRole.AGENT_OPERATIONAL_SUPPORT]: 'OPS',
    [UserRole.AGENT_ORACLE]: 'ORACLE',
    [UserRole.AGENT_WEB_DEV]: 'WEB',
    [UserRole.AGENT_MOBILE_DEV]: 'MOBILE',
    [UserRole.MANAGER]: 'MGR',
};

export const serviceCodesOf = (scope: ServiceScope) => CSI_SERVICES[scope].map((service) => service.code);
export const serviceNameOf = (scope: ServiceScope, code: string | null | undefined) =>
    CSI_SERVICES[scope].find((service) => service.code === code)?.name ?? null;

/** The ICT layanan of an account role, or null for roles that are not rated by ICT. */
export const ictServiceOfRole = (role: UserRole | string | null | undefined): string | null =>
    (role ? ICT_SERVICE_OF_ROLE[role as UserRole] ?? null : null);
