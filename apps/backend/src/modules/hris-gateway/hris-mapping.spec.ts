import { UserRole } from '../users/enums/user-role.enum';
import {
    DEFAULT_HRIS_PASSWORD,
    LOKASI_TO_SITE_CODE,
    resolveRole,
    resolveSiteCode,
} from './hris-mapping';

describe('hris-mapping', () => {
    describe('resolveSiteCode', () => {
        it.each([
            ['SJA-1', 'SPJ'],
            ['SJA-3', 'SPJ'],
            ['SJA-2', 'KRW'],
            ['SJA-SMG', 'SMG'],
            ['SJA-JKT', 'JTB'],
        ])('%s -> %s', (lokasi, expected) => {
            expect(resolveSiteCode(lokasi)).toBe(expected);
        });

        it('returns null for unknown and empty locations', () => {
            expect(resolveSiteCode('SJA-99')).toBeNull();
            expect(resolveSiteCode(null)).toBeNull();
            expect(resolveSiteCode(undefined)).toBeNull();
        });

        it('trims and normalizes case', () => {
            expect(resolveSiteCode(' sja-1 ')).toBe('SPJ');
        });
    });

    describe('resolveRole', () => {
        it('maps Security & Network Infrastructure to operational support', () => {
            expect(resolveRole('SECURITY & NETWORK INFRASTURCTURE')).toBe(UserRole.AGENT_OPERATIONAL_SUPPORT);
            expect(resolveRole('SECURITY & NETWORK INFRASTURCTURE AREA - SEPANJANG')).toBe(UserRole.AGENT_OPERATIONAL_SUPPORT);
        });

        it('maps Information System Development to Oracle agent', () => {
            expect(resolveRole('INFORMATION SYSTEM DEVELOPMENT')).toBe(UserRole.AGENT_ORACLE);
        });

        it('maps other departments to user', () => {
            expect(resolveRole('ICT')).toBe(UserRole.USER);
            expect(resolveRole('ICT KARAWANG TEST')).toBe(UserRole.USER);
            expect(resolveRole('MARKETING INFORMATION SYSTEM')).toBe(UserRole.USER);
            expect(resolveRole(null)).toBe(UserRole.USER);
        });
    });

    it('keeps default password and full location mapping explicit', () => {
        expect(DEFAULT_HRIS_PASSWORD).toBe('123456');
        expect(Object.keys(LOKASI_TO_SITE_CODE)).toHaveLength(5);
    });
});
