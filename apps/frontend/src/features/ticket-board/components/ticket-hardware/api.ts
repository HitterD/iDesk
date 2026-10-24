import api from '@/lib/api';
import { HardwareRequestApi } from '@/features/hardware-request/api/hardware-request.api';
import { confirmProposedSchedule, selectScheduleSlot } from '@/features/hardware-request/api/installation.api';
import type { HardwareRequestType, TicketHardwareRequest } from './hardwareFlow';

export interface ProposeHardwarePayload {
    requestType: HardwareRequestType;
    justification: string;
    division?: string;
    items: Array<{ catalogId: string; quantity: number; notes?: string }>;
}

interface Envelope<T> { success: boolean; data: T }

export const ticketHardwareApi = {
    async list(ticketId: string): Promise<TicketHardwareRequest[]> {
        return (await api.get<Envelope<TicketHardwareRequest[]>>(`/tickets/${ticketId}/hardware-requests`)).data.data;
    },
    async propose(ticketId: string, payload: ProposeHardwarePayload): Promise<TicketHardwareRequest> {
        return (await api.post<Envelope<TicketHardwareRequest>>(`/tickets/${ticketId}/hardware-requests`, payload)).data.data;
    },
    /** The requester confirms a proposal by submitting the draft, or declines it by cancelling. */
    accept: (requestId: string) => HardwareRequestApi.submit(requestId),
    decline: (requestId: string) => HardwareRequestApi.cancel(requestId),
    /** Requester answers about the installation without leaving the ticket. */
    pickSlot: ({ requestId, scheduleId, slotIndex }: { requestId: string; scheduleId: string; slotIndex: number }) =>
        selectScheduleSlot(requestId, scheduleId, { slotIndex }),
    confirmSchedule: (requestId: string) => confirmProposedSchedule(requestId),
    confirmInstallation: ({ requestId, ok, comments }: { requestId: string; ok: boolean; comments?: string }) =>
        HardwareRequestApi.confirmInstallation(requestId, { kind: ok ? 'ACCEPT_AS_IS' : 'REPORT_ISSUE', comments }),
};
