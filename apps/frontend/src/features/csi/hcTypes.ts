/** HC per-PIC types (layanan HCC / HCD / HCS → bagian → PIC), mirroring the backend org module. */
import type { CsiScoreBands } from './lib/csiTone';

export interface CsiPicView {
    id: string;
    nik: string;
    fullName: string;
    jobTitle: string | null;
    serviceCode: string;
    serviceName: string | null;
    /** Fungsi pelayanan (free text). */
    serviceFunction: string | null;
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
/** A location cell backed by fewer than 3 respondents keeps its `ratings` count but has a null `average`. */
export interface CsiLocationCells { all: CsiRecapCell; byLocation: Record<CsiLocationCode, CsiRecapCell> }
export interface CsiRecapRow extends CsiLocationCells {
    level: 'service' | 'bagian' | 'pic';
    key: string;
    label: string;
    serviceCode: string | null;
    bagian: string | null;
    jobTitle: string | null;
    /** Fungsi pelayanan (PIC rows only). */
    serviceFunction?: string | null;
    dimensions: Record<string, number | null>;
    /** Distinct respondents behind the row. */
    respondents?: number;
    /** Master PIC of a PIC row; null otherwise. */
    picId?: string | null;
}
/**
 * Respondent group (division → department → bagian): total only, no location split. A total backed by fewer than 3
 * respondents is masked: it keeps its `ratings` count but `average` is null. Small departments are merged into one
 * "Departemen kecil (gabungan)" row.
 */
export interface CsiRespondentGroupRow {
    all: CsiRecapCell;
    level: 'division' | 'department' | 'bagian';
    key: string;
    label: string;
    division: string;
    department: string | null;
    /** Distinct respondents behind the row. */
    respondents?: number;
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
/** Layanan rows come in report order (HCD, HCC, HCS, then others). */
export interface CsiHcRecap {
    period: { id: string; title: string; startDate: string; endDate: string };
    /** Score colour bands of the survey. */
    scoreBands: CsiScoreBands;
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
export interface CsiReportOwnerUser { id: string; fullName: string; email: string | null }
export interface CsiServiceReportOwners { serviceCode: string; users: CsiReportOwnerUser[] }
export interface CsiHcPeriodRef { id: string; title: string; startDate: string; endDate: string }
export interface CsiPendingDepartment { department: string; pending: number; total: number }
export interface CsiServiceReport extends CsiHcRecap { period: CsiHcPeriodRef; serviceCode: string; pending: CsiPendingDepartment[] | null }
export interface CsiReportPeriods { services: string[]; periods: CsiHcPeriodRef[] }
export interface CsiReportAccess { admin: boolean; services: string[] }

/** Assignment templates per location ("siapa menilai siapa" by name, with the PIC service function). */
export type CsiTemplateRaterStatus = 'confirmed' | 'ok' | 'ambiguous' | 'no-account';
export interface CsiTemplateRater { id: string; raterName: string; raterNik: string | null; raterJobTitle: string | null; userId: string | null; status: CsiTemplateRaterStatus; confirmed: boolean }
export interface CsiTemplatePic {
    id: string; area: string; serviceCode: string; picName: string; jobTitle: string | null; serviceFunction: string | null;
    picId: string | null; teamId: string | null; raterCount: number; raters: CsiTemplateRater[];
}
export interface CsiTemplate {
    id: string; scope: string; locationCode: string; name: string; updatedAt: string | null;
    summary: { pics: number; picsUnmatched: number; picsWithoutRaters: number; raters: number; ratersConfirmed: number; ratersOk: number; ratersNoAccount: number; ratersAmbiguous: number };
    pics: CsiTemplatePic[];
}
export interface CsiTemplateList { templates: CsiTemplate[]; bundledAvailable: string[] }
export interface AccountSuggestion {
    id: string; fullName: string; email: string; employeeId: string | null;
    siteId: string | null; siteCode: string | null; department: string | null; score: number;
}
export type CsiTemplatePicResolution = { as: 'team' | 'pic' | 'rename'; picName?: string };
export interface CsiTemplateImportOptions {
    commit?: boolean; resolutions?: Record<string, CsiTemplatePicResolution>; prune?: boolean; pruneConfirmed?: boolean;
}
export interface CsiTemplateImportReport {
    format: 'list' | 'matrix'; committed: boolean;
    services: string[];
    pics: { added: string[]; changed: string[]; removed: string[] };
    raters: { added: number; removed: number };
    teams: { added: string[] }; newMasterPics: string[];
    /** PIC rows left unlinked because several PIC masters share the name. */
    ambiguousMasters: string[];
    unresolved: Array<{ name: string; suggestions: string[] }>;
    problems: Array<{ row: number; message: string }>;
}
export interface CreateCsiPeriodFromTemplates {
    title: string; startDate: string; endDate: string; templateIds: string[];
}
export interface CsiPeriodFromTemplatesResult { periodId: string; report: CsiTemplateApplyReport }
export interface CsiTemplateApplyReport {
    picsAdded: number; teamsAdded: number; ratersAdded: number; pairsAdded: number;
    ratersUnconfirmed: number; siteAdded: string | null;
    /** Raters whose account site is not a survey site: added, but they will not see the survey. */
    ratersOutsideSites: string[];
    picsSkippedNoRaters: string[]; picsUnmatched: string[]; ratersNoAccount: string[]; ratersAmbiguous: string[]; committed: boolean;
    /** Why this survey cannot take the template without hiding it from current raters (null = it can). */
    blockedReason: string | null;
}
