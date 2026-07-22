import { useQuery, keepPreviousData } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Ticket } from './useTickets';

export interface OracleK2TicketsParams {
    page: number;
    limit: number;
    sortBy: string;
    sortOrder: 'ASC' | 'DESC';
    search: string;
}

export interface OracleK2TicketsResponse {
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

async function fetchOracleK2Tickets(params: OracleK2TicketsParams): Promise<OracleK2TicketsResponse> {
    const response = await api.get('/tickets/paginated/oracle', {
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

export function useOracleK2Tickets(params: OracleK2TicketsParams) {
    return useQuery({
        queryKey: ['tickets', 'oracle-k2', params.page, params.limit, params.sortBy, params.sortOrder, params.search],
        queryFn: () => fetchOracleK2Tickets(params),
        placeholderData: keepPreviousData,
        staleTime: 30_000,
    });
}
