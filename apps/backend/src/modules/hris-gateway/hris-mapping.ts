import { UserRole } from '../users/enums/user-role.enum';

export const LOKASI_TO_SITE_CODE: Record<string, string> = {
    'SJA-1': 'SPJ',
    'SJA-3': 'SPJ',
    'SJA-2': 'KRW',
    'SJA-SMG': 'SMG',
    'SJA-JKT': 'JTB',
};

export const DEFAULT_HRIS_PASSWORD = '123456';

// HRIS uses this exact misspelling in department names.
const OPERATIONAL_SUPPORT_DEPARTMENT_PREFIX = 'SECURITY & NETWORK INFRASTURCTURE';
const ORACLE_DEPARTMENT = 'INFORMATION SYSTEM DEVELOPMENT';

export function resolveSiteCode(lokasi?: string | null): string | null {
    return LOKASI_TO_SITE_CODE[(lokasi || '').toUpperCase().trim()] ?? null;
}

export function resolveRole(namaDepartemen?: string | null): UserRole {
    const department = (namaDepartemen || '').toUpperCase().trim();
    if (department.startsWith(OPERATIONAL_SUPPORT_DEPARTMENT_PREFIX)) {
        return UserRole.AGENT_OPERATIONAL_SUPPORT;
    }
    if (department === ORACLE_DEPARTMENT) {
        return UserRole.AGENT_ORACLE;
    }
    return UserRole.USER;
}
