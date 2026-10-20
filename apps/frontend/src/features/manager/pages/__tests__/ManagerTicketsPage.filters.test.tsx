import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/lib/api';
import { ManagerTicketsPage } from '../ManagerTicketsPage';
import { ACTIVE_STATUS_FILTER } from '@/features/ticket-board/constants/statusFilters';

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));
vi.mock('@/stores/useAuth', () => ({ useAuth: () => ({ user: { id: 'mgr-1', role: 'MANAGER' } }) }));
vi.mock('@/hooks/useTicketSocket', () => ({ useTicketListSocket: () => ({ isConnected: true }) }));
vi.mock('@/hooks/useSoundNotification', () => ({
    useSoundNotification: () => ({ playNewTicketSound: vi.fn(), playCriticalSound: vi.fn() }),
}));
vi.mock('@/components/site/SiteSelector', () => ({ SiteSelector: () => null }));

const latestParams = () => {
    const calls = vi.mocked(api.get).mock.calls.filter(([url]) => url.startsWith('/tickets/paginated?'));
    return new URL(calls.at(-1)![0], 'https://idesk.test').searchParams;
};

function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <MemoryRouter><ManagerTicketsPage /></MemoryRouter>
        </QueryClientProvider>,
    );
}

async function clickCard(label: string) {
    fireEvent.click((await screen.findAllByText(label, { exact: true }))[0]);
}

describe('Manager Critical stat card', () => {
    beforeEach(() => {
        vi.mocked(api.get).mockReset();
        vi.mocked(api.get).mockImplementation(async (url) => ({ data: url.startsWith('/tickets/paginated?')
            ? { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0, hasNextPage: false, hasPrevPage: false } }
            : url.startsWith('/tickets/dashboard/stats')
                ? { total: 21, open: 3, inProgress: 4, resolved: 9, overdue: 2, critical: 1 }
                : [] }));
    });

    it('restricts the list to active critical tickets, matching what the card counts', async () => {
        renderPage();
        await clickCard('Critical');
        await waitFor(() => expect(latestParams().get('priority')).toBe('CRITICAL'));
        expect(latestParams().get('status')).toBe(ACTIVE_STATUS_FILTER);
        // The status Select shows the composite value instead of a blank trigger.
        expect(screen.getAllByText('Aktif').length).toBeGreaterThan(0);
    });

    it('clears both filters when toggled off', async () => {
        renderPage();
        await clickCard('Critical');
        await waitFor(() => expect(latestParams().get('status')).toBe(ACTIVE_STATUS_FILTER));
        await clickCard('Critical');
        await waitFor(() => expect(latestParams().has('priority')).toBe(false));
        expect(latestParams().has('status')).toBe(false);
    });
});
