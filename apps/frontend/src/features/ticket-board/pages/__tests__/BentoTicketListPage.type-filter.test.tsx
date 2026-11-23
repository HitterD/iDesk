import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/lib/api';
import { BentoTicketListPage } from '../BentoTicketListPage';

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));
vi.mock('@/stores/useAuth', () => ({ useAuth: () => ({ user: { id: 'agent-1', role: 'ADMIN' } }) }));
vi.mock('@/hooks/useTicketSocket', () => ({ useTicketListSocket: () => ({ isConnected: true }) }));
vi.mock('@/hooks/useSoundNotification', () => ({
    useSoundNotification: () => ({ playNewTicketSound: vi.fn(), playCriticalSound: vi.fn() }),
}));
vi.mock('../../components/BentoTicketKanban', () => ({ BentoTicketKanban: () => <div>Kanban IT Support</div> }));

const latest = (prefix: string) => {
    const calls = vi.mocked(api.get).mock.calls.filter(([url]) => url.startsWith(prefix));
    return new URL(calls.at(-1)![0], 'https://idesk.test').searchParams;
};

function Where() { return <span data-testid="where">{useLocation().search}</span>; }

function renderPage(path = '/tickets/list') {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={[path]}><BentoTicketListPage /><Where /></MemoryRouter>
        </QueryClientProvider>,
    );
}

describe('IT Support list "Tipe" filter', () => {
    beforeEach(() => {
        vi.mocked(api.get).mockReset();
        vi.mocked(api.get).mockImplementation(async (url) => ({ data: url.startsWith('/tickets/paginated?')
            ? { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } }
            : url.startsWith('/tickets/queue-stats?')
                ? { total: 21, open: 3, inProgress: 4, waitingVendor: 5, resolved: 9, overdue: 2, critical: 1 }
                : [] }));
    });

    it('sends no requestKind until a type is chosen', async () => {
        renderPage();
        await waitFor(() => expect(vi.mocked(api.get)).toHaveBeenCalledWith('/tickets/queue-stats?queue=it-support'));
        expect(latest('/tickets/paginated?').has('requestKind')).toBe(false);
    });

    it('opens on a shared ?type=eform link and filters list and stats by it', async () => {
        renderPage('/tickets/list?type=eform');
        await waitFor(() => expect(latest('/tickets/paginated?').get('requestKind')).toBe('EFORM'));
        await waitFor(() => expect(latest('/tickets/queue-stats?').get('requestKind')).toBe('EFORM'));
    });

    it('choosing Tipe = Hardware writes ?type=hardware and refetches with requestKind=HARDWARE', async () => {
        renderPage();
        fireEvent.click(await screen.findByText('Tipe', { exact: false }));
        fireEvent.click(await screen.findByRole('option', { name: /Hardware/ }));
        await waitFor(() => expect(latest('/tickets/paginated?').get('requestKind')).toBe('HARDWARE'));
        expect(screen.getByTestId('where').textContent).toContain('type=hardware');
        expect(latest('/tickets/queue-stats?').get('requestKind')).toBe('HARDWARE');
    });
});

describe('Tipe filter chip and reset', () => {
    beforeEach(() => {
        vi.mocked(api.get).mockReset();
        vi.mocked(api.get).mockImplementation(async (url) => ({ data: url.startsWith('/tickets/paginated?')
            ? { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } }
            : url.startsWith('/tickets/queue-stats?') ? { total: 0, open: 0, inProgress: 0, waitingVendor: 0, resolved: 0, overdue: 0, critical: 0 } : [] }));
    });

    it('shows the chosen type as a chip, and Clear all drops it', async () => {
        renderPage('/tickets/list?type=hardware');
        expect(await screen.findByText('Tipe: Hardware Request')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Clear all'));
        await waitFor(() => expect(latest('/tickets/paginated?').has('requestKind')).toBe(false));
        expect(screen.getByTestId('where').textContent).not.toContain('type=');
    });
});
