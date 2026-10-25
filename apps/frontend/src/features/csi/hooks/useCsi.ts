import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { CsiApi } from '../api/csi.api';
import type {
    CsiScopeParam, CsiUserIds, CreateCsiDepartment, CreateCsiDimension, CreateCsiPeriod,
    ResetCsiResponse, SetCsiRatees, SubmitCsiResponse, UpdateCsiDepartment,
    UpdateCsiDimension, UpdateCsiPeriod,
} from '../types';

const keys = queryKeys.csi;
type UpdatePayload<T> = { id: string; payload: T };

// The shared axios interceptor handles error toasts; leave errors available to callers.
function useCsiMutation<TData, TVariables>(mutationFn: (variables: TVariables) => Promise<TData>,
    invalidations: (variables: TVariables) => readonly QueryKey[]) {
    const client = useQueryClient();
    return useMutation({
        mutationFn,
        onSuccess: (_data, variables) => Promise.all(invalidations(variables)
            .map((queryKey) => client.invalidateQueries({ queryKey }))),
    });
}

const periodKeys = (scope: CsiScopeParam, id: string): QueryKey[] => [
    keys.period(scope, id), keys.periods(scope), keys.report(scope, id), keys.respondents(scope, id),
    keys.responseDetail(scope, id), keys.active(), keys.form(id),
];

export function useCsiActive() {
    return useQuery({ queryKey: keys.active(), queryFn: CsiApi.active });
}
export function useCsiForm(id: string) {
    return useQuery({ queryKey: keys.form(id), queryFn: () => CsiApi.form(id), enabled: !!id });
}
export function useSubmitCsi(id: string) {
    // The respondent does not know the URL scope; refresh both admin views if cached.
    return useCsiMutation((payload: SubmitCsiResponse) => CsiApi.submit(id, payload),
        () => [...periodKeys('ict', id), ...periodKeys('hc', id)]);
}

export function useCsiDimensions(scope: CsiScopeParam, includeInactive = false) {
    return useQuery({ queryKey: keys.dimensions(scope, includeInactive), queryFn: () => CsiApi.dimensions(scope, includeInactive) });
}
export function useCreateCsiDimension(scope: CsiScopeParam) {
    return useCsiMutation((payload: CreateCsiDimension) => CsiApi.createDimension(scope, payload), () => [keys.dimensions(scope)]);
}
export function useUpdateCsiDimension(scope: CsiScopeParam) {
    return useCsiMutation(({ id, payload }: UpdatePayload<UpdateCsiDimension>) => CsiApi.updateDimension(scope, id, payload),
        () => [keys.dimensions(scope)]);
}
export function useDeactivateCsiDimension(scope: CsiScopeParam) {
    return useCsiMutation((id: string) => CsiApi.deactivateDimension(scope, id), () => [keys.dimensions(scope)]);
}
export function useCsiDepartments(scope: CsiScopeParam, includeInactive = false) {
    return useQuery({ queryKey: keys.departments(scope, includeInactive), queryFn: () => CsiApi.departments(scope, includeInactive) });
}
const departmentKeys = (scope: CsiScopeParam) => [keys.departments(scope), keys.forms()];
export function useCreateCsiDepartment(scope: CsiScopeParam) {
    return useCsiMutation((payload: CreateCsiDepartment) => CsiApi.createDepartment(scope, payload), () => departmentKeys(scope));
}
export function useUpdateCsiDepartment(scope: CsiScopeParam) {
    return useCsiMutation(({ id, payload }: UpdatePayload<UpdateCsiDepartment>) => CsiApi.updateDepartment(scope, id, payload),
        () => departmentKeys(scope));
}
export function useDeactivateCsiDepartment(scope: CsiScopeParam) {
    return useCsiMutation((id: string) => CsiApi.deactivateDepartment(scope, id), () => departmentKeys(scope));
}
export function useCsiRaters(scope: CsiScopeParam) {
    return useQuery({ queryKey: keys.raters(scope), queryFn: () => CsiApi.raters(scope) });
}
export function useAddCsiRaters(scope: CsiScopeParam) {
    return useCsiMutation((payload: CsiUserIds) => CsiApi.addRaters(scope, payload), () => [keys.raters(scope)]);
}
export function useRemoveCsiRater(scope: CsiScopeParam) {
    return useCsiMutation((id: string) => CsiApi.removeRater(scope, id), () => [keys.raters(scope)]);
}
export function useCsiUserSearch(scope: CsiScopeParam, search: string) {
    return useQuery({ queryKey: keys.userSearch(scope, search), queryFn: () => CsiApi.userSearch(scope, search) });
}
export function useCsiPeriods(scope: CsiScopeParam, siteId?: string) {
    return useQuery({ queryKey: keys.periods(scope, siteId), queryFn: () => CsiApi.periods(scope, siteId) });
}
export function useCsiPeriod(scope: CsiScopeParam, id: string) {
    return useQuery({ queryKey: keys.period(scope, id), queryFn: () => CsiApi.period(scope, id), enabled: !!id });
}
export function useCreateCsiPeriod(scope: CsiScopeParam) {
    return useCsiMutation((payload: CreateCsiPeriod) => CsiApi.createPeriod(scope, payload),
        () => [keys.periods(scope), keys.active()]);
}
export function useUpdateCsiPeriod(scope: CsiScopeParam) {
    return useCsiMutation(({ id, payload }: UpdatePayload<UpdateCsiPeriod>) => CsiApi.updatePeriod(scope, id, payload),
        ({ id }) => periodKeys(scope, id));
}
export function useDeleteCsiPeriod(scope: CsiScopeParam) {
    // Not the detail keys: the open detail view would refetch a deleted period (404 toast) before navigating away.
    return useCsiMutation((id: string) => CsiApi.deletePeriod(scope, id), () => [keys.periods(scope), keys.active()]);
}
export function useSetCsiRatees(scope: CsiScopeParam, id: string) {
    return useCsiMutation((payload: SetCsiRatees) => CsiApi.setRatees(scope, id, payload), () => periodKeys(scope, id));
}
export function useSetCsiRaters(scope: CsiScopeParam, id: string) {
    return useCsiMutation((payload: CsiUserIds) => CsiApi.setRaters(scope, id, payload), () => periodKeys(scope, id));
}
export function useCsiReport(scope: CsiScopeParam, id: string) {
    return useQuery({ queryKey: keys.report(scope, id), queryFn: () => CsiApi.report(scope, id), enabled: !!id });
}
export function useCsiRespondents(scope: CsiScopeParam, id: string) {
    return useQuery({ queryKey: keys.respondents(scope, id), queryFn: () => CsiApi.respondents(scope, id), enabled: !!id });
}
export function useCsiResponseDetail(scope: CsiScopeParam, id: string, responseId: string) {
    return useQuery({ queryKey: keys.responseDetail(scope, id, responseId),
        queryFn: () => CsiApi.responseDetail(scope, id, responseId), enabled: !!id && !!responseId });
}
export function useResetCsiResponse(scope: CsiScopeParam, id: string) {
    return useCsiMutation(({ responseId, reason }: ResetCsiResponse & { responseId: string }) =>
        CsiApi.resetResponse(scope, id, responseId, { reason }), () => periodKeys(scope, id));
}
