import api from '@/lib/api';
import type { CsiPeriodDetail, CsiScopeParam } from '../types';
import type { CsiDirectoryImportResult, CsiHcRater, CsiHcRecap, CsiPairsImportReport, CsiPicView, CsiReportAccess, CsiReportPeriods, CsiServiceReport, CsiServiceReportOwners, CsiUnitOption, CsiUnitRule, SetCsiPeriodPics } from '../hcTypes';

const orgPath = (scope: CsiScopeParam) => `/csi/admin/${scope}/org`;
const periodPath = (scope: CsiScopeParam, id: string) => `/csi/admin/${scope}/periods/${encodeURIComponent(id)}`;
/** Multipart field expected by the backend FileInterceptor('file'). */
const FILE_FIELD = 'file';

const meHcPath = '/csi/me/hc';
const serviceReportPath = (periodId: string, serviceCode: string) =>
    `${meHcPath}/periods/${encodeURIComponent(periodId)}/services/${encodeURIComponent(serviceCode)}`;

export const CsiHcApi = {
    async myReportAccess(): Promise<CsiReportAccess> {
        return (await api.get<CsiReportAccess>(`${meHcPath}/report-access`, { skipToast: true })).data;
    },
    async myReportPeriods(): Promise<CsiReportPeriods> {
        return (await api.get<CsiReportPeriods>(`${meHcPath}/periods`)).data;
    },
    async myServiceReport(periodId: string, serviceCode: string): Promise<CsiServiceReport> {
        return (await api.get<CsiServiceReport>(`${serviceReportPath(periodId, serviceCode)}/report`)).data;
    },
    async myServiceReportExport(periodId: string, serviceCode: string): Promise<Blob> {
        return (await api.get<Blob>(`${serviceReportPath(periodId, serviceCode)}/export`, { responseType: 'blob', skipToast: true })).data;
    },
    async reportOwners(scope: CsiScopeParam): Promise<CsiServiceReportOwners[]> {
        return (await api.get<CsiServiceReportOwners[]>(`/csi/admin/${scope}/report-owners`)).data;
    },
    async setReportOwners(scope: CsiScopeParam, serviceCode: string, userIds: string[]): Promise<CsiServiceReportOwners[]> {
        return (await api.put<CsiServiceReportOwners[]>(`/csi/admin/${scope}/report-owners/${encodeURIComponent(serviceCode)}`, { userIds })).data;
    },
    async directory(scope: CsiScopeParam): Promise<{ people: number }> {
        return (await api.get<{ people: number }>(`${orgPath(scope)}/directory`)).data;
    },
    async importDirectory(scope: CsiScopeParam, file: File): Promise<CsiDirectoryImportResult> {
        const body = new FormData();
        body.append(FILE_FIELD, file);
        return (await api.post<CsiDirectoryImportResult>(`${orgPath(scope)}/directory/import`, body)).data;
    },
    async pics(scope: CsiScopeParam, includeInactive = false): Promise<CsiPicView[]> {
        return (await api.get<CsiPicView[]>(`${orgPath(scope)}/pics`, { params: { includeInactive } })).data;
    },
    async updatePic(scope: CsiScopeParam, id: string, patch: { isActive?: boolean; serviceFunction?: string | null }): Promise<CsiPicView> {
        return (await api.patch<CsiPicView>(`${orgPath(scope)}/pics/${encodeURIComponent(id)}`, patch)).data;
    },
    async uploadPicPhoto(scope: CsiScopeParam, id: string, file: File): Promise<CsiPicView> {
        const body = new FormData();
        body.append(FILE_FIELD, file);
        return (await api.post<CsiPicView>(`${orgPath(scope)}/pics/${encodeURIComponent(id)}/photo`, body)).data;
    },
    async setPeriodPics(scope: CsiScopeParam, id: string, payload: SetCsiPeriodPics): Promise<CsiPeriodDetail> {
        return (await api.put<CsiPeriodDetail>(`${periodPath(scope, id)}/pics`, payload)).data;
    },
    async units(scope: CsiScopeParam): Promise<CsiUnitOption[]> {
        return (await api.get<CsiUnitOption[]>(`${orgPath(scope)}/units`)).data;
    },
    async previewRules(scope: CsiScopeParam, id: string, rules: CsiUnitRule[]): Promise<{ raters: number; pairs: number }> {
        return (await api.post<{ raters: number; pairs: number }>(`${orgPath(scope)}/periods/${encodeURIComponent(id)}/unit-rules/preview`, { rules })).data;
    },
    async applyRules(scope: CsiScopeParam, id: string, rules: CsiUnitRule[]): Promise<{ raters: number; pairs: number; unmatched: number }> {
        return (await api.put<{ raters: number; pairs: number; unmatched: number }>(`${orgPath(scope)}/periods/${encodeURIComponent(id)}/unit-rules`, { rules })).data;
    },
    async raters(scope: CsiScopeParam, id: string): Promise<CsiHcRater[]> {
        return (await api.get<CsiHcRater[]>(`${orgPath(scope)}/periods/${encodeURIComponent(id)}/raters`)).data;
    },
    async setRater(scope: CsiScopeParam, id: string, userId: string, periodRateeIds: string[]): Promise<CsiHcRater[]> {
        return (await api.put<CsiHcRater[]>(`${orgPath(scope)}/periods/${encodeURIComponent(id)}/raters/${encodeURIComponent(userId)}`, { periodRateeIds })).data;
    },
    async exportPairs(scope: CsiScopeParam, id: string): Promise<Blob> {
        return (await api.get<Blob>(`${orgPath(scope)}/periods/${encodeURIComponent(id)}/pairs.xlsx`, { responseType: 'blob', skipToast: true })).data;
    },
    async importPairs(scope: CsiScopeParam, id: string, file: File, commit: boolean): Promise<CsiPairsImportReport> {
        const body = new FormData();
        body.append(FILE_FIELD, file);
        return (await api.post<CsiPairsImportReport>(`${orgPath(scope)}/periods/${encodeURIComponent(id)}/pairs/import`, body, { params: { commit } })).data;
    },
    async hcRecap(scope: CsiScopeParam, id: string): Promise<CsiHcRecap> {
        return (await api.get<CsiHcRecap>(`${periodPath(scope, id)}/hc-recap`)).data;
    },
};
