import { useQuery, keepPreviousData } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Ticket } from './useTickets';

export interface MobileDevTicketsParams {
    page: number;
    limit: number;
    sortBy: string;
    sortOrder: 'ASC' | 'DESC';
    search: string;
}

export interface MobileDevTicketsResponse {
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

async function fetchMobileDevTickets(params: MobileDevTicketsParams): Promise<MobileDevTicketsResponse> {
    const response = await api.get('/tickets/paginated/mobile-dev', {
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

export function useMobileDevTickets(params: MobileDevTicketsParams) {
    return useQuery({
        queryKey: ['tickets', 'mobile-dev', params.page, params.limit, params.sortBy, params.sortOrder, params.search],
        queryFn: () => fetchMobileDevTickets(params),
        placeholderData: keepPreviousData,
        staleTime: 30_000,
    });
}
