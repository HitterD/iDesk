import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { useResetPageOnChange, useTicketListUrlState } from '../useTicketListUrlState';

const wrapperAt = (url: string) => ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
);

function useListWithLocation(resetOn?: unknown) {
    const state = useTicketListUrlState();
    useResetPageOnChange([state.statusFilter, resetOn], state.setCurrentPage);
    return { ...state, search: useLocation().search };
}

describe('useTicketListUrlState', () => {
    it('restores filters and page from the URL, so Back lands on the same filtered view', () => {
        const { result } = renderHook(() => useListWithLocation(), {
            wrapper: wrapperAt('/tickets/list?status=IN_PROGRESS&priority=HIGH&overdue=1&sites=a,b&q=printer&page=3'),
        });

        expect(result.current).toMatchObject({
            statusFilter: 'IN_PROGRESS',
            priorityFilter: 'HIGH',
            overdueFilter: true,
            selectedSites: ['a', 'b'],
            searchQuery: 'printer',
            currentPage: 3,
        });
    });

    it('writes filter changes into the URL and keeps the other params', () => {
        const { result } = renderHook(() => useListWithLocation(), {
            wrapper: wrapperAt('/tickets/list?filter=assigned_to_me'),
        });

        act(() => result.current.setStatusFilter('IN_PROGRESS'));

        const params = new URLSearchParams(result.current.search);
        expect(params.get('status')).toBe('IN_PROGRESS');
        expect(params.get('filter')).toBe('assigned_to_me');
    });

    it('leaves the URL clean when nothing is filtered', () => {
        const { result } = renderHook(() => useListWithLocation(), {
            wrapper: wrapperAt('/tickets/list?status=TODO'),
        });

        act(() => result.current.setStatusFilter(''));

        expect(result.current.search).toBe('');
    });

    it('resets to page 1 when a filter changes, but not on mount', () => {
        const { result } = renderHook(() => useListWithLocation(), {
            wrapper: wrapperAt('/tickets/list?status=TODO&page=2'),
        });
        expect(result.current.currentPage).toBe(2);

        act(() => result.current.setStatusFilter('IN_PROGRESS'));

        expect(result.current.currentPage).toBe(1);
        expect(new URLSearchParams(result.current.search).has('page')).toBe(false);
    });

    it('ignores an invalid page in the URL', () => {
        const { result } = renderHook(() => useListWithLocation(), { wrapper: wrapperAt('/tickets/list?page=-4') });
        expect(result.current.currentPage).toBe(1);
    });
});
