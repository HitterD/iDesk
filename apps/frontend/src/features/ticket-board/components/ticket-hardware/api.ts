import api from '@/lib/api';
import { HardwareRequestApi } from '@/features/hardware-request/api/hardware-request.api';
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
};
