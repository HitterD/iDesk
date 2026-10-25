import type { ServiceScope } from '@/lib/constants/service-scope';

export type CsiScopeParam = 'ict' | 'hc';
export type CsiScope = ServiceScope;
export type CsiRespondentMode = 'OPEN' | 'LISTED';
export type CsiPeriodStatus = 'UPCOMING' | 'ACTIVE' | 'ENDED';

interface CsiTimestamps {
    createdAt: string;
    updatedAt: string;
}

export interface CsiDepartment extends CsiTimestamps {
    id: string;
    scope: CsiScope;
    name: string;
    isActive: boolean;
    sortOrder: number;
}

export interface CsiDimension extends CsiDepartment {
    description: string | null;
}

export interface CsiUser {
    id: string;
    fullName: string;
    email: string;
    jobTitle: string | null;
}

export interface CsiUserSearchResult extends CsiUser {
    siteId: string | null;
    site: { code: string; name: string } | null;
}

export interface CsiRater extends CsiTimestamps {
    id: string;
    scope: CsiScope;
    userId: string;
    user: CsiUser & { site: { code: string; name: string } | null };
}

// DELETE returns the entity without the user relation loaded.
export type CsiRemovedRater = Omit<CsiRater, 'user'>;

export interface CsiPeriod extends CsiTimestamps {
    id: string;
    scope: CsiScope;
    siteId: string;
    title: string;
    intro: string;
    thankYou: string;
    startDate: string;
    endDate: string;
    respondentMode: CsiRespondentMode;
    createdById: string;
}

export interface CsiPeriodListItem extends CsiPeriod {
    site: { id: string; code: string; name: string } | null;
    status: CsiPeriodStatus;
    responseCount: number;
}

export interface CsiPeriodRateeDimension extends CsiTimestamps {
    id: string;
    periodRateeId: string;
    dimensionId: string;
    dimensionName: string;
    sortOrder: number;
}

export interface CsiPeriodRatee extends CsiTimestamps {
    id: string;
    periodId: string;
    userId: string;
    displayName: string;
    jobTitle: string | null;
    sortOrder: number;
    dimensions: CsiPeriodRateeDimension[];
}

export interface CsiPeriodRater {
    id: string;
    periodId: string;
    userId: string;
    user: CsiUser;
}

export interface CsiPeriodDetail extends CsiPeriod {
    site: CsiPeriodListItem['site'];
    status: CsiPeriodStatus;
    locked: boolean;
    ratees: CsiPeriodRatee[];
    raters: CsiPeriodRater[];
}

export interface CsiActivePeriod {
    id: string;
    scope: CsiScope;
    title: string;
    submitted: boolean;
}

export interface CsiSubmittedForm {
    submitted: true;
    title: string;
    thankYou: string;
}

export interface CsiOpenForm {
    submitted: false;
    id: string;
    scope: CsiScope;
    title: string;
    intro: string;
    respondent: { fullName: string };
    departments: Array<{ id: string; name: string }>;
    ratees: Array<{
        periodRateeId: string;
        displayName: string;
        jobTitle: string | null;
        dimensions: Array<{ periodRateeDimensionId: string; name: string }>;
    }>;
}

export type CsiForm = CsiOpenForm | CsiSubmittedForm;
export interface CsiSubmitResult { submitted: true; thankYou: string }

export interface CsiReport {
    period: CsiPeriod;
    ratees: Array<{
        periodRateeId: string;
        displayName: string;
        jobTitle: string | null;
        respondentCount: number;
        average: number | null;
        indexPct: number | null;
        dimensions: Array<{ name: string; average: number | null; count: number }>;
    }>;
}

export interface CsiRespondents {
    mode: CsiRespondentMode;
    submitted: Array<{ responseId: string; fullName: string; departmentName: string; submittedAt: string }>;
    pending: Array<{ userId: string; fullName: string }> | null;
    totals: { submitted: number; pending: number | null };
}

export interface CsiResponseDetail {
    responseId: string;
    fullName: string;
    departmentName: string;
    submittedAt: string;
    ratees: Array<{
        periodRateeId: string;
        displayName: string;
        jobTitle: string | null;
        comment: string | null;
        scores: Array<{ dimension: string; score: number }>;
    }>;
}

export interface CreateCsiDepartment {
    name: string;
    isActive?: boolean;
    sortOrder?: number;
}
export type UpdateCsiDepartment = Partial<CreateCsiDepartment>;
export interface CreateCsiDimension extends CreateCsiDepartment { description?: string | null }
export type UpdateCsiDimension = Partial<CreateCsiDimension>;
export interface CsiUserIds { userIds: string[] }

export interface CreateCsiPeriod {
    siteId: string;
    title?: string;
    intro?: string;
    thankYou?: string;
    startDate: string;
    endDate: string;
    respondentMode?: CsiRespondentMode;
    copyFromPeriodId?: string;
}
export type UpdateCsiPeriod = Partial<Omit<CreateCsiPeriod, 'siteId' | 'copyFromPeriodId'>>;
export interface SetCsiRatees { ratees: Array<{ userId: string; dimensionIds: string[] }> }
export interface SubmitCsiResponse {
    departmentId: string;
    items: Array<{ periodRateeDimensionId: string; score: number }>;
    comments?: Array<{ periodRateeId: string; comment: string }>;
}
export interface ResetCsiResponse { reason: string }
export interface CsiResetResult { reset: true }
