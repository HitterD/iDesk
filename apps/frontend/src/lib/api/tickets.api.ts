/**
 * Tickets API
 * Type-safe API client for ticket operations
 */

import api from '../api';
import type {
    Ticket,
    TicketMessage,
    TicketListParams,
    CreateTicketDto,
    UpdateTicketDto,
    SendMessageDto,
    PaginatedResponse,
} from './types';

/**
 * Tickets API client with type-safe methods
 */
export const ticketApi = {
    /**
     * Get paginated list of tickets
     */
    list: (params?: TicketListParams) =>
        api.get<PaginatedResponse<Ticket>>('/tickets/paginated', { params }),

    /**
     * Get a single ticket by ID
     */
    get: (id: string) =>
        api.get<Ticket>(`/tickets/${id}`),

    /**
     * Create a new ticket
     */
    create: (data: CreateTicketDto) =>
        api.post<Ticket>('/tickets', data),

    /**
     * Update a ticket
     */
    update: (id: string, data: UpdateTicketDto) =>
        api.patch<Ticket>(`/tickets/${id}`, data),

    /**
     * Delete a ticket
     */
    delete: (id: string) =>
        api.delete(`/tickets/${id}`),

    /**
     * Assign ticket to an agent
     */
    assign: (ticketId: string, agentId: string) =>
        api.patch<Ticket>(`/tickets/${ticketId}/assign`, { agentId }),

    /**
     * Change ticket status
     */
    changeStatus: (ticketId: string, status: string) =>
        api.patch<Ticket>(`/tickets/${ticketId}/status`, { status }),

    /**
     * Get ticket messages
     */
    getMessages: (ticketId: string) =>
        api.get<TicketMessage[]>(`/tickets/${ticketId}/messages`),

    /**
     * Send a message on a ticket
     */
    sendMessage: (ticketId: string, data: SendMessageDto) =>
        api.post<TicketMessage>(`/tickets/${ticketId}/messages`, data),

    /**
     * Get my tickets (for users)
     */
    getMyTickets: (params?: TicketListParams) =>
        api.get<PaginatedResponse<Ticket>>('/tickets/my', { params }),

    /**
     * Get assigned tickets (for agents)
     */
    getAssignedTickets: (params?: TicketListParams) =>
        api.get<PaginatedResponse<Ticket>>('/tickets/assigned', { params }),

    /**
     * Get hardware installation statistics
     */
    getHardwareStats: () =>
        api.get('/tickets/hardware-stats'),
};

export default ticketApi;
