import {
    CsiHcService, CsiOrgLocation, locationOfSiteCode, locationOfWorkLocation, normalizeBagian, normalizeNik, serviceOfDepartment,
    siteCodeOfLocation,
} from './csi-org.constants';

describe('CSI org constants', () => {
    it('maps the three HC head-office departments to HCC / HCD / HCS only', () => {
        expect(serviceOfDepartment('HC COMPENSATION & BENEFIT')).toBe(CsiHcService.HCC);
        expect(serviceOfDepartment(' hc  development ')).toBe(CsiHcService.HCD);
        expect(serviceOfDepartment('HC SERVICES')).toBe(CsiHcService.HCS);
        expect(serviceOfDepartment('HCBP AREA KARAWANG')).toBeNull();
        expect(serviceOfDepartment('HSE')).toBeNull();
    });

    it('reads work locations, SJA-SEMARANG being SJA 4', () => {
        expect(locationOfWorkLocation('SJA-1')).toBe(CsiOrgLocation.SJA1);
        expect(locationOfWorkLocation('SJA 2')).toBe(CsiOrgLocation.SJA2);
        expect(locationOfWorkLocation('SJA-SEMARANG')).toBe(CsiOrgLocation.SJA4);
        expect(locationOfWorkLocation('SJA-JAKARTA')).toBe(CsiOrgLocation.JKT);
        expect(locationOfWorkLocation('')).toBeNull();
        expect(locationOfSiteCode('SMG')).toBe(CsiOrgLocation.SJA4);
        expect(locationOfSiteCode('XYZ')).toBeNull();
    });

    it('maps SJA 3 to Sukodono (SKD) both ways, keeping Sepanjang on SJA 1', () => {
        expect(locationOfWorkLocation('SJA-3')).toBe(CsiOrgLocation.SJA3);
        expect(siteCodeOfLocation(CsiOrgLocation.SJA3)).toBe('SKD');
        expect(locationOfSiteCode('SKD')).toBe(CsiOrgLocation.SJA3);
        expect(locationOfSiteCode('skd')).toBe(CsiOrgLocation.SJA3);
        expect(siteCodeOfLocation(CsiOrgLocation.SJA1)).toBe('SPJ');
        expect(locationOfSiteCode('SPJ')).toBe(CsiOrgLocation.SJA1);
    });

    it('merges the head-office suffixes of a bagian but keeps area bagian distinct', () => {
        expect(normalizeBagian('GA MANAGEMENT - SEPANJANG')).toBe('GA MANAGEMENT');
        expect(normalizeBagian('HC SERVICES - PUSAT')).toBe('HC SERVICES');
        expect(normalizeBagian('HC SERVICES AREA - KARAWANG')).toBe('HC SERVICES AREA - KARAWANG');
        expect(normalizeBagian(null)).toBeNull();
    });

    it('restores the leading zeros of numeric NIKs', () => {
        expect(normalizeNik(277)).toBe('00000277');
        expect(normalizeNik(' 00004546 ')).toBe('00004546');
        expect(normalizeNik('')).toBeNull();
    });
});
