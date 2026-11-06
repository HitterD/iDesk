import api from '@/lib/api';
import type { CsiPeriodDetail, CsiScopeParam } from '../types';
import type { CsiDirectoryImportResult, CsiHcRater, CsiHcRecap, CsiPairsImportReport, CsiPicView, CsiUnitOption, CsiUnitRule, SetCsiPeriodPics } from '../hcTypes';

const orgPath = (scope: CsiScopeParam) => `/csi/admin/${scope}/org`;
const periodPath = (scope: CsiScopeParam, id: string) => `/csi/admin/${scope}/periods/${encodeURIComponent(id)}`;
/** Multipart field expected by the backend FileInterceptor('file'). */
const FILE_FIELD = 'file';

export const CsiHcApi = {
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
    async setPicActive(scope: CsiScopeParam, id: string, isActive: boolean): Promise<CsiPicView> {
        return (await api.patch<CsiPicView>(`${orgPath(scope)}/pics/${encodeURIComponent(id)}`, { isActive })).data;
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
