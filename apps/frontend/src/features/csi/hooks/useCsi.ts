import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { CsiApi } from '../api/csi.api';
import type {
    ConfirmCsiPeriodAction, CsiPairMode,
    CsiMemoHeader, CsiMemoRequest, CsiPair, CsiScopeParam, CsiUserIds, CreateCsiDepartment, CreateCsiDimension,
    CreateCsiPeriod, CreateCsiTeam, CsiRaterGroupFilter, ResetCsiResponse, SaveCsiQuestionSet, SendCsiReminders, SetCsiRatees, SetCsiTeamQuestions, SubmitCsiResponse,
    UpdateCsiDepartment, UpdateCsiDimension, UpdateCsiPeriod, UpdateCsiPeriodRatee, UpdateCsiSubject,
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
    keys.period(scope, id), keys.periods(scope), keys.report(scope, id), keys.respondents(scope, id), keys.raterMatrix(scope, id),
    keys.responseDetail(scope, id), keys.active(), keys.form(id),
];

/** Active surveys change rarely; submitting a response invalidates this query anyway. */
const ACTIVE_SURVEYS_STALE_TIME_MS = 60_000;

export function useCsiMyResults() {
    return useQuery({ queryKey: ['csi', 'me', 'results'], queryFn: CsiApi.myResults });
}
export function useCsiActive() {
    return useQuery({ queryKey: keys.active(), queryFn: CsiApi.active, staleTime: ACTIVE_SURVEYS_STALE_TIME_MS });
}
export function useCsiForm(id: string) {
    return useQuery({ queryKey: keys.form(id), queryFn: () => CsiApi.form(id), enabled: !!id });
}
/**
 * The respondent does not know the URL scope; refresh both admin views if cached. The form itself is NOT refetched:
 * it would come back "already answered" and replace the thank-you screen before it is shown.
 */
export function useSubmitCsi(id: string) {
    const form = keys.form(id);
    const others = (scope: CsiScopeParam) => periodKeys(scope, id).filter((key) => JSON.stringify(key) !== JSON.stringify(form));
    return useCsiMutation((payload: SubmitCsiResponse) => CsiApi.submit(id, payload), () => [...others('ict'), ...others('hc')]);
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
export function useReorderCsiDimensions(scope: CsiScopeParam) {
    return useCsiMutation((ids: string[]) => CsiApi.reorderDimensions(scope, { ids }), () => [keys.dimensions(scope)]);
}
export function useApplyCsiTemplate(scope: CsiScopeParam) {
    return useCsiMutation(() => CsiApi.applyTemplate(scope), () => [keys.dimensions(scope)]);
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
export function useReorderCsiDepartments(scope: CsiScopeParam) {
    return useCsiMutation((ids: string[]) => CsiApi.reorderDepartments(scope, { ids }), () => departmentKeys(scope));
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
export function usePublishCsiPeriod(scope: CsiScopeParam, id: string) {
    return useCsiMutation(() => CsiApi.publishPeriod(scope, id), () => periodKeys(scope, id));
}
export function useUnpublishCsiPeriod(scope: CsiScopeParam, id: string) {
    return useCsiMutation(() => CsiApi.unpublishPeriod(scope, id), () => periodKeys(scope, id));
}
export function useCancelCsiPeriod(scope: CsiScopeParam, id: string) {
    return useCsiMutation((payload: ConfirmCsiPeriodAction) => CsiApi.cancelPeriod(scope, id, payload), () => [...periodKeys(scope, id), keys.dashboard(scope)]);
}
export function useRestoreCsiPeriod(scope: CsiScopeParam, id: string) {
    return useCsiMutation(() => CsiApi.restorePeriod(scope, id), () => [...periodKeys(scope, id), keys.dashboard(scope)]);
}
/** Like delete: not the detail keys (the open detail would refetch a deleted period). */
export function usePurgeCsiPeriod(scope: CsiScopeParam, id: string) {
    return useCsiMutation((payload: ConfirmCsiPeriodAction) => CsiApi.purgePeriod(scope, id, payload), () => [keys.periods(scope), keys.active(), keys.dashboard(scope)]);
}
export function useSetCsiPairMode(scope: CsiScopeParam, id: string) {
    return useCsiMutation((mode: CsiPairMode) => CsiApi.setPairMode(scope, id, mode), () => [...periodKeys(scope, id), keys.assignments(scope, id)]);
}
export function useDeleteCsiPeriod(scope: CsiScopeParam) {
    // Not the detail keys: the open detail view would refetch a deleted period (404 toast) before navigating away.
    return useCsiMutation((id: string) => CsiApi.deletePeriod(scope, id), () => [keys.periods(scope), keys.active()]);
}
// Member edits add/remove matrix rows and columns (and may apply the template), so the mapping view refreshes too.
const memberKeys = (scope: CsiScopeParam, id: string): QueryKey[] => [...periodKeys(scope, id), ...assignmentKeys(scope, id)];
export function useSetCsiRatees(scope: CsiScopeParam, id: string) {
    return useCsiMutation((payload: SetCsiRatees) => CsiApi.setRatees(scope, id, payload), () => memberKeys(scope, id));
}
export function useSetCsiTeamQuestions(scope: CsiScopeParam, id: string) {
    return useCsiMutation((payload: SetCsiTeamQuestions) => CsiApi.setTeamQuestions(scope, id, payload), () => periodKeys(scope, id));
}
export function useSetCsiRaters(scope: CsiScopeParam, id: string) {
    return useCsiMutation((payload: CsiUserIds) => CsiApi.setRaters(scope, id, payload), () => memberKeys(scope, id));
}
export function useUpdateCsiPeriodRatee(scope: CsiScopeParam, id: string) {
    return useCsiMutation(({ periodRateeId, payload }: { periodRateeId: string; payload: UpdateCsiPeriodRatee }) =>
        CsiApi.updatePeriodRatee(scope, id, periodRateeId, payload), () => memberKeys(scope, id));
}
export function useCsiReport(scope: CsiScopeParam, id: string, siteId?: string) {
    return useQuery({ queryKey: keys.report(scope, id, siteId), queryFn: () => CsiApi.report(scope, id, siteId), enabled: !!id });
}
export function useCsiRaterMatrix(scope: CsiScopeParam, id: string, siteId?: string) {
    return useQuery({ queryKey: keys.raterMatrix(scope, id, siteId), queryFn: () => CsiApi.raterMatrix(scope, id, siteId), enabled: !!id });
}
export function useSendCsiReminders(scope: CsiScopeParam, periodId: string) {
    return useCsiMutation((payload: SendCsiReminders = {}) => CsiApi.sendReminders(scope, periodId, payload),
        () => [keys.respondents(scope, periodId)]);
}
export function useCsiDashboard(scope: CsiScopeParam) {
    return useQuery({ queryKey: keys.dashboard(scope), queryFn: () => CsiApi.dashboard(scope) });
}
/** Dashboard reminders span several active periods, so the period comes with each call. */
export function useSendCsiDashboardReminders(scope: CsiScopeParam) {
    return useCsiMutation(({ periodId, userIds }: { periodId: string; userIds: string[] }) =>
        CsiApi.sendReminders(scope, periodId, { userIds }),
    ({ periodId }) => [keys.respondents(scope, periodId), keys.dashboard(scope)]);
}

// Subject master edits show up in every period detail of the scope.
const subjectKeys = (scope: CsiScopeParam): QueryKey[] => [keys.subjects(scope), keys.periodDetails(scope)];
export function useCsiSubjects(scope: CsiScopeParam) {
    return useQuery({ queryKey: keys.subjects(scope), queryFn: () => CsiApi.subjects(scope) });
}
export function useUpdateCsiSubject(scope: CsiScopeParam) {
    return useCsiMutation(({ key, payload }: { key: string; payload: UpdateCsiSubject }) => CsiApi.updateSubject(scope, key, payload),
        () => subjectKeys(scope));
}
export function useUploadCsiSubjectPhoto(scope: CsiScopeParam) {
    return useCsiMutation(({ key, file }: { key: string; file: File }) => CsiApi.uploadSubjectPhoto(scope, key, file),
        () => subjectKeys(scope));
}
export function useAddCsiSubjectMembers(scope: CsiScopeParam) {
    return useCsiMutation((payload: CsiUserIds) => CsiApi.addSubjectMembers(scope, payload), () => subjectKeys(scope));
}
export function useRemoveCsiSubjectMember(scope: CsiScopeParam) {
    return useCsiMutation((userId: string) => CsiApi.removeSubjectMember(scope, userId), () => subjectKeys(scope));
}
export function useCreateCsiTeam(scope: CsiScopeParam) {
    return useCsiMutation((payload: CreateCsiTeam) => CsiApi.createTeam(scope, payload), () => subjectKeys(scope));
}

/** Live clash check of the survey info form; idle until sites and both dates are set. */
export function useCsiPeriodOverlaps(scope: CsiScopeParam, query: { siteIds: readonly string[]; startDate: string; endDate: string; excludeId?: string }) {
    const ready = query.siteIds.length > 0 && !!query.startDate && !!query.endDate && query.endDate >= query.startDate;
    return useQuery({
        queryKey: keys.overlaps(scope, JSON.stringify(query)), queryFn: () => CsiApi.periodOverlaps(scope, query), enabled: ready,
    });
}
export function useCsiRaterDepartments(scope: CsiScopeParam, siteId?: string) {
    return useQuery({ queryKey: keys.raterDepartments(scope, siteId ?? ''), queryFn: () => CsiApi.raterDepartments(scope, siteId) });
}
export function useCsiRaterGroupPreview(scope: CsiScopeParam, filter: CsiRaterGroupFilter) {
    return useQuery({
        queryKey: keys.raterGroup(scope, JSON.stringify(filter)), queryFn: () => CsiApi.raterGroupPreview(scope, filter),
        enabled: !!(filter.siteId || filter.departmentId),
    });
}
export function useAddCsiRaterGroup(scope: CsiScopeParam) {
    return useCsiMutation((filter: CsiRaterGroupFilter) => CsiApi.addRaterGroup(scope, filter), () => [keys.raters(scope), ['csi', scope, 'rater-group']]);
}
export function useImportCsiRaters(scope: CsiScopeParam) {
    return useCsiMutation(({ keys: list, commit }: { keys: string[]; commit: boolean }) => CsiApi.importRaters(scope, list, commit),
        ({ commit }) => (commit ? [keys.raters(scope), ['csi', scope, 'rater-group']] : []));
}
export function useRemoveCsiRaters(scope: CsiScopeParam) {
    return useCsiMutation((ids: string[]) => CsiApi.removeRaters(scope, ids), () => [keys.raters(scope), ['csi', scope, 'rater-group']]);
}
export function useCsiQuestionSets(scope: CsiScopeParam) {
    return useQuery({ queryKey: keys.questionSets(scope), queryFn: () => CsiApi.questionSets(scope) });
}
export function useCreateCsiQuestionSet(scope: CsiScopeParam) {
    return useCsiMutation((payload: SaveCsiQuestionSet) => CsiApi.createQuestionSet(scope, payload), () => [keys.questionSets(scope)]);
}
export function useUpdateCsiQuestionSet(scope: CsiScopeParam) {
    return useCsiMutation(({ id, payload }: UpdatePayload<SaveCsiQuestionSet>) => CsiApi.updateQuestionSet(scope, id, payload),
        () => [keys.questionSets(scope)]);
}
export function useDeleteCsiQuestionSet(scope: CsiScopeParam) {
    return useCsiMutation((id: string) => CsiApi.deleteQuestionSet(scope, id), () => [keys.questionSets(scope)]);
}

// The mapping decides which subjects each rater sees, so the respondent status changes with it.
const assignmentKeys = (scope: CsiScopeParam, periodId: string): QueryKey[] =>
    [keys.assignments(scope, periodId), keys.respondents(scope, periodId)];
export function useCsiAssignments(scope: CsiScopeParam, periodId: string) {
    return useQuery({ queryKey: keys.assignments(scope, periodId), queryFn: () => CsiApi.assignments(scope, periodId), enabled: !!periodId });
}
export function useSaveCsiAssignments(scope: CsiScopeParam, periodId: string) {
    return useCsiMutation((pairs: CsiPair[]) => CsiApi.setAssignments(scope, periodId, { pairs }), () => assignmentKeys(scope, periodId));
}
export function useAutoCsiAssignments(scope: CsiScopeParam, periodId: string) {
    return useCsiMutation(() => CsiApi.autoAssignSameSite(scope, periodId), () => assignmentKeys(scope, periodId));
}
/** Writes the scope template only; the period's own pairs are unchanged. */
export function useSaveCsiTemplate(scope: CsiScopeParam, periodId: string) {
    return useCsiMutation(() => CsiApi.saveAssignmentTemplate(scope, periodId), () => [keys.assignments(scope, periodId)]);
}
/** Named apart from useApplyCsiTemplate, which applies the default question set. */
export function useApplyCsiAssignmentTemplate(scope: CsiScopeParam, periodId: string) {
    return useCsiMutation(() => CsiApi.applyAssignmentTemplate(scope, periodId), () => assignmentKeys(scope, periodId));
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

export function useCsiMemoSettings(scope: CsiScopeParam) {
    return useQuery({ queryKey: keys.memoSettings(scope), queryFn: () => CsiApi.memoSettings(scope) });
}
export function useSaveCsiMemoSettings(scope: CsiScopeParam) {
    return useCsiMutation((payload: CsiMemoHeader) => CsiApi.saveMemoSettings(scope, payload), () => [keys.memoSettings(scope)]);
}
/** Memo PDF export; the caller owns the single error toast (the blob error body hides the server message). */
export function useExportCsiMemo(scope: CsiScopeParam) {
    return useMutation({ mutationFn: (payload: CsiMemoRequest) => CsiApi.exportMemo(scope, payload) });
}
