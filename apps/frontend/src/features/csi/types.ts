import type { ServiceScope } from '@/lib/constants/service-scope';
import type { CsiScoreBands } from './lib/csiTone';

export type CsiScopeParam = 'ict' | 'hc';
export type CsiScope = ServiceScope;
export type CsiRespondentMode = 'OPEN' | 'LISTED';
export type CsiPeriodStatus = 'UPCOMING' | 'ACTIVE' | 'ENDED';
export type CsiPublishStatus = 'DRAFT' | 'PUBLISHED' | 'CANCELLED';
export type CsiPairMode = 'ALL' | 'CUSTOM';
export type CsiQuestionType = 'STAR' | 'SCALE' | 'CHOICE' | 'TEXT';
export type CsiRateeKind = 'PERSON' | 'TEAM';

/** `points` is 1-5 for SCALE options and null for CHOICE options. */
export interface CsiOption { label: string; points: number | null }
export interface CsiSiteSummary { id: string; code: string | null; name: string | null }

export interface CsiReadiness {
    ready: boolean;
    checks: Array<{ key: 'team' | 'ratees' | 'dimensions' | 'departments' | 'raters'; ok: boolean; label: string }>;
    /** Non-blocking: ratees a disabled section hides from the raters (absent on older payloads). */
    warnings?: Array<{ key: 'teamHidden' | 'peopleHidden'; label: string }>;
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
    /** HC per PIC: respondents pick the PICs who served them (opt-in; default = HC decides). */
    respondentPicks?: boolean;
    /** HC "respondents pick": target number of respondents (participation basis). */
    targetRespondents?: number | null;
    /** HC "who rates whom" per respondent unit (the source of raters + pairs when set). */
    unitRules?: import('./hcTypes').CsiUnitRule[];
    slaTargetPct: number;
    /** Score colour bands of the survey: orange from scoreFairMin, green from scoreGoodMin (1–5, one decimal). */
    scoreFairMin: number;
    scoreGoodMin: number;
    createdById: string;
    /** "Siapa menilai siapa": null until chosen in the wizard. */
    pairMode?: CsiPairMode | null;
    cancelledAt?: string | null;
    cancelReason?: string | null;
}
export interface ConfirmCsiPeriodAction { confirmTitle: string; reason: string }

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
    /** HC PIC ratee (csi_pics) with its layanan / bagian snapshot. */
    picId?: string | null;
    serviceCode?: string | null;
    bagian?: string | null;
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
    /** Opening message configured on the period; absent on older payloads. */
    intro?: string;
    /** Last day (YYYY-MM-DD); absent on older payloads. */
    endDate?: string;
    submitted: boolean;
    /** When this account answered (ISO), or null. */
    submittedAt?: string | null;
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
    /** HC PIC: fungsi pelayanan snapshot; null otherwise. */
    serviceFunction?: string | null;
    /** Kept for compatibility; equals photoUrl. */
    avatarUrl: string | null;
    siteId: string | null;
    siteCode: string | null;
    tagline: string | null;
    photoUrl: string | null;
    /** HC PIC ratee: layanan (HCC/HCD/HCS) and bagian; absent / null for teams and ICT people. */
    picId?: string | null;
    serviceCode?: string | null;
    serviceName?: string | null;
    bagian?: string | null;
    dimensions: CsiFormDimension[];
}

/** One answer per account: the identity (name, and the department once known) is locked to the account. */
export interface CsiForm {
    id: string;
    scope: CsiScope;
    title: string;
    intro: string;
    endDate: string;
    teamLabel: string;
    /** HC per PIC: the respondent first picks the PICs who served them and rates only those. */
    respondentPicks?: boolean;
    /** `departmentId`: the department the account is locked to in this list (null = choose once). */
    respondent: { fullName: string; departmentId?: string | null };
    /** When this account answered (ISO), or null / absent when it has not. */
    submittedAt?: string | null;
    /** @deprecated older servers; the account name once it has answered. */
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
    serviceCode?: string | null;
    bagian?: string | null;
    serviceFunction?: string | null;
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
    /** Score colour bands of the survey (every tone and predikat of the report). */
    scoreBands: CsiScoreBands;
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
    /** LISTED only: raters per department (directory department), without names. */
    pendingByDepartment?: Array<{ department: string; pending: number; total: number }> | null;
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
    respondentPicks?: boolean;
    targetRespondents?: number | null;
    slaTargetPct?: number;
    scoreFairMin?: number;
    scoreGoodMin?: number;
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
export interface CsiTeamMemberView { id: string; name: string; userId: string | null }
export interface CsiSubjectView {
    /** `user:<userId>`, `team:<teamId>` or `pic:<picId>` (HC PIC master, account optional). */
    key: string;
    kind: CsiRateeKind;
    userId: string | null;
    teamId: string | null;
    siteId: string;
    name: string;
    jobTitle: string | null;
    photoUrl: string | null;
    tagline: string | null;
    /** Fungsi pelayanan (people only). */
    serviceFunction: string | null;
    /** Teams only: SITE (one per site) or CUSTOM (HC). */
    teamKind: 'SITE' | 'CUSTOM' | null;
    /** HC layanan (HCC/HCD/HCS) of a PIC or a custom team. */
    serviceCode: string | null;
    picId: string | null;
    /** False for HC PICs without an iDesk account ("Belum punya akun") and for teams. */
    hasAccount: boolean;
    /** Custom teams only. */
    members?: CsiTeamMemberView[];
}
export interface CsiSubjectGroup {
    siteId: string;
    siteCode: string;
    siteName: string;
    /** The SITE team. */
    team: CsiSubjectView | null;
    /** HC custom teams ([] for ICT). */
    teams: CsiSubjectView[];
    people: CsiSubjectView[];
}
/** Empty / null clears tagline and jobTitle; `name` applies to team subjects only. */
export interface UpdateCsiSubject { tagline?: string | null; jobTitle?: string | null; serviceFunction?: string | null; name?: string }
export interface CreateCsiTeam { siteId: string; kind?: 'SITE' | 'CUSTOM'; name?: string; serviceCode?: string }
export interface CreateCsiCustomTeam { siteId: string; name: string; serviceCode: string }
export interface UpdateCsiCustomTeam { name?: string; serviceCode?: string }
export interface CsiTeamMemberInput { userId?: string; name?: string }
export interface CsiTeamSurveyRef { periodId: string; title: string }
/**
 * Dry run of deleting a team: `blocked` surveys (running or already answered) refuse the delete; the team leaves each
 * draft / not-yet-started survey, and `teamSectionOff` drafts lose their last team (team section switched off);
 * `finishedSurveys` (ended or cancelled) keep it, so it is deactivated instead.
 */
export interface CsiTeamDeleteImpact {
    blocked: Array<CsiTeamSurveyRef & { reason: 'running' | 'answered' }>;
    draftSurveys: CsiTeamSurveyRef[];
    teamSectionOff: CsiTeamSurveyRef[];
    finishedSurveys: number;
}

// ─── "Siapa menilai siapa" (respondents × subjects) ─────────────────────────
export interface CsiRaterMatrix {
    subjects: Array<{ periodRateeId: string; kind: CsiRateeKind; displayName: string; siteId: string | null }>;
    rows: Array<{
        responseId: string; respondentName: string; departmentName: string; areaName: string | null; submittedAt: string;
        scores: Array<number | null>; average: number | null;
    }>;
    totals: Array<{ raters: number; average: number | null }>;
}

/** A published survey of the scope whose sites and dates intersect the ones being edited. */
export interface CsiPeriodOverlap { id: string; title: string; startDate: string; endDate: string; sites: CsiSiteSummary[] }

// ─── Bulk rater registration ─────────────────────────────────────────────────
export interface CsiRaterGroupFilter { siteId?: string; departmentId?: string }
export interface CsiRaterGroupPreview { total: number; alreadyRegistered: number; toAdd: number; sample: string[] }
export interface CsiTicketRaterFilter { siteId?: string; startDate?: string; endDate?: string; includeAllRoles?: boolean }
export interface CsiTicketRaterSiteSummary { code: string; name: string; total: number; toAdd: number }
export interface CsiTicketRaterPreview extends CsiRaterGroupPreview { bySite: CsiTicketRaterSiteSummary[] }
export interface CsiRaterDepartmentOption { id: string; name: string; userCount: number }
export interface CsiRaterImportResult {
    matched: number; alreadyRegistered: number; toAdd: number; added: number; notFound: string[]; sample: string[];
}

// ─── Reusable question sets (Master data) ──────────────────────────────────
export interface CsiQuestionSet { id: string; scope: CsiScope; name: string; dimensionIds: string[] }
export interface SaveCsiQuestionSet { name: string; dimensionIds: string[] }

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
    /** Units behind `average` (HC: ratings, 1 respondent × 1 PIC; ICT: responses): weight when sites are combined. */
    scoreWeight: number;
    /** Score colour bands of the row's survey. */
    scoreBands: CsiScoreBands;
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

/** "Hasil penilaian saya": anonymous results about the signed-in account (scores only from `minRaters` raters on). */
export interface CsiSelfResult {
    periodId: string; title: string; startDate: string; endDate: string; status: 'UPCOMING' | 'ACTIVE' | 'ENDED';
    serviceFunction: string | null; teamName: string | null; raters: number; minRaters: number; ready: boolean;
    average: number | null; dimensions: Array<{ label: string; average: number }>; comments: string[];
    /** Score colour bands of the survey. */
    scoreBands: CsiScoreBands;
}
