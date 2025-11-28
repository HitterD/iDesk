import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

// Types
export interface Ticket {
    id: string;
    ticketNumber: string;
    title: string;
    description: string;
    status: 'TODO' | 'IN_PROGRESS' | 'WAITING_VENDOR' | 'RESOLVED' | 'CANCELLED';
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    category?: string;
    source?: string;
    device?: string;
    software?: string;
    slaTarget?: string;
    createdAt: string;
    updatedAt: string;
    user?: {
        id: string;
        fullName: string;
        email: string;
        department?: { name: string };
    };
    assignedTo?: {
        id: string;
        fullName: string;
    };
}

export interface TicketFilters {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
    status?: string;
    priority?: string;
    category?: string;
    search?: string;
}

export interface PaginatedTickets {
    data: Ticket[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPrevPage: boolean;
    };
}

export interface CreateTicketDto {
    title: string;
    description: string;
    priority?: string;
    category?: string;
    device?: string;
    software?: string;
}

export interface UpdateTicketDto {
    status?: string;
    priority?: string;
    category?: string;
    assignedToId?: string;
}

/**
 * Fetch tickets with optional filters and pagination
 */
export function useTickets(filters?: TicketFilters) {
    return useQuery<PaginatedTickets>({
        queryKey: ['tickets', filters],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (filters?.page) params.append('page', String(filters.page));
            if (filters?.limit) params.append('limit', String(filters.limit));
            if (filters?.sortBy) params.append('sortBy', filters.sortBy);
            if (filters?.sortOrder) params.append('sortOrder', filters.sortOrder);
            if (filters?.status) params.append('status', filters.status);
            if (filters?.priority) params.append('priority', filters.priority);
            if (filters?.category) params.append('category', filters.category);
            if (filters?.search) params.append('search', filters.search);
            
            const response = await api.get(`/tickets?${params.toString()}`);
            return response.data;
        },
        staleTime: 30000, // 30 seconds
    });
}

/**
 * Fetch single ticket by ID
 */
export function useTicket(id: string) {
    return useQuery<Ticket>({
        queryKey: ['ticket', id],
        queryFn: async () => {
            const response = await api.get(`/tickets/${id}`);
            return response.data;
        },
        enabled: !!id,
    });
}

/**
 * Create a new ticket
 */
export function useCreateTicket() {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: async (data: CreateTicketDto) => {
            const response = await api.post('/tickets', data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        },
    });
}

/**
 * Update ticket
 */
export function useUpdateTicket() {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: UpdateTicketDto }) => {
            const response = await api.patch(`/tickets/${id}`, data);
            return response.data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            queryClient.invalidateQueries({ queryKey: ['ticket', variables.id] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        },
    });
}

/**
 * Update ticket status (optimistic update)
 */
export function useUpdateTicketStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, status }: { id: string; status: string }) => {
            const response = await api.patch(`/tickets/${id}`, { status });
            return response.data;
        },
        onMutate: async ({ id, status }) => {
            await queryClient.cancelQueries({ queryKey: ['tickets'] });
            const previousTickets = queryClient.getQueryData(['tickets']);

            // Optimistic update
            queryClient.setQueryData(['tickets'], (old: PaginatedTickets | undefined) => {
                if (!old) return old;
                return {
                    ...old,
                    data: old.data.map((ticket) => 
                        ticket.id === id ? { ...ticket, status } : ticket
                    ),
                };
            });

            return { previousTickets };
        },
        onError: (_err, _variables, context) => {
            if (context?.previousTickets) {
                queryClient.setQueryData(['tickets'], context.previousTickets);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        },
    });
}

/**
 * Assign ticket to agent
 */
export function useAssignTicket() {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: async ({ ticketId, assigneeId }: { ticketId: string; assigneeId: string }) => {
            const response = await api.post(`/tickets/${ticketId}/assign`, { assigneeId });
            return response.data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            queryClient.invalidateQueries({ queryKey: ['ticket', variables.ticketId] });
        },
    });
}

/**
 * Cancel ticket
 */
export function useCancelTicket() {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: async ({ ticketId, reason }: { ticketId: string; reason?: string }) => {
            const response = await api.post(`/tickets/${ticketId}/cancel`, { reason });
            return response.data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            queryClient.invalidateQueries({ queryKey: ['ticket', variables.ticketId] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        },
    });
}

/**
 * Reply to ticket
 */
export function useReplyToTicket() {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: async ({ 
            ticketId, 
            content, 
            files,
            mentionedUserIds 
        }: { 
            ticketId: string; 
            content: string; 
            files?: string[];
            mentionedUserIds?: string[];
        }) => {
            const response = await api.post(`/tickets/${ticketId}/messages`, { 
                content, 
                files,
                mentionedUserIds,
            });
            return response.data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['ticket', variables.ticketId] });
            queryClient.invalidateQueries({ queryKey: ['ticket-messages', variables.ticketId] });
        },
    });
}

/**
 * Fetch ticket messages
 */
export function useTicketMessages(ticketId: string) {
    return useQuery({
        queryKey: ['ticket-messages', ticketId],
        queryFn: async () => {
            const response = await api.get(`/tickets/${ticketId}/messages`);
            return response.data;
        },
        enabled: !!ticketId,
    });
}

/**
 * Fetch dashboard statistics
 */
export function useDashboardStats() {
    return useQuery({
        queryKey: ['dashboard-stats'],
        queryFn: async () => {
            const response = await api.get('/tickets/stats/dashboard');
            return response.data;
        },
        staleTime: 60000, // 1 minute
    });
}
