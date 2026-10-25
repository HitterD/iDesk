import api from '@/lib/api';
import type {
    CsiActivePeriod, CsiDepartment, CsiDimension, CsiForm, CsiPeriod, CsiPeriodDetail,
    CsiPeriodListItem, CsiRater, CsiRemovedRater, CsiReport, CsiResetResult, CsiRespondents,
    CsiResponseDetail, CsiScopeParam, CsiSubmitResult, CsiUserIds, CsiUserSearchResult,
    CreateCsiDepartment, CreateCsiDimension, CreateCsiPeriod, ResetCsiResponse,
    SetCsiRatees, SubmitCsiResponse, UpdateCsiDepartment, UpdateCsiDimension, UpdateCsiPeriod,
} from '../types';

const adminPath = (scope: CsiScopeParam) => `/csi/admin/${scope}`;
const periodPath = (scope: CsiScopeParam, id: string) => `${adminPath(scope)}/periods/${encodeURIComponent(id)}`;
const itemPath = (scope: CsiScopeParam, resource: string, id: string) =>
    `${adminPath(scope)}/${resource}/${encodeURIComponent(id)}`;

function exportFilename(disposition: unknown, scope: CsiScopeParam): string {
    const fallback = `csi-${scope}.xlsx`;
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
        return (await api.post<CsiDimension>(`${adminPath(scope)}/dimensions`, payload)).data;
    },
    async updateDimension(scope: CsiScopeParam, id: string, payload: UpdateCsiDimension): Promise<CsiDimension> {
        return (await api.patch<CsiDimension>(itemPath(scope, 'dimensions', id), payload)).data;
    },
    async deactivateDimension(scope: CsiScopeParam, id: string): Promise<CsiDimension> {
        return (await api.delete<CsiDimension>(itemPath(scope, 'dimensions', id))).data;
    },
    async departments(scope: CsiScopeParam, includeInactive = false): Promise<CsiDepartment[]> {
        return (await api.get<CsiDepartment[]>(`${adminPath(scope)}/departments`, { params: { includeInactive } })).data;
    },
    async createDepartment(scope: CsiScopeParam, payload: CreateCsiDepartment): Promise<CsiDepartment> {
        return (await api.post<CsiDepartment>(`${adminPath(scope)}/departments`, payload)).data;
    },
    async updateDepartment(scope: CsiScopeParam, id: string, payload: UpdateCsiDepartment): Promise<CsiDepartment> {
        return (await api.patch<CsiDepartment>(itemPath(scope, 'departments', id), payload)).data;
    },
    async deactivateDepartment(scope: CsiScopeParam, id: string): Promise<CsiDepartment> {
        return (await api.delete<CsiDepartment>(itemPath(scope, 'departments', id))).data;
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
    async deletePeriod(scope: CsiScopeParam, id: string): Promise<CsiPeriod> {
        return (await api.delete<CsiPeriod>(periodPath(scope, id))).data;
    },
    async setRatees(scope: CsiScopeParam, id: string, payload: SetCsiRatees): Promise<CsiPeriodDetail> {
        return (await api.put<CsiPeriodDetail>(`${periodPath(scope, id)}/ratees`, payload)).data;
    },
    async setRaters(scope: CsiScopeParam, id: string, payload: CsiUserIds): Promise<CsiPeriodDetail> {
        return (await api.put<CsiPeriodDetail>(`${periodPath(scope, id)}/raters`, payload)).data;
    },
    async report(scope: CsiScopeParam, id: string): Promise<CsiReport> {
        return (await api.get<CsiReport>(`${periodPath(scope, id)}/report`)).data;
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
        const response = await api.get<Blob>(`${periodPath(scope, id)}/export`, { responseType: 'blob' });
        return { blob: response.data, filename: exportFilename(response.headers['content-disposition'], scope) };
    },
};
