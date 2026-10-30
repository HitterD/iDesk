import api from '@/lib/api';
import type { EFormType, TicketEFormRequest } from './eformFlow';

export interface ProposeEFormPayload {
    formType: EFormType;
    note: string;
    requestedWebsites?: string;
    networkPurpose?: string;
    details?: Record<string, string>;
}

interface Envelope<T> { success: boolean; data: T }

export const ticketEFormApi = {
    async list(ticketId: string): Promise<TicketEFormRequest[]> {
        return (await api.get<Envelope<TicketEFormRequest[]>>(`/tickets/${ticketId}/eform-requests`)).data.data;
    },
    async propose(ticketId: string, payload: ProposeEFormPayload): Promise<TicketEFormRequest> {
        return (await api.post<Envelope<TicketEFormRequest>>(`/tickets/${ticketId}/eform-requests`, payload)).data.data;
    },
    /** The requester declines, or IT withdraws, a proposal that was not signed yet. */
    async cancel(requestId: string): Promise<TicketEFormRequest> {
        return (await api.post<Envelope<TicketEFormRequest>>(`/eform-request/${requestId}/cancel-proposal`)).data.data;
    },
};
