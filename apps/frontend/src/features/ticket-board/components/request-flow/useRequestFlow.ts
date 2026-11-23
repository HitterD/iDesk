import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { RequestFlowView } from './flowTypes';

const FLOW_STALE_MS = 5_000;
const flowUrl = (ticketId: string, path: string): string => `/request-flow/${ticketId}/${path}`;
const hardwareUrl = (requestId: string, path: string): string => `/hardware-requests/${requestId}/${path}`;

/** One call the page can make: the verb, the endpoint and the JSON body. */
export interface FlowCall { method: 'post' | 'put' | 'patch'; url: string; body?: unknown }
const call = (method: FlowCall['method'], url: string, body?: unknown): FlowCall => ({ method, url, ...(body === undefined ? {} : { body }) });

/** Every action of a request ticket and the endpoint behind it. Payloads follow the backend DTOs. */
export const flowCalls = {
    review: (ticketId: string, body: unknown) => call('post', flowUrl(ticketId, 'review'), body),
    decision: (ticketId: string, body: unknown) => call('post', flowUrl(ticketId, 'decision'), body),
    rejectByIt: (ticketId: string, reason: string) => call('post', flowUrl(ticketId, 'reject'), { reason }),
    cancel: (ticketId: string) => call('post', flowUrl(ticketId, 'cancel'), {}),
    remind: (ticketId: string) => call('post', flowUrl(ticketId, 'remind'), {}),
    editItems: (ticketId: string, body: unknown) => call('put', flowUrl(ticketId, 'items'), body),
    procure: (ticketId: string, body: unknown) => call('post', flowUrl(ticketId, 'procurement'), body),
    arrivals: (ticketId: string, body: unknown) => call('post', flowUrl(ticketId, 'arrivals'), body),
    installDone: (ticketId: string, body: unknown) => call('post', flowUrl(ticketId, 'install-done'), body),
    fulfill: (ticketId: string, body: unknown) => call('post', flowUrl(ticketId, 'fulfill'), body),
    confirm: (ticketId: string, body: unknown) => call('post', flowUrl(ticketId, 'confirm'), body),
    documentNumber: (ticketId: string, value: string) => call('patch', flowUrl(ticketId, 'document-number'), { value }),
    // Scheduling keeps the hardware endpoints (keyed by the hardware request and the schedule).
    proposeSchedule: (requestId: string, body: unknown) => call('post', hardwareUrl(requestId, 'schedule/propose'), body),
    selectSlot: (requestId: string, scheduleId: string, body: unknown) => call('post', hardwareUrl(requestId, `schedule/${scheduleId}/select-slot`), body),
    requestReschedule: (requestId: string, scheduleId: string, body: unknown) => call('post', hardwareUrl(requestId, `schedule/${scheduleId}/request-reschedule`), body),
    startInstall: (requestId: string) => call('post', hardwareUrl(requestId, 'install/start'), {}),
} as const;

/** Where a request ticket stands (GET /request-flow/:ticketId); only asked for Hardware / E-Form tickets. */
export function useRequestFlow(ticketId: string | undefined, isRequestTicket: boolean) {
    return useQuery<RequestFlowView>({
        queryKey: ['request-flow', ticketId],
        enabled: Boolean(ticketId) && isRequestTicket,
        queryFn: async () => (await api.get(`/request-flow/${ticketId}`)).data,
        staleTime: FLOW_STALE_MS,
    });
}

/** Runs one action and, once the server accepted it, refreshes the flow, the ticket and the lists. */
export function useRequestFlowAction(ticketId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ method, url, body }: FlowCall) => (await api[method](url, body)).data,
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['request-flow', ticketId] });
            void queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
            void queryClient.invalidateQueries({ queryKey: ['tickets'] });
            void queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
            // Views derived from the flow: the approver's list, the requester's access cards and IT's devices page.
            void queryClient.invalidateQueries({ queryKey: ['request-flow', 'approvals'] });
            void queryClient.invalidateQueries({ queryKey: ['request-flow', 'my-access'] });
            void queryClient.invalidateQueries({ queryKey: ['devices-access'] });
        },
    });
}
