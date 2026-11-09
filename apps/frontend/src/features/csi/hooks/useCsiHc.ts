import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { CsiHcApi } from '../api/csiHc.api';
import type { CsiScopeParam } from '../types';
import type { CsiUnitRule, SetCsiPeriodPics } from '../hcTypes';

const keys = queryKeys.csi;
const picsKey = (scope: CsiScopeParam, includeInactive = false) => ['csi', scope, 'pics', includeInactive] as const;
const directoryKey = (scope: CsiScopeParam) => ['csi', scope, 'directory'] as const;
const ownersKey = (scope: CsiScopeParam) => ['csi', scope, 'report-owners'] as const;
const recapKey = (scope: CsiScopeParam, id: string) => ['csi', scope, 'hc-recap', id] as const;

export function useCsiMyReportAccess() {
    return useQuery({ queryKey: ['csi', 'me', 'hc', 'report-access'], queryFn: () => CsiHcApi.myReportAccess(), staleTime: 5 * 60_000 });
}
export function useCsiMyReportPeriods() {
    return useQuery({ queryKey: ['csi', 'me', 'hc', 'periods'], queryFn: () => CsiHcApi.myReportPeriods() });
}
export function useCsiMyServiceReport(periodId: string | null, serviceCode: string | null) {
    return useQuery({
        queryKey: ['csi', 'me', 'hc', 'report', periodId, serviceCode], enabled: !!periodId && !!serviceCode,
        queryFn: () => CsiHcApi.myServiceReport(periodId!, serviceCode!),
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
        mutationFn: ({ id, ...patch }: { id: string; isActive?: boolean; serviceFunction?: string | null }) => CsiHcApi.updatePic(scope, id, patch),
        onSuccess: () => client.invalidateQueries({ queryKey: ['csi', scope, 'pics'] }),
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
