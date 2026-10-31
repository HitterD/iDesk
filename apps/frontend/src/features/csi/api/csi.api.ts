import api from '@/lib/api';
import type {
    CsiActivePeriod, CsiAssignments, CsiDashboard, CsiDepartment, CsiDimension, CsiForm, CsiPeriod, CsiPeriodDetail,
    CsiPeriodListItem, CsiRater, CsiReminderResult, CsiRemovedRater, CsiReport, CsiResetResult, CsiRespondents,
    CsiResponseDetail, CsiScopeParam, CsiSubjectGroup, CsiSubjectView, CsiSubmitResult, CsiUserIds, CsiUserSearchResult,
    CreateCsiDepartment, CreateCsiDimension, CreateCsiPeriod, CreateCsiTeam, CsiMemoHeader, CsiMemoRequest, CsiReorder,
    ResetCsiResponse, SendCsiReminders, SetCsiAssignments, SetCsiRatees, SetCsiTeamQuestions, SubmitCsiResponse,
    UpdateCsiDepartment, UpdateCsiDimension, UpdateCsiPeriod, UpdateCsiPeriodRatee, UpdateCsiSubject,
} from '../types';

const adminPath = (scope: CsiScopeParam) => `/csi/admin/${scope}`;
const periodPath = (scope: CsiScopeParam, id: string) => `${adminPath(scope)}/periods/${encodeURIComponent(id)}`;
const itemPath = (scope: CsiScopeParam, resource: string, id: string) =>
    `${adminPath(scope)}/${resource}/${encodeURIComponent(id)}`;
const assignmentsPath = (scope: CsiScopeParam, id: string) => `${periodPath(scope, id)}/assignments`;
/** Multipart field name expected by the subject photo upload (FileInterceptor('file')). */
const PHOTO_FIELD = 'file';

function exportFilename(disposition: unknown, scope: CsiScopeParam, extension = 'xlsx'): string {
    const fallback = `csi-${scope}.${extension}`;
    if (typeof disposition !== 'string') return fallback;
    const filename = /filename="([^"]+)"/i.exec(disposition)?.[1]
        ?? /filename=([^;\s]+)/i.exec(disposition)?.[1];
    // Never pass paths or control characters from a response header to a download link.
    // eslint-disable-next-line no-control-regex -- intentionally strip unsafe header characters
    return filename?.split(/[\\/]/).pop()?.replace(/[\x00-\x1f\x7f]/g, '').trim() || fallback;
}

export const CsiApi = {
    async active(): Promise<CsiActivePeriod[]> {
        // Background nav probe: a failure just hides the entry point, no toast.
        return (await api.get<CsiActivePeriod[]>('/csi/me/active', { skipToast: true })).data;
    },
    async form(id: string): Promise<CsiForm> {
        // The survey page renders 404/410 inline instead of a toast.
        return (await api.get<CsiForm>(`/csi/me/periods/${encodeURIComponent(id)}`, { skipToast: true })).data;
    },
    async submit(id: string, payload: SubmitCsiResponse): Promise<CsiSubmitResult> {
        return (await api.post<CsiSubmitResult>(`/csi/me/periods/${encodeURIComponent(id)}/responses`, payload, { skipToast: true })).data;
    },
    async dimensions(scope: CsiScopeParam, includeInactive = false): Promise<CsiDimension[]> {
        return (await api.get<CsiDimension[]>(`${adminPath(scope)}/dimensions`, { params: { includeInactive } })).data;
    },
    async createDimension(scope: CsiScopeParam, payload: CreateCsiDimension): Promise<CsiDimension> {
        return (await api.post<CsiDimension>(`${adminPath(scope)}/dimensions`, payload, { skipToast: true })).data;
    },
    async updateDimension(scope: CsiScopeParam, id: string, payload: UpdateCsiDimension): Promise<CsiDimension> {
        // Inline autosave renders its own error text next to the field, so no toast.
        return (await api.patch<CsiDimension>(itemPath(scope, 'dimensions', id), payload, { skipToast: true })).data;
    },
    async reorderDimensions(scope: CsiScopeParam, payload: CsiReorder): Promise<CsiDimension[]> {
        return (await api.put<CsiDimension[]>(`${adminPath(scope)}/dimensions/order`, payload)).data;
    },
    async applyTemplate(scope: CsiScopeParam): Promise<CsiDimension[]> {
        return (await api.post<CsiDimension[]>(`${adminPath(scope)}/dimensions/template`)).data;
    },
    async departments(scope: CsiScopeParam, includeInactive = false): Promise<CsiDepartment[]> {
        return (await api.get<CsiDepartment[]>(`${adminPath(scope)}/departments`, { params: { includeInactive } })).data;
    },
    async createDepartment(scope: CsiScopeParam, payload: CreateCsiDepartment): Promise<CsiDepartment> {
        return (await api.post<CsiDepartment>(`${adminPath(scope)}/departments`, payload, { skipToast: true })).data;
    },
    async updateDepartment(scope: CsiScopeParam, id: string, payload: UpdateCsiDepartment): Promise<CsiDepartment> {
        // Inline autosave renders its own error text next to the field, so no toast.
        return (await api.patch<CsiDepartment>(itemPath(scope, 'departments', id), payload, { skipToast: true })).data;
    },
    async reorderDepartments(scope: CsiScopeParam, payload: CsiReorder): Promise<CsiDepartment[]> {
        return (await api.put<CsiDepartment[]>(`${adminPath(scope)}/departments/order`, payload)).data;
    },
    async raters(scope: CsiScopeParam): Promise<CsiRater[]> {
        return (await api.get<CsiRater[]>(`${adminPath(scope)}/raters`)).data;
    },
    async addRaters(scope: CsiScopeParam, payload: CsiUserIds): Promise<CsiRater[]> {
        return (await api.post<CsiRater[]>(`${adminPath(scope)}/raters`, payload)).data;
    },
    async removeRater(scope: CsiScopeParam, id: string): Promise<CsiRemovedRater> {
        return (await api.delete<CsiRemovedRater>(itemPath(scope, 'raters', id))).data;
    },
    async userSearch(scope: CsiScopeParam, search: string, limit?: number): Promise<CsiUserSearchResult[]> {
        return (await api.get<CsiUserSearchResult[]>(`${adminPath(scope)}/users`, { params: { search, limit } })).data;
    },
    async periods(scope: CsiScopeParam, siteId?: string): Promise<CsiPeriodListItem[]> {
        return (await api.get<CsiPeriodListItem[]>(`${adminPath(scope)}/periods`, { params: { siteId } })).data;
    },
    async period(scope: CsiScopeParam, id: string): Promise<CsiPeriodDetail> {
        return (await api.get<CsiPeriodDetail>(periodPath(scope, id))).data;
    },
    async createPeriod(scope: CsiScopeParam, payload: CreateCsiPeriod): Promise<CsiPeriodDetail> {
        return (await api.post<CsiPeriodDetail>(`${adminPath(scope)}/periods`, payload)).data;
    },
    async updatePeriod(scope: CsiScopeParam, id: string, payload: UpdateCsiPeriod): Promise<CsiPeriodDetail> {
        return (await api.patch<CsiPeriodDetail>(periodPath(scope, id), payload)).data;
    },
    async publishPeriod(scope: CsiScopeParam, id: string): Promise<CsiPeriodDetail> {
        return (await api.post<CsiPeriodDetail>(`${periodPath(scope, id)}/publish`)).data;
    },
    async unpublishPeriod(scope: CsiScopeParam, id: string): Promise<CsiPeriodDetail> {
        return (await api.post<CsiPeriodDetail>(`${periodPath(scope, id)}/unpublish`)).data;
    },
    async deletePeriod(scope: CsiScopeParam, id: string): Promise<CsiPeriod> {
        return (await api.delete<CsiPeriod>(periodPath(scope, id))).data;
    },
    async setRatees(scope: CsiScopeParam, id: string, payload: SetCsiRatees): Promise<CsiPeriodDetail> {
        return (await api.put<CsiPeriodDetail>(`${periodPath(scope, id)}/ratees`, payload)).data;
    },
    async setTeamQuestions(scope: CsiScopeParam, id: string, payload: SetCsiTeamQuestions): Promise<CsiPeriodDetail> {
        return (await api.put<CsiPeriodDetail>(`${periodPath(scope, id)}/team`, payload)).data;
    },
    async setRaters(scope: CsiScopeParam, id: string, payload: CsiUserIds): Promise<CsiPeriodDetail> {
        return (await api.put<CsiPeriodDetail>(`${periodPath(scope, id)}/raters`, payload)).data;
    },
    async updatePeriodRatee(scope: CsiScopeParam, id: string, periodRateeId: string, payload: UpdateCsiPeriodRatee): Promise<CsiPeriodDetail> {
        return (await api.patch<CsiPeriodDetail>(`${periodPath(scope, id)}/ratees/${encodeURIComponent(periodRateeId)}`, payload)).data;
    },
    async subjects(scope: CsiScopeParam): Promise<CsiSubjectGroup[]> {
        return (await api.get<CsiSubjectGroup[]>(`${adminPath(scope)}/subjects`)).data;
    },
    async updateSubject(scope: CsiScopeParam, key: string, payload: UpdateCsiSubject): Promise<CsiSubjectView> {
        return (await api.put<CsiSubjectView>(itemPath(scope, 'subjects', key), payload)).data;
    },
    async uploadSubjectPhoto(scope: CsiScopeParam, key: string, file: File): Promise<CsiSubjectView> {
        const body = new FormData();
        body.append(PHOTO_FIELD, file);
        return (await api.post<CsiSubjectView>(`${itemPath(scope, 'subjects', key)}/photo`, body)).data;
    },
    async createTeam(scope: CsiScopeParam, payload: CreateCsiTeam): Promise<CsiSubjectView> {
        return (await api.post<CsiSubjectView>(`${adminPath(scope)}/subjects/teams`, payload)).data;
    },
    async assignments(scope: CsiScopeParam, id: string): Promise<CsiAssignments> {
        return (await api.get<CsiAssignments>(assignmentsPath(scope, id))).data;
    },
    async setAssignments(scope: CsiScopeParam, id: string, payload: SetCsiAssignments): Promise<CsiAssignments> {
        return (await api.put<CsiAssignments>(assignmentsPath(scope, id), payload)).data;
    },
    async autoAssignSameSite(scope: CsiScopeParam, id: string): Promise<CsiAssignments> {
        return (await api.post<CsiAssignments>(`${assignmentsPath(scope, id)}/auto-same-site`)).data;
    },
    async saveAssignmentTemplate(scope: CsiScopeParam, id: string): Promise<CsiAssignments> {
        return (await api.post<CsiAssignments>(`${assignmentsPath(scope, id)}/save-template`)).data;
    },
    async applyAssignmentTemplate(scope: CsiScopeParam, id: string): Promise<CsiAssignments> {
        return (await api.post<CsiAssignments>(`${assignmentsPath(scope, id)}/apply-template`)).data;
    },
    async report(scope: CsiScopeParam, id: string, siteId?: string): Promise<CsiReport> {
        return (await api.get<CsiReport>(`${periodPath(scope, id)}/report`, { params: { siteId } })).data;
    },
    async sendReminders(scope: CsiScopeParam, id: string, payload: SendCsiReminders = {}): Promise<CsiReminderResult> {
        return (await api.post<CsiReminderResult>(`${periodPath(scope, id)}/reminders`, payload)).data;
    },
    async dashboard(scope: CsiScopeParam): Promise<CsiDashboard> {
        return (await api.get<CsiDashboard>(`${adminPath(scope)}/dashboard`)).data;
    },
    async respondents(scope: CsiScopeParam, id: string): Promise<CsiRespondents> {
        return (await api.get<CsiRespondents>(`${periodPath(scope, id)}/respondents`)).data;
    },
    async responseDetail(scope: CsiScopeParam, id: string, responseId: string): Promise<CsiResponseDetail> {
        return (await api.get<CsiResponseDetail>(`${periodPath(scope, id)}/responses/${encodeURIComponent(responseId)}`)).data;
    },
    async resetResponse(scope: CsiScopeParam, id: string, responseId: string, payload: ResetCsiResponse): Promise<CsiResetResult> {
        return (await api.delete<CsiResetResult>(`${periodPath(scope, id)}/responses/${encodeURIComponent(responseId)}`, { data: payload })).data;
    },
    async exportPeriod(scope: CsiScopeParam, id: string): Promise<{ blob: Blob; filename: string }> {
        // A blob error body hides the server message from the interceptor; the caller shows one toast instead.
        const response = await api.get<Blob>(`${periodPath(scope, id)}/export`, { responseType: 'blob', skipToast: true });
        return { blob: response.data, filename: exportFilename(response.headers['content-disposition'], scope) };
    },
    async memoSettings(scope: CsiScopeParam): Promise<CsiMemoHeader> {
        return (await api.get<CsiMemoHeader>(`${adminPath(scope)}/memo-settings`)).data;
    },
    async saveMemoSettings(scope: CsiScopeParam, payload: CsiMemoHeader): Promise<CsiMemoHeader> {
        return (await api.put<CsiMemoHeader>(`${adminPath(scope)}/memo-settings`, payload)).data;
    },
    async exportMemo(scope: CsiScopeParam, payload: CsiMemoRequest): Promise<{ blob: Blob; filename: string }> {
        // A blob error body hides the server message from the interceptor; the caller shows one toast instead.
        const response = await api.post<Blob>(`${adminPath(scope)}/reports/memo`, payload, { responseType: 'blob', skipToast: true });
        return { blob: response.data, filename: exportFilename(response.headers['content-disposition'], scope, 'pdf') };
    },
};
