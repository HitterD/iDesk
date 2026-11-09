import type { CsiScopeParam } from '../types';

/** Layanan a CSI report is grouped by (mirrors backend org/csi-services.ts): HC departments, ICT handling teams. */
export const CSI_SERVICE_NAMES: Readonly<Record<CsiScopeParam, Readonly<Record<string, string>>>> = {
    hc: { HCC: 'HC Compensation & Benefit', HCD: 'HC Development', HCS: 'HC Services' },
    ict: { OPS: 'Operational Support', ORACLE: 'Oracle / K2', WEB: 'Web Dev', MOBILE: 'Mobile Dev', MGR: 'Manager ICT' },
};

export const serviceLabel = (scope: CsiScopeParam, code: string) => `${code} · ${CSI_SERVICE_NAMES[scope][code] ?? ''}`.trim();
