/**
 * Organisation data of CSI HC (source: "Data Hirarki Approver.xlsx", sheet "4. ALL DATA_SJA").
 * Services (layanan) are the three HC head-office departments; bagian comes from the sheet's Bagian column with the
 * "- SEPANJANG" / "- PUSAT" suffixes merged; locations are the respondent's Work Location (SJA-SEMARANG = "SJA 4").
 */
export const CSI_ORG_SHEET = '4. ALL DATA_SJA';

export enum CsiHcService {
    HCC = 'HCC',
    HCD = 'HCD',
    HCS = 'HCS',
}

export const CSI_HC_SERVICES: ReadonlyArray<{ code: CsiHcService; department: string; name: string }> = [
    { code: CsiHcService.HCC, department: 'HC COMPENSATION & BENEFIT', name: 'HC Compensation & Benefit' },
    { code: CsiHcService.HCD, department: 'HC DEVELOPMENT', name: 'HC Development' },
    { code: CsiHcService.HCS, department: 'HC SERVICES', name: 'HC Services' },
];

export function collapse(value: string): string {
    return value.trim().replace(/\s+/g, ' ');
}

export const serviceOfDepartment = (department: string | null | undefined): CsiHcService | null =>
    CSI_HC_SERVICES.find((service) => service.department === collapse(department ?? '').toUpperCase())?.code ?? null;
export const serviceName = (code: string | null | undefined) => CSI_HC_SERVICES.find((service) => service.code === code)?.name ?? null;

/** Report location columns, in order; "ALL SJA" is computed over every rating. */
export enum CsiOrgLocation {
    SJA1 = 'SJA1',
    SJA2 = 'SJA2',
    SJA3 = 'SJA3',
    SJA4 = 'SJA4',
    JKT = 'JKT',
}
export const CSI_LOCATIONS: ReadonlyArray<{ code: CsiOrgLocation; label: string }> = [
    { code: CsiOrgLocation.SJA1, label: 'SJA 1' },
    { code: CsiOrgLocation.SJA2, label: 'SJA 2' },
    { code: CsiOrgLocation.SJA3, label: 'SJA 3' },
    { code: CsiOrgLocation.SJA4, label: 'SJA 4 (Semarang)' },
    { code: CsiOrgLocation.JKT, label: 'Jakarta' },
];
export const CSI_LOCATION_ALL_LABEL = 'ALL SJA';
export const locationLabel = (code: string | null | undefined) => CSI_LOCATIONS.find((row) => row.code === code)?.label ?? null;

/** Work Location of the sheet ("SJA-1", "SJA 2", "SJA-SEMARANG", "SJA-JAKARTA") → report location. */
export function locationOfWorkLocation(value: string | null | undefined): CsiOrgLocation | null {
    const key = collapse(value ?? '').toUpperCase().replace(/[\s_-]+/g, '');
    if (key === 'SJA1') return CsiOrgLocation.SJA1;
    if (key === 'SJA2') return CsiOrgLocation.SJA2;
    if (key === 'SJA3') return CsiOrgLocation.SJA3;
    if (key === 'SJA4' || key === 'SJASEMARANG') return CsiOrgLocation.SJA4;
    if (key === 'SJAJAKARTA') return CsiOrgLocation.JKT;
    return null;
}

/** Fallback when the NIK is not in the sheet: the account's site (Sepanjang = SJA 1, Sukodono = SJA 3). */
const LOCATION_OF_SITE_CODE: Readonly<Record<string, CsiOrgLocation>> = {
    SPJ: CsiOrgLocation.SJA1, KRW: CsiOrgLocation.SJA2, SKD: CsiOrgLocation.SJA3, SMG: CsiOrgLocation.SJA4, JTB: CsiOrgLocation.JKT,
};
export const locationOfSiteCode = (code: string | null | undefined) => (code ? LOCATION_OF_SITE_CODE[code.toUpperCase()] ?? null : null);

/** Site code of a Work Location (for PICs without an account). */
const SITE_CODE_OF_LOCATION: Readonly<Record<CsiOrgLocation, string>> = {
    SJA1: 'SPJ', SJA2: 'KRW', SJA3: 'SKD', SJA4: 'SMG', JKT: 'JTB',
};
export const siteCodeOfLocation = (location: CsiOrgLocation | null) => (location ? SITE_CODE_OF_LOCATION[location] : null);

const BAGIAN_SUFFIX = /\s+-\s+(SEPANJANG|PUSAT)$/;
/** "GA MANAGEMENT - SEPANJANG" and "GA MANAGEMENT" are one bagian; area bagian ("- KARAWANG") stay distinct. */
export const normalizeBagian = (value: string | null | undefined) => collapse(value ?? '').toUpperCase().replace(BAGIAN_SUFFIX, '') || null;

/** NIKs are 8-digit strings in the sheet; numbers read from Excel lose their leading zeros. */
export function normalizeNik(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    const text = collapse(String(value));
    if (!text) return null;
    return /^\d+$/.test(text) ? text.padStart(8, '0') : text;
}

export const CSI_UNKNOWN_LABEL = '(Tidak diketahui)';
