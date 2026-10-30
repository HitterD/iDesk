import { useQuery, keepPreviousData } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Ticket } from './useTickets';

export interface WebDevTicketsParams {
    page: number;
    limit: number;
    sortBy: string;
    sortOrder: 'ASC' | 'DESC';
    search: string;
    /** Server-side "Tiket yang saya buat" / "My Tasks" filters, so paging and totals stay right. */
    createdByMe?: boolean;
    assignedToMe?: boolean;
    /** List filters, applied by the server so they cover every page (status may be a comma list). */
    status?: string;
    priority?: string;
    siteIds?: string[];
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
            createdByMe: params.createdByMe || undefined,
            assignedToMe: params.assignedToMe || undefined,
            status: params.status || undefined,
            priority: params.priority || undefined,
            siteIds: params.siteIds?.length ? params.siteIds : undefined,
        },
        // siteIds=a&siteIds=b, as PaginationDto expects.
        paramsSerializer: { indexes: null },
    });
    return response.data;
}

export function useWebDevTickets(params: WebDevTicketsParams) {
    return useQuery({
        queryKey: ['tickets', 'web-dev', params.page, params.limit, params.sortBy, params.sortOrder, params.search, params.createdByMe ?? false, params.assignedToMe ?? false, params.status ?? '', params.priority ?? '', params.siteIds ?? []],
        queryFn: () => fetchWebDevTickets(params),
        placeholderData: keepPreviousData,
        staleTime: 30_000,
    });
}
