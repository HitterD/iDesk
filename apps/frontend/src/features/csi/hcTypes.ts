/** HC per-PIC types (layanan HCC / HCD / HCS → bagian → PIC), mirroring the backend org module. */

export interface CsiPicView {
    id: string;
    nik: string;
    fullName: string;
    jobTitle: string | null;
    serviceCode: string;
    serviceName: string | null;
    bagian: string | null;
    workLocation: string | null;
    siteId: string | null;
    userId: string | null;
    photoUrl: string | null;
    isActive: boolean;
}

export interface CsiDirectoryImportResult { people: number; skipped: number; picsAdded: number; picsUpdated: number }
export interface SetCsiPeriodPics { picIds: string[]; dimensionIds: string[] }

export type CsiLocationCode = 'SJA1' | 'SJA2' | 'SJA3' | 'SJA4' | 'JKT';
export interface CsiRecapCell { average: number | null; ratings: number }
export interface CsiLocationCells { all: CsiRecapCell; byLocation: Record<CsiLocationCode, CsiRecapCell> }
export interface CsiRecapRow extends CsiLocationCells {
    level: 'service' | 'bagian' | 'pic';
    key: string;
    label: string;
    serviceCode: string | null;
    bagian: string | null;
    jobTitle: string | null;
    dimensions: Record<string, number | null>;
}
export interface CsiRespondentGroupRow extends CsiLocationCells {
    level: 'division' | 'department' | 'bagian';
    key: string;
    label: string;
    division: string;
    department: string | null;
}
export interface CsiRespondentDetail {
    responseId: string;
    name: string;
    division: string | null;
    department: string | null;
    bagian: string | null;
    location: CsiLocationCode | null;
    pics: Array<{ name: string; serviceCode: string | null; bagian: string | null; scores: Record<string, number>; average: number | null }>;
    average: number | null;
}
export interface CsiHcRecap {
    period: { id: string; title: string; startDate: string; endDate: string };
    dimensions: string[];
    locations: Array<{ code: CsiLocationCode; label: string }>;
    overall: CsiLocationCells & { dimensions: Record<string, number | null>; respondents: number };
    services: CsiRecapRow[];
    respondentGroups: CsiRespondentGroupRow[];
    respondents: CsiRespondentDetail[];
}

export interface CsiUnitRule {
    division: string;
    department?: string | null;
    bagian?: string | null;
    location?: CsiLocationCode | null;
    serviceCode: string;
    picBagian?: string | null;
    picIds?: string[] | null;
}
export interface CsiUnitOption { division: string; department: string | null; bagian: string | null; accounts: number }
export interface CsiHcRater {
    userId: string; nik: string | null; fullName: string; siteCode: string | null;
    division: string | null; department: string | null; bagian: string | null; periodRateeIds: string[];
}
export interface CsiPairsImportReport {
    rows: number; pairs: number; raters: number; problems: Array<{ row: number; message: string }>; problemCount: number; committed: boolean;
}
