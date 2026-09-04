import { useQuery, keepPreviousData } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Ticket } from './useTickets';

export interface WebDevTicketsParams {
    page: number;
    limit: number;
    sortBy: string;
    sortOrder: 'ASC' | 'DESC';
    search: string;
}

export interface WebDevTicketsResponse {
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

async function fetchWebDevTickets(params: WebDevTicketsParams): Promise<WebDevTicketsResponse> {
    const response = await api.get('/tickets/paginated/web-dev', {
        params: {
            page: params.page,
            limit: params.limit,
            sortBy: params.sortBy,
            sortOrder: params.sortOrder,
            search: params.search || undefined,
        },
    });
    return response.data;
}

export function useWebDevTickets(params: WebDevTicketsParams) {
    return useQuery({
        queryKey: ['tickets', 'web-dev', params.page, params.limit, params.sortBy, params.sortOrder, params.search],
        queryFn: () => fetchWebDevTickets(params),
        placeholderData: keepPreviousData,
        staleTime: 30_000,
    });
}
