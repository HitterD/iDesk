import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { CsiHcApi } from '../api/csiHc.api';
import { CsiApi } from '../api/csi.api';
import type { CreateCsiCustomTeam, CsiScopeParam, CsiTeamMemberInput, UpdateCsiCustomTeam } from '../types';
import type { CreateCsiPeriodFromTemplates, CsiTemplateImportOptions, CsiUnitRule, SetCsiPeriodPics, UpdateCsiPic } from '../hcTypes';

const keys = queryKeys.csi;
const picsKey = (scope: CsiScopeParam, includeInactive = false) => ['csi', scope, 'pics', includeInactive] as const;
const directoryKey = (scope: CsiScopeParam) => ['csi', scope, 'directory'] as const;
const ownersKey = (scope: CsiScopeParam) => ['csi', scope, 'report-owners'] as const;
const recapKey = (scope: CsiScopeParam, id: string) => ['csi', scope, 'hc-recap', id] as const;

const templatesKey = (scope: CsiScopeParam) => ['csi', scope, 'templates'] as const;
export function useCsiTemplates(scope: CsiScopeParam, enabled = true) {
    return useQuery({ queryKey: templatesKey(scope), queryFn: () => CsiHcApi.templates(scope), enabled });
}
/** Every template edit returns the fresh template; the list is refetched so counts stay right. */
export function useCsiTemplateMutation<TInput, TData>(scope: CsiScopeParam, run: (input: TInput) => Promise<TData>) {
    const client = useQueryClient();
    return useMutation({ mutationFn: run, onSuccess: () => client.invalidateQueries({ queryKey: templatesKey(scope) }) });
}
/** Imports may create PIC/team masters, so refresh subjects as well as templates. */
export function useTemplateImport(scope: CsiScopeParam, location: string) {
    return useTemplateSubjectsMutation(scope, ({ file, options }: { file: File; options: CsiTemplateImportOptions }) =>
        CsiHcApi.importTemplate(scope, location, file, options));
}
export function useAccountSuggestions(scope: CsiScopeParam, templateId: string, name: string) {
    const search = name.trim();
    return useQuery({
        queryKey: [...templatesKey(scope), templateId, 'account-suggestions', search],
        queryFn: () => CsiHcApi.templateAccountSuggestions(scope, templateId, search), enabled: !!templateId && search.length >= 2,
    });
}
export function useSetRaterAccount(scope: CsiScopeParam) {
    return useCsiTemplateMutation(scope, ({ raterIds, userId }: { raterIds: string[]; userId: string | null }) =>
        CsiHcApi.setTemplateRaterAccount(scope, raterIds, userId));
}
export function useConfirmRaters(scope: CsiScopeParam) {
    return useCsiTemplateMutation(scope, ({ raterIds, confirmed }: { raterIds: string[]; confirmed: boolean }) =>
        CsiHcApi.confirmTemplateRaters(scope, raterIds, confirmed));
}
export function useBlankTemplateDownload(scope: CsiScopeParam) {
    return useMutation({ mutationFn: (location: string) => CsiHcApi.downloadBlankTemplate(scope, location) });
}
export function useCreatePeriodFromTemplates(scope: CsiScopeParam) {
    const client = useQueryClient();
    return useMutation({
        mutationFn: (body: CreateCsiPeriodFromTemplates) => CsiHcApi.createPeriodFromTemplates(scope, body),
        onSuccess: () => Promise.all([
            client.invalidateQueries({ queryKey: templatesKey(scope) }), client.invalidateQueries({ queryKey: keys.periods(scope) }),
        ]),
    });
}
export function usePreviewPeriod(scope: CsiScopeParam, templateIds: string[]) {
    return useQuery({
        queryKey: [...templatesKey(scope), 'preview-period', templateIds],
        queryFn: () => CsiHcApi.previewPeriodFromTemplates(scope, templateIds), enabled: templateIds.length > 0,
    });
}
/** Team edits can change template rows and period snapshots as well as the subject list. */
function useTemplateSubjectsMutation<TInput, TData>(scope: CsiScopeParam, mutationFn: (input: TInput) => Promise<TData>) {
    const client = useQueryClient();
    return useMutation({
        mutationFn,
        onSuccess: () => Promise.all([templatesKey(scope), keys.subjects(scope), keys.periodDetails(scope)].map((queryKey) =>
            client.invalidateQueries({ queryKey }))),
    });
}
export function useCreateCustomTeam(scope: CsiScopeParam) {
    return useTemplateSubjectsMutation(scope, (body: CreateCsiCustomTeam) => CsiApi.createCustomTeam(scope, body));
}
export function useUpdateCustomTeam(scope: CsiScopeParam) {
    return useTemplateSubjectsMutation(scope, ({ id, ...body }: UpdateCsiCustomTeam & { id: string }) => CsiApi.updateCustomTeam(scope, id, body));
}
/** Deletes a SITE or CUSTOM team; draft surveys lose its ratee, so the period list is refreshed too. */
export function useDeleteTeam(scope: CsiScopeParam) {
    const client = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => CsiApi.deleteCustomTeam(scope, id),
        onSuccess: () => Promise.all([templatesKey(scope), keys.subjects(scope), keys.periodDetails(scope), keys.periods(scope)].map((queryKey) =>
            client.invalidateQueries({ queryKey }))),
    });
}
/** Fresh on every open: survey state changes while the admin looks at the sheet. */
export function useTeamDeleteImpact(scope: CsiScopeParam, teamId: string | null) {
    return useQuery({
        queryKey: [...keys.subjects(scope), 'delete-impact', teamId], queryFn: () => CsiApi.teamDeleteImpact(scope, teamId!),
        enabled: !!teamId, staleTime: 0, gcTime: 0,
    });
}
export function useSetCustomTeamMembers(scope: CsiScopeParam) {
    return useTemplateSubjectsMutation(scope, ({ id, members }: { id: string; members: CsiTeamMemberInput[] }) => CsiApi.setCustomTeamMembers(scope, id, members));
}
export function useCsiMyReportAccess(scope: CsiScopeParam) {
    return useQuery({ queryKey: ['csi', 'me', scope, 'report-access'], queryFn: () => CsiHcApi.myReportAccess(scope), staleTime: 5 * 60_000 });
}
export function useCsiOwnerReportAccess(): boolean {
    const hc = useCsiMyReportAccess('hc');
    const ict = useCsiMyReportAccess('ict');
    return (!hc.data?.admin && (hc.data?.services?.length ?? 0) > 0) || (!ict.data?.admin && (ict.data?.services?.length ?? 0) > 0);
}
export function useCsiMyReportPeriods(scope: CsiScopeParam, enabled = true) {
    return useQuery({ queryKey: ['csi', 'me', scope, 'periods'], queryFn: () => CsiHcApi.myReportPeriods(scope), enabled });
}
export function useCsiMyServiceReport(scope: CsiScopeParam, periodId: string | null, serviceCode: string | null) {
    return useQuery({
        queryKey: ['csi', 'me', scope, 'report', periodId, serviceCode], enabled: !!periodId && !!serviceCode,
        queryFn: () => CsiHcApi.myServiceReport(scope, periodId!, serviceCode!),
    });
}
export function useCsiReportOwners(scope: CsiScopeParam, enabled = true) {
    return useQuery({ queryKey: ownersKey(scope), queryFn: () => CsiHcApi.reportOwners(scope), enabled });
}
export function useSetCsiReportOwners(scope: CsiScopeParam) {
    const client = useQueryClient();
    return useMutation({
        mutationFn: ({ serviceCode, userIds }: { serviceCode: string; userIds: string[] }) => CsiHcApi.setReportOwners(scope, serviceCode, userIds),
        onSuccess: (data) => client.setQueryData(ownersKey(scope), data),
    });
}
export function useCsiPics(scope: CsiScopeParam, includeInactive = false) {
    return useQuery({ queryKey: picsKey(scope, includeInactive), queryFn: () => CsiHcApi.pics(scope, includeInactive) });
}
export function useCsiDirectory(scope: CsiScopeParam) {
    return useQuery({ queryKey: directoryKey(scope), queryFn: () => CsiHcApi.directory(scope) });
}
export function useImportCsiDirectory(scope: CsiScopeParam) {
    const client = useQueryClient();
    return useMutation({
        mutationFn: (file: File) => CsiHcApi.importDirectory(scope, file),
        onSuccess: () => Promise.all([
            client.invalidateQueries({ queryKey: ['csi', scope, 'pics'] }), client.invalidateQueries({ queryKey: directoryKey(scope) }),
        ]),
    });
}
export function useUpdateCsiPic(scope: CsiScopeParam) {
    const client = useQueryClient();
    return useMutation({
        mutationFn: ({ id, ...patch }: UpdateCsiPic & { id: string }) => CsiHcApi.updatePic(scope, id, patch),
        onSuccess: () => client.invalidateQueries({ queryKey: ['csi', scope, 'pics'] }),
    });
}
/** One rename for the template card, "Orang & foto" and PIC HC: template rows and draft survey snapshots follow. */
export function useRenameCsiPic(scope: CsiScopeParam) {
    const client = useQueryClient();
    return useMutation({
        mutationFn: ({ id, fullName }: { id: string; fullName: string }) => CsiHcApi.updatePic(scope, id, { fullName }),
        onSuccess: () => Promise.all([['csi', scope, 'pics'], templatesKey(scope), keys.subjects(scope), keys.periodDetails(scope)].map((queryKey) =>
            client.invalidateQueries({ queryKey }))),
    });
}
export function useUploadCsiPicPhoto(scope: CsiScopeParam) {
    const client = useQueryClient();
    return useMutation({
        mutationFn: ({ id, file }: { id: string; file: File }) => CsiHcApi.uploadPicPhoto(scope, id, file),
        onSuccess: () => client.invalidateQueries({ queryKey: ['csi', scope, 'pics'] }),
    });
}
export function useSetCsiPeriodPics(scope: CsiScopeParam, periodId: string) {
    const client = useQueryClient();
    return useMutation({
        mutationFn: (payload: SetCsiPeriodPics) => CsiHcApi.setPeriodPics(scope, periodId, payload),
        onSuccess: () => Promise.all([
            client.invalidateQueries({ queryKey: keys.period(scope, periodId) }), client.invalidateQueries({ queryKey: keys.periods(scope) }),
        ]),
    });
}
export function useCsiHcRecap(scope: CsiScopeParam, periodId: string) {
    return useQuery({ queryKey: recapKey(scope, periodId), queryFn: () => CsiHcApi.hcRecap(scope, periodId), enabled: !!periodId });
}

const ratersKey = (scope: CsiScopeParam, id: string) => ['csi', scope, 'hc-raters', id] as const;
/** Raters/pairs changed: refresh the period, its HC rater list and the assignment matrix. */
const pairKeys = (scope: CsiScopeParam, id: string) => [keys.period(scope, id), ratersKey(scope, id), keys.assignments(scope, id), keys.respondents(scope, id)];

export function useCsiUnitOptions(scope: CsiScopeParam) {
    return useQuery({ queryKey: ['csi', scope, 'units'], queryFn: () => CsiHcApi.units(scope), staleTime: 5 * 60_000 });
}
export function useCsiHcRaters(scope: CsiScopeParam, periodId: string) {
    return useQuery({ queryKey: ratersKey(scope, periodId), queryFn: () => CsiHcApi.raters(scope, periodId), enabled: !!periodId });
}
function usePairsMutation<TVariables, TData>(scope: CsiScopeParam, periodId: string, mutationFn: (variables: TVariables) => Promise<TData>) {
    const client = useQueryClient();
    return useMutation({
        mutationFn,
        onSuccess: () => Promise.all(pairKeys(scope, periodId).map((queryKey) => client.invalidateQueries({ queryKey }))),
    });
}
export function useApplyCsiUnitRules(scope: CsiScopeParam, periodId: string) {
    return usePairsMutation(scope, periodId, (rules: CsiUnitRule[]) => CsiHcApi.applyRules(scope, periodId, rules));
}
export function useSetCsiHcRater(scope: CsiScopeParam, periodId: string) {
    return usePairsMutation(scope, periodId, ({ userId, periodRateeIds }: { userId: string; periodRateeIds: string[] }) =>
        CsiHcApi.setRater(scope, periodId, userId, periodRateeIds));
}
export function useImportCsiPairs(scope: CsiScopeParam, periodId: string) {
    return usePairsMutation(scope, periodId, ({ file, commit }: { file: File; commit: boolean }) => CsiHcApi.importPairs(scope, periodId, file, commit));
}
