import api from '@/lib/api';
import { exportFilename } from './csi.api';
import type { CsiPeriodDetail, CsiScopeParam } from '../types';
import type { AccountSuggestion, ApplyCsiTemplates, CreateCsiPeriodFromTemplates, CsiTemplateApplyManyReport, CsiPeriodFromTemplatesResult, CsiTemplateImportOptions } from '../hcTypes';
import type { CsiDirectoryImportResult, CsiHcRater, CsiHcRecap, CsiPairsImportReport, CsiPicView, CsiReportAccess, CsiReportPeriods, CsiServiceReport, CsiServiceReportOwners, CsiTemplate, CsiTemplateApplyReport, CsiTemplateImportReport, CsiTemplateList, CsiUnitOption, CsiUnitRule, SetCsiPeriodPics, UpdateCsiPic } from '../hcTypes';

const orgPath = (scope: CsiScopeParam) => `/csi/admin/${scope}/org`;
const periodPath = (scope: CsiScopeParam, id: string) => `/csi/admin/${scope}/periods/${encodeURIComponent(id)}`;
/** Multipart field expected by the backend FileInterceptor('file'). */
const FILE_FIELD = 'file';

const mePath = (scope: CsiScopeParam) => `/csi/me/${scope}`;
const serviceReportPath = (scope: CsiScopeParam, periodId: string, serviceCode: string) =>
    `${mePath(scope)}/periods/${encodeURIComponent(periodId)}/services/${encodeURIComponent(serviceCode)}`;

const templatePath = (scope: CsiScopeParam) => `/csi/admin/${scope}/templates`;

export const CsiHcApi = {
    async templates(scope: CsiScopeParam): Promise<CsiTemplateList> {
        return (await api.get<CsiTemplateList>(templatePath(scope))).data;
    },
    async loadBundledTemplate(scope: CsiScopeParam, location: string): Promise<CsiTemplate> {
        return (await api.post<CsiTemplate>(`${templatePath(scope)}/bundled/${encodeURIComponent(location)}`)).data;
    },
    async importTemplate(scope: CsiScopeParam, location: string, file: File, options: CsiTemplateImportOptions): Promise<CsiTemplateImportReport> {
        const body = new FormData();
        body.append(FILE_FIELD, file);
        body.append('options', JSON.stringify(options));
        return (await api.post<CsiTemplateImportReport>(`${templatePath(scope)}/import/${encodeURIComponent(location)}`, body)).data;
    },
    async templateAccountSuggestions(scope: CsiScopeParam, templateId: string, name: string): Promise<AccountSuggestion[]> {
        return (await api.get<AccountSuggestion[]>(`${templatePath(scope)}/${encodeURIComponent(templateId)}/account-suggestions`, { params: { name } })).data;
    },
    async setTemplateRaterAccount(scope: CsiScopeParam, raterIds: string[], userId: string | null): Promise<CsiTemplate> {
        return (await api.put<CsiTemplate>(`${templatePath(scope)}/raters/account`, { raterIds, userId })).data;
    },
    async confirmTemplateRaters(scope: CsiScopeParam, raterIds: string[], confirmed: boolean): Promise<CsiTemplate> {
        return (await api.put<CsiTemplate>(`${templatePath(scope)}/raters/confirm`, { raterIds, confirmed })).data;
    },
    async downloadBlankTemplate(scope: CsiScopeParam, location: string): Promise<Blob> {
        return (await api.get<Blob>(`${templatePath(scope)}/blank/${encodeURIComponent(location)}`, { responseType: 'blob', skipToast: true })).data;
    },
    async createPeriodFromTemplates(scope: CsiScopeParam, body: CreateCsiPeriodFromTemplates): Promise<CsiPeriodFromTemplatesResult> {
        return (await api.post<CsiPeriodFromTemplatesResult>(`${templatePath(scope)}/create-period`, body)).data;
    },
    async previewPeriodFromTemplates(scope: CsiScopeParam, templateIds: string[]): Promise<CsiTemplateApplyReport> {
        return (await api.post<CsiTemplateApplyReport>(`${templatePath(scope)}/preview-period`, { templateIds })).data;
    },
    async addTemplatePic(scope: CsiScopeParam, templateId: string, body: { serviceCode: string; picName: string; jobTitle?: string; serviceFunction?: string }): Promise<CsiTemplate> {
        return (await api.post<CsiTemplate>(`${templatePath(scope)}/${encodeURIComponent(templateId)}/pics`, body)).data;
    },
    async updateTemplatePic(scope: CsiScopeParam, picId: string, body: { jobTitle?: string | null; serviceFunction?: string | null }): Promise<CsiTemplate> {
        return (await api.patch<CsiTemplate>(`${templatePath(scope)}/pics/${encodeURIComponent(picId)}`, body)).data;
    },
    async removeTemplatePic(scope: CsiScopeParam, picId: string): Promise<CsiTemplate> {
        return (await api.delete<CsiTemplate>(`${templatePath(scope)}/pics/${encodeURIComponent(picId)}`)).data;
    },
    async addTemplateRater(scope: CsiScopeParam, picId: string, body: { name?: string; userId?: string }): Promise<CsiTemplate> {
        return (await api.post<CsiTemplate>(`${templatePath(scope)}/pics/${encodeURIComponent(picId)}/raters`, body)).data;
    },
    async removeTemplateRater(scope: CsiScopeParam, raterId: string): Promise<CsiTemplate> {
        return (await api.delete<CsiTemplate>(`${templatePath(scope)}/raters/${encodeURIComponent(raterId)}`)).data;
    },
    async applyTemplate(scope: CsiScopeParam, templateId: string, periodId: string, commit: boolean): Promise<CsiTemplateApplyReport> {
        return (await api.post<CsiTemplateApplyReport>(`${templatePath(scope)}/${encodeURIComponent(templateId)}/apply/${encodeURIComponent(periodId)}`, null, { params: { commit } })).data;
    },
    /** Several location templates into one survey (dry run unless commit); replaceNonPic drops people who are no PIC. */
    async applyTemplates(scope: CsiScopeParam, periodId: string, body: ApplyCsiTemplates, commit: boolean): Promise<CsiTemplateApplyManyReport> {
        return (await api.post<CsiTemplateApplyManyReport>(`${templatePath(scope)}/apply-many/${encodeURIComponent(periodId)}`, body, { params: { commit }, skipToast: true })).data;
    },
    async myReportAccess(scope: CsiScopeParam): Promise<CsiReportAccess> {
        return (await api.get<CsiReportAccess>(`${mePath(scope)}/report-access`, { skipToast: true })).data;
    },
    async myReportPeriods(scope: CsiScopeParam): Promise<CsiReportPeriods> {
        return (await api.get<CsiReportPeriods>(`${mePath(scope)}/periods`)).data;
    },
    async myServiceReport(scope: CsiScopeParam, periodId: string, serviceCode: string): Promise<CsiServiceReport> {
        return (await api.get<CsiServiceReport>(`${serviceReportPath(scope, periodId, serviceCode)}/report`)).data;
    },
    async myServiceReportExport(scope: CsiScopeParam, periodId: string, serviceCode: string): Promise<{ blob: Blob; filename: string }> {
        const response = await api.get<Blob>(`${serviceReportPath(scope, periodId, serviceCode)}/export`, { responseType: 'blob', skipToast: true });
        return { blob: response.data, filename: exportFilename(response.headers['content-disposition'], scope) };
    },
    /** Raw ratings of the owner's own service (rater names; ratings about the owner stay anonymous). */
    async myServiceReportRawExport(scope: CsiScopeParam, periodId: string, serviceCode: string): Promise<{ blob: Blob; filename: string }> {
        const response = await api.get<Blob>(`${serviceReportPath(scope, periodId, serviceCode)}/export-raw`, { responseType: 'blob', skipToast: true });
        return { blob: response.data, filename: exportFilename(response.headers['content-disposition'], scope) };
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
    async picAccountSuggestions(scope: CsiScopeParam, search: string, siteId?: string | null): Promise<AccountSuggestion[]> {
        return (await api.get<AccountSuggestion[]>(`${orgPath(scope)}/pics/account-suggestions`, {
            params: { search, ...(siteId ? { siteId } : {}) },
        })).data;
    },
    async updatePic(scope: CsiScopeParam, id: string, patch: UpdateCsiPic): Promise<CsiPicView> {
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
