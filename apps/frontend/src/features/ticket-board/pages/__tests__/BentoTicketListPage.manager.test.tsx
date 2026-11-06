import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/lib/api';
import { BentoTicketListPage } from '../BentoTicketListPage';

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));
vi.mock('@/stores/useAuth', () => ({ useAuth: () => ({ user: { id: 'mgr-1', role: 'MANAGER' } }) }));
vi.mock('@/hooks/useTicketSocket', () => ({ useTicketListSocket: () => ({ isConnected: true }) }));
vi.mock('@/hooks/useSoundNotification', () => ({
    useSoundNotification: () => ({ playNewTicketSound: vi.fn(), playCriticalSound: vi.fn() }),
}));
vi.mock('@/components/site/SiteSelector', () => ({ SiteSelector: () => null }));
vi.mock('../../components/BentoTicketKanban', () => ({ BentoTicketKanban: () => null }));

const lastCall = (prefix: string) => {
    const calls = vi.mocked(api.get).mock.calls.filter(([url]) => url.startsWith(prefix));
    return new URL(calls.at(-1)![0], 'https://idesk.test').searchParams;
};

function renderPage(path = '/manager/tickets') {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={[path]}><BentoTicketListPage /></MemoryRouter>
        </QueryClientProvider>,
    );
}

describe('Manager ticket overview (admin list layout, every team)', () => {
    beforeEach(() => {
        vi.mocked(api.get).mockReset();
        vi.mocked(api.get).mockImplementation(async (url) => ({ data: url.startsWith('/tickets/paginated?')
            ? { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } }
            : url.startsWith('/tickets/queue-stats?')
                ? { total: 21, open: 8, inProgress: 4, waitingVendor: 0, resolved: 9, overdue: 2, critical: 1 }
                : [] }));
    });

    it('lists and counts every team, so the Open card and its list agree', async () => {
        renderPage();
        await waitFor(() => expect(lastCall('/tickets/paginated?').get('allTeams')).toBe('true'));
        expect(lastCall('/tickets/queue-stats?').get('queue')).toBe('all');

        fireEvent.click((await screen.findAllByText('Open', { exact: true }))[0]);
        await waitFor(() => expect(lastCall('/tickets/paginated?').get('status')).toBe('TODO'));
        expect(lastCall('/tickets/paginated?').get('allTeams')).toBe('true');
    });

    it('narrows the list and the cards to one team from the URL', async () => {
        renderPage('/manager/tickets?team=ORACLE_DEV');
        await waitFor(() => expect(lastCall('/tickets/paginated?').get('handlingTeam')).toBe('ORACLE_DEV'));
        expect(lastCall('/tickets/queue-stats?').get('handlingTeam')).toBe('ORACLE_DEV');
        expect(await screen.findByText('Tim')).toBeInTheDocument();
    });

    it('narrows to every developer team with ALL_DEV', async () => {
        renderPage('/manager/tickets?team=ALL_DEV');
        await waitFor(() => expect(lastCall('/tickets/paginated?').get('handlingTeam')).toBe('ALL_DEV'));
        expect(lastCall('/tickets/queue-stats?').get('handlingTeam')).toBe('ALL_DEV');
    });
});
