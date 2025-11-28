import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export interface SearchFilters {
    scope?: ('tickets' | 'users' | 'articles')[];
    dateRange?: { start: string; end: string };
    status?: string[];
    priority?: string[];
    assignedTo?: string;
    department?: string;
    tags?: string[];
    category?: string;
}

export interface TicketSearchResult {
    id: string;
    ticketNumber: string;
    title: string;
    status: string;
    priority: string;
    createdAt: string;
    userName?: string;
    assignedToName?: string;
    highlight?: string;
    category?: string;
    source?: string;
}

export interface UserSearchResult {
    id: string;
    fullName: string;
    email: string;
    department?: string;
    jobTitle?: string;
    role: string;
    highlight?: string;
}

export interface ArticleSearchResult {
    id: string;
    title: string;
    category?: string;
    tags?: string[];
    highlight?: string;
    viewCount: number;
    createdAt: string;
}

export interface SearchResult {
    tickets: TicketSearchResult[];
    users: UserSearchResult[];
    articles: ArticleSearchResult[];
    totalCount: number;
    timing: number;
    page: number;
    limit: number;
    hasMore: boolean;
}

export interface SearchSuggestion {
    text: string;
    type: 'ticket' | 'user' | 'article' | 'tag';
    id?: string;
}

export interface SavedSearch {
    id: string;
    name: string;
    description?: string;
    query?: string;
    filters: SearchFilters;
    useCount: number;
    createdAt: string;
}

interface SearchParams {
    q?: string;
    page?: number;
    limit?: number;
    filters?: SearchFilters;
}

export function useSearch(params: SearchParams) {
    const { q, page = 1, limit = 20, filters } = params;
    
    return useQuery<SearchResult>({
        queryKey: ['search', q, page, limit, filters],
        queryFn: async () => {
            const queryParams = new URLSearchParams();
            if (q) queryParams.set('q', q);
            queryParams.set('page', String(page));
            queryParams.set('limit', String(limit));
            
            if (filters?.scope) {
                filters.scope.forEach(s => queryParams.append('scope', s));
            }
            if (filters?.status) {
                filters.status.forEach(s => queryParams.append('status', s));
            }
            if (filters?.priority) {
                filters.priority.forEach(p => queryParams.append('priority', p));
            }
            if (filters?.assignedTo) {
                queryParams.set('assignedTo', filters.assignedTo);
            }
            if (filters?.department) {
                queryParams.set('department', filters.department);
            }
            if (filters?.category) {
                queryParams.set('category', filters.category);
            }
            
            const response = await api.get(`/search?${queryParams.toString()}`);
            return response.data;
        },
        enabled: Boolean(q && q.length >= 2),
        staleTime: 60000, // 1 minute
    });
}

export function useSearchSuggestions(query: string) {
    return useQuery<SearchSuggestion[]>({
        queryKey: ['search-suggestions', query],
        queryFn: async () => {
            const response = await api.get(`/search/suggestions?q=${encodeURIComponent(query)}`);
            return response.data;
        },
        enabled: Boolean(query && query.length >= 2),
        staleTime: 300000, // 5 minutes
    });
}

export function useSavedSearches() {
    return useQuery<SavedSearch[]>({
        queryKey: ['saved-searches'],
        queryFn: async () => {
            const response = await api.get('/search/saved');
            return response.data;
        },
    });
}

export function useSaveSearch() {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: async (data: { name: string; query?: string; filters: SearchFilters; description?: string }) => {
            const response = await api.post('/search/saved', data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['saved-searches'] });
        },
    });
}

export function useDeleteSavedSearch() {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: async (searchId: string) => {
            await api.delete(`/search/saved/${searchId}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['saved-searches'] });
        },
    });
}

export function usePopularSearches() {
    return useQuery<string[]>({
        queryKey: ['popular-searches'],
        queryFn: async () => {
            const response = await api.get('/search/popular');
            return response.data;
        },
        staleTime: 600000, // 10 minutes
    });
}
