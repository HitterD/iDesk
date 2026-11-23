import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export type AccessGroup = 'soon' | 'expired' | 'active' | 'permanent';

export interface AccessItem {
    eformId: string; ticketId: string; kind: string; requesterName: string; department: string;
    startDate: string | null; endDate: string | null; group: AccessGroup; daysLeft: number | null;
}
export interface AccessView { group: AccessGroup; counts: Record<AccessGroup, number>; items: AccessItem[] }

export interface ScheduleEvent {
    scheduleId: string; ticketId: string; ticketNumber: string; title: string; siteId: string | null;
    technicianId: string; technicianName: string; status: string; start: string | null; end: string | null;
}
export interface ScheduleWeek {
    weekStart: string; events: ScheduleEvent[]; load: Array<{ technicianId: string; technicianName: string; count: number }>;
    unscheduled?: Array<{ ticketId: string; ticketNumber: string; title: string; requesterName: string }>;
    rescheduleRequested?: number;
}

export interface CenterSummary {
    activeHardware: number; inProcurement: number; waitingInstall: number; doneThisMonth: number;
    byPhase: Array<{ phase: string; count: number }>;
    topItems?: Array<{ name: string; count: number }>;
    age?: { fresh: number; week: number; old: number };
}

const STALE_MS = 30_000;

export const useAccessView = (group: AccessGroup, enabled = true) => useQuery<AccessView>({
    enabled,
    queryKey: ['devices-access', 'access', group],
    queryFn: async () => (await api.get('/request-flow/center/access', { params: { group } })).data,
    staleTime: STALE_MS,
});

export const useScheduleWeek = (weekStart: string, enabled = true) => useQuery<ScheduleWeek>({
    enabled,
    queryKey: ['devices-access', 'schedule', weekStart],
    queryFn: async () => (await api.get('/request-flow/center/schedule', { params: { weekStart } })).data,
    staleTime: STALE_MS,
});

export const useCenterSummary = (enabled = true) => useQuery<CenterSummary>({
    enabled,
    queryKey: ['devices-access', 'summary'],
    queryFn: async () => (await api.get('/request-flow/center/summary')).data,
    staleTime: STALE_MS,
});

/** Remind the requester, or file the ticket that revokes an expired access. */
export function useAccessActions() {
    const client = useQueryClient();
    const refresh = () => { void client.invalidateQueries({ queryKey: ['devices-access'] }); };
    const remind = useMutation({ mutationFn: async (eformId: string) => (await api.post(`/request-flow/center/access/${eformId}/remind`)).data, onSuccess: refresh });
    const revoke = useMutation({ mutationFn: async (eformId: string) => (await api.post(`/request-flow/center/access/${eformId}/revoke`)).data as { ticketId: string; ticketNumber: string }, onSuccess: refresh });
    return { remind, revoke };
}
