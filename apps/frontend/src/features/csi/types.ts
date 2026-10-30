import type { ServiceScope } from '@/lib/constants/service-scope';

export type CsiScopeParam = 'ict' | 'hc';
export type CsiScope = ServiceScope;
export type CsiRespondentMode = 'OPEN' | 'LISTED';
export type CsiPeriodStatus = 'UPCOMING' | 'ACTIVE' | 'ENDED';
export type CsiPublishStatus = 'DRAFT' | 'PUBLISHED';
export type CsiQuestionType = 'STAR' | 'SCALE' | 'CHOICE' | 'TEXT';
export type CsiRateeKind = 'PERSON' | 'TEAM';

/** `points` is 1-5 for SCALE options and null for CHOICE options. */
export interface CsiOption { label: string; points: number | null }
export interface CsiSiteSummary { id: string; code: string | null; name: string | null }

export interface CsiReadiness {
    ready: boolean;
    checks: Array<{ key: 'team' | 'ratees' | 'dimensions' | 'departments' | 'raters'; ok: boolean; label: string }>;
}

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
    /** Short label for reports (max 40); null falls back to `name`. */
    shortLabel?: string | null;
    type: CsiQuestionType;
    required: boolean;
    options: CsiOption[];
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
    sites: CsiSiteSummary[];
    title: string;
    intro: string;
    thankYou: string;
    startDate: string;
    endDate: string;
    respondentMode: CsiRespondentMode;
    publishStatus: CsiPublishStatus;
    teamEnabled: boolean;
    teamLabel: string;
    individualEnabled: boolean;
    slaTargetPct: number;
    createdById: string;
}

export interface CsiPeriodListItem extends CsiPeriod {
    status: CsiPeriodStatus;
    responseCount: number;
}

export interface CsiPeriodRateeDimension extends CsiTimestamps {
    id: string;
    periodRateeId: string;
    dimensionId: string;
    dimensionName: string;
    type: CsiQuestionType;
    required: boolean;
    options: CsiOption[];
    sortOrder: number;
}

export interface CsiPeriodRatee extends CsiTimestamps {
    id: string;
    periodId: string;
    kind: CsiRateeKind;
    userId: string | null;
    displayName: string;
    jobTitle: string | null;
    sortOrder: number;
    /** PERSON: User.siteId at snapshot time; TEAM: the team's site (one team per site). */
    siteId?: string | null;
    teamId?: string | null;
    /** Per-period overrides; null means the master value applies. */
    photoUrl?: string | null;
    tagline?: string | null;
    dimensions: CsiPeriodRateeDimension[];
}

export interface CsiPeriodRater {
    id: string;
    periodId: string;
    userId: string;
    user: CsiUser;
}

export interface CsiPeriodDetail extends CsiPeriod {
    status: CsiPeriodStatus;
    locked: boolean;
    readiness: CsiReadiness;
    ratees: CsiPeriodRatee[];
    raters: CsiPeriodRater[];
}

export interface CsiActivePeriod {
    id: string;
    scope: CsiScope;
    title: string;
    submitted: boolean;
}

export interface CsiFormDimension {
    periodRateeDimensionId: string;
    name: string;
    description: string | null;
    type: CsiQuestionType;
    required: boolean;
    options: CsiOption[];
}

export interface CsiFormRatee {
    periodRateeId: string;
    kind: CsiRateeKind;
    displayName: string;
    jobTitle: string | null;
    /** Kept for compatibility; equals photoUrl. */
    avatarUrl: string | null;
    siteId: string | null;
    siteCode: string | null;
    tagline: string | null;
    photoUrl: string | null;
    dimensions: CsiFormDimension[];
}

/** The form never reports `submitted`: a respondent may answer again under another name. */
export interface CsiForm {
    id: string;
    scope: CsiScope;
    title: string;
    intro: string;
    endDate: string;
    teamLabel: string;
    respondent: { fullName: string };
    submittedNames: string[];
    departments: Array<{ id: string; name: string }>;
    ratees: CsiFormRatee[];
}
export type CsiOpenForm = CsiForm;
export interface CsiSubmitResult { submitted: true; thankYou: string }

export interface CsiDistributionBucket { label: string; count: number }
export interface CsiQuestionStat {
    name: string;
    /** Report label = `shortLabel ?? name` (see `questionDisplayLabel`). */
    shortLabel: string | null;
    /** Master question description, e.g. "[Kecepatan respon ...]"; absent on older payloads. */
    description?: string | null;
    type: CsiQuestionType;
    average: number | null;
    count: number;
    distribution: CsiDistributionBucket[];
}
export interface CsiReportRatee {
    periodRateeId: string;
    kind: CsiRateeKind;
    displayName: string;
    jobTitle: string | null;
    siteId: string | null;
    photoUrl: string | null;
    respondentCount: number;
    average: number | null;
    indexPct: number | null;
    /** Count of STAR answers per score: index 0 = 1 star … index 4 = 5 stars. */
    starDistribution: number[];
    questions: CsiQuestionStat[];
    /** Non-empty comments for this ratee (same site narrowing as the scores), newest first. */
    comments: CsiReportComment[];
}
export interface CsiReportComment { text: string; departmentName: string; submittedAt: string }
export interface CsiSlaReporter { email: string; department: string | null; fullName: string }
export interface CsiSla {
    mode: CsiRespondentMode;
    basis: number;
    targetPct: number;
    target: number;
    responses: number;
    pengisiPct: number | null;
    reporters: CsiSlaReporter[];
}

export interface CsiReport {
    period: CsiPeriod;
    overall: { average: number | null; respondentCount: number };
    /** Overall average of the latest earlier published period (same site when filtered); null when none. */
    previousAverage: number | null;
    ratees: CsiReportRatee[];
    sla: CsiSla;
}

export interface CsiRespondents {
    mode: CsiRespondentMode;
    submitted: Array<{
        responseId: string; userId: string; respondentName: string; accountName: string; departmentName: string;
        siteId: string | null; submittedAt: string;
    }>;
    /** LISTED only: raters without a response (department + site of the user account). */
    pending: Array<{ userId: string; fullName: string; department: string | null; siteId: string | null }> | null;
    totals: { submitted: number; pending: number | null };
}

export interface CsiAnswerScore {
    dimension: string;
    type: CsiQuestionType;
    score: number | null;
    answerLabel: string | null;
    answerText: string | null;
}

export interface CsiResponseDetail {
    responseId: string;
    respondentName: string;
    accountName: string;
    areaName: string | null;
    departmentName: string;
    submittedAt: string;
    ratees: Array<{
        periodRateeId: string;
        kind: CsiRateeKind;
        displayName: string;
        jobTitle: string | null;
        comment: string | null;
        scores: CsiAnswerScore[];
    }>;
}

export interface CsiMemoSigner { name: string; title: string }
export interface CsiMemoHeader {
    to: string; cc: string; number: string; from: string; subject: string; date: string;
    opening: string; closing: string; signerLeft: CsiMemoSigner; signerRight: CsiMemoSigner;
}
export interface CsiMemoRequest { periodIds: string[]; header: CsiMemoHeader }

export interface CreateCsiDepartment {
    name: string;
    isActive?: boolean;
}
export type UpdateCsiDepartment = Partial<CreateCsiDepartment>;
export interface CreateCsiDimension {
    name: string;
    description?: string | null;
    shortLabel?: string | null;
    type: CsiQuestionType;
    required?: boolean;
    options?: CsiOption[];
    isActive?: boolean;
}
export type UpdateCsiDimension = Partial<CreateCsiDimension>;
export interface CsiUserIds { userIds: string[] }
export interface CsiReorder { ids: string[] }

export interface CreateCsiPeriod {
    siteIds?: string[];
    title?: string;
    intro?: string;
    thankYou?: string;
    startDate: string;
    endDate: string;
    respondentMode?: CsiRespondentMode;
    teamEnabled?: boolean;
    teamLabel?: string;
    individualEnabled?: boolean;
    slaTargetPct?: number;
    copyFromPeriodId?: string;
}
export type UpdateCsiPeriod = Partial<Omit<CreateCsiPeriod, 'copyFromPeriodId'>>;
export interface SetCsiRatees { ratees: Array<{ userId: string; dimensionIds: string[] }> }
export interface SetCsiTeamQuestions { siteId: string; questionIds: string[] }
/** Per-period ratee override; `photoUrl: null` resets the photo, an empty tagline falls back to the master. */
export interface UpdateCsiPeriodRatee { siteId?: string; photoUrl?: null; tagline?: string | null }
export interface SubmitCsiItem {
    periodRateeDimensionId: string;
    score?: number;
    optionIndex?: number;
    text?: string;
}
export interface SubmitCsiResponse {
    respondentName: string;
    departmentId: string;
    items: SubmitCsiItem[];
    comments?: Array<{ periodRateeId: string; comment: string }>;
}
export interface ResetCsiResponse { reason: string }
export interface CsiResetResult { reset: true }

// ─── Subjects (master photo / tagline per person and per site team) ─────────
export interface CsiSubjectView {
    /** `user:<userId>` or `team:<teamId>`. */
    key: string;
    kind: CsiRateeKind;
    userId: string | null;
    teamId: string | null;
    siteId: string;
    name: string;
    jobTitle: string | null;
    photoUrl: string | null;
    tagline: string | null;
}
export interface CsiSubjectGroup {
    siteId: string;
    siteCode: string;
    siteName: string;
    team: CsiSubjectView | null;
    people: CsiSubjectView[];
}
/** Empty / null clears tagline and jobTitle; `name` applies to team subjects only. */
export interface UpdateCsiSubject { tagline?: string | null; jobTitle?: string | null; name?: string }
export interface CreateCsiTeam { siteId: string }

// ─── Rater → subject mapping per period ──────────────────────────────────────
export interface CsiPair { periodRaterId: string; periodRateeId: string }
export interface CsiAssignments {
    raters: Array<{ periodRaterId: string; userId: string; fullName: string; department: string | null; siteId: string | null }>;
    ratees: Array<{ periodRateeId: string; kind: CsiRateeKind; name: string; siteId: string | null; photoUrl: string | null }>;
    pairs: CsiPair[];
}
export interface SetCsiAssignments { pairs: CsiPair[] }

// ─── Reminders ───────────────────────────────────────────────────────────────
/** Omitted / empty `userIds` = every rater who has not answered yet. */
export interface SendCsiReminders { userIds?: string[] }
export interface CsiReminderResult { sent: number; skipped: number }

// ─── Dashboard ───────────────────────────────────────────────────────────────
export interface CsiDashboardActive {
    periodId: string; title: string; siteId: string; siteCode: string | null; siteName: string | null;
    responses: number; basis: number; target: number; targetPct: number; average: number | null; endDate: string;
}
export interface CsiDashboardTrend {
    siteId: string; siteCode: string | null;
    points: Array<{ periodId: string; label: string; average: number | null }>;
}
export interface CsiDashboardPersonDelta { name: string; photoUrl: string | null; siteId: string; delta: number }
export interface CsiDashboardPending { userId: string; fullName: string; department: string | null; siteId: string | null; periodId: string }
export interface CsiDashboardComment { text: string; subjectName: string; siteId: string | null; createdAt: string }
export interface CsiDashboard {
    active: CsiDashboardActive[];
    trend: CsiDashboardTrend[];
    peopleDelta: CsiDashboardPersonDelta[];
    pending: CsiDashboardPending[];
    comments: CsiDashboardComment[];
}
