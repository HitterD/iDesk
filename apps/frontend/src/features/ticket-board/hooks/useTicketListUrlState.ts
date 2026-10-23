import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/** URL keys of a ticket list view; short so a restored or shared link stays readable. */
const PARAM = {
    search: 'q',
    status: 'status',
    priority: 'priority',
    overdue: 'overdue',
    sites: 'sites',
    page: 'page',
} as const;

const parsePage = (raw: string | null): number => {
    const page = Number.parseInt(raw ?? '', 10);
    return Number.isFinite(page) && page > 0 ? page : 1;
};

/**
 * Search, filters and page of a ticket list, mirrored into the URL (replace, no extra history entries).
 * Opening a ticket records the list's path + query as `state.from`, so "Back" lands on the same filtered
 * view instead of the unfiltered total; a reload keeps it too. Other params (view, filter scope) are kept.
 */
export function useTicketListUrlState() {
    const [searchParams, setSearchParams] = useSearchParams();

    const [searchQuery, setSearchQuery] = useState(() => searchParams.get(PARAM.search) ?? '');
    const [statusFilter, setStatusFilter] = useState(() => searchParams.get(PARAM.status) ?? '');
    const [priorityFilter, setPriorityFilter] = useState(() => searchParams.get(PARAM.priority) ?? '');
    const [overdueFilter, setOverdueFilter] = useState(() => searchParams.get(PARAM.overdue) === '1');
    const [selectedSites, setSelectedSites] = useState<string[]>(
        () => (searchParams.get(PARAM.sites) ?? '').split(',').filter(Boolean),
    );
    const [currentPage, setCurrentPage] = useState(() => parsePage(searchParams.get(PARAM.page)));

    useEffect(() => {
        const next = new URLSearchParams(searchParams);
        const put = (key: string, value: string) => (value ? next.set(key, value) : next.delete(key));
        put(PARAM.search, searchQuery.trim() ? searchQuery : '');
        put(PARAM.status, statusFilter);
        put(PARAM.priority, priorityFilter);
        put(PARAM.overdue, overdueFilter ? '1' : '');
        put(PARAM.sites, selectedSites.join(','));
        put(PARAM.page, currentPage > 1 ? String(currentPage) : '');
        // Also re-applies the state after a navigation that rewrote the query (scope tabs, view toggle).
        if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
    }, [searchParams, setSearchParams, searchQuery, statusFilter, priorityFilter, overdueFilter, selectedSites, currentPage]);

    return {
        searchQuery, setSearchQuery,
        statusFilter, setStatusFilter,
        priorityFilter, setPriorityFilter,
        overdueFilter, setOverdueFilter,
        selectedSites, setSelectedSites,
        currentPage, setCurrentPage,
    };
}

/**
 * Back to page 1 when what the list shows changes, but never on mount: a page restored from the URL
 * survives (and React StrictMode's double effect run cannot reset it either).
 */
export function useResetPageOnChange(deps: readonly unknown[], setCurrentPage: (page: number) => void): void {
    const key = JSON.stringify(deps);
    const previous = useRef(key);
    useEffect(() => {
        if (previous.current === key) return;
        previous.current = key;
        setCurrentPage(1);
    }, [key, setCurrentPage]);
}
