import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/lib/api';
import { BentoTicketListPage } from '../BentoTicketListPage';

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));
vi.mock('@/stores/useAuth', () => ({ useAuth: () => ({ user: { id: 'agent-1', role: 'ADMIN' } }) }));
vi.mock('@/hooks/useTicketSocket', () => ({ useTicketListSocket: () => ({ isConnected: true }) }));
vi.mock('@/hooks/useSoundNotification', () => ({
    useSoundNotification: () => ({ playNewTicketSound: vi.fn(), playCriticalSound: vi.fn() }),
}));
vi.mock('../../components/BentoTicketKanban', () => ({
    BentoTicketKanban: () => <div>Kanban IT Support</div>,
}));

const latestParams = () => {
    const calls = vi.mocked(api.get).mock.calls.filter(([url]) => url.startsWith('/tickets/paginated?'));
    return new URL(calls.at(-1)![0], 'https://idesk.test').searchParams;
};

function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <MemoryRouter><BentoTicketListPage /></MemoryRouter>
        </QueryClientProvider>,
    );
}

async function clickCard(label: string) {
    fireEvent.click((await screen.findAllByText(label, { exact: true }))[0]);
}

describe('IT Support stat card filters', () => {
    beforeEach(() => {
        vi.mocked(api.get).mockReset();
        vi.mocked(api.get).mockImplementation(async (url) => ({ data: url.startsWith('/tickets/paginated?')
            ? { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } }
            : url.startsWith('/tickets/dashboard/stats')
                ? { total: 21, open: 3, inProgress: 4, waitingVendor: 5, resolved: 9, overdue: 2, critical: 1 }
                : [] }));
    });

    it('keeps card sorting available for an empty queue and disables select all', async () => {
        renderPage();
        const sort = await screen.findByLabelText('Urutkan tiket');
        expect(screen.getByRole('checkbox', { name: 'Pilih semua tiket di halaman ini' })).toBeDisabled();
        fireEvent.change(sort, { target: { value: 'priority' } });
        await waitFor(() => expect(latestParams().get('sortBy')).toBe('priority'));
        expect(latestParams().get('sortOrder')).toBe('DESC');
        fireEvent.click(screen.getByRole('button', { name: 'Ubah arah urutan: menurun' }));
        await waitFor(() => expect(latestParams().get('sortOrder')).toBe('ASC'));
    });

    it('requests completed and vendor status lists and labels the composite chip', async () => {
        renderPage();
        await clickCard('Resolved');
        await waitFor(() => expect(latestParams().get('status')).toBe('RESOLVED,CLOSED'));
        expect(screen.getByText('Status: Selesai')).toBeInTheDocument();
        await clickCard('Waiting Vendor');
        await waitFor(() => expect(latestParams().get('status')).toBe('WAITING_VENDOR'));
    });

    it('toggles overdue, clears status, and clears overdue through its chip and Total', async () => {
        renderPage();
        await clickCard('Resolved');
        await clickCard('Overdue');
        await waitFor(() => expect(latestParams().get('overdue')).toBe('true'));
        expect(latestParams().has('status')).toBe(false);
        fireEvent.click(screen.getByRole('button', { name: 'Hapus filter Overdue' }));
        await waitFor(() => expect(latestParams().has('overdue')).toBe(false));
        await clickCard('Overdue');
        await waitFor(() => expect(latestParams().get('overdue')).toBe('true'));
        await clickCard('Overdue');
        await waitFor(() => expect(latestParams().has('overdue')).toBe(false));
        await clickCard('Overdue');
        await clickCard('Total');
        await waitFor(() => expect(latestParams().has('overdue')).toBe(false));
        expect(screen.queryByRole('button', { name: 'Hapus filter Overdue' })).not.toBeInTheDocument();
    });

    it('restricts Critical to active tickets and Clear all resets every card filter', async () => {
        renderPage();
        await clickCard('Critical');
        await waitFor(() => expect(latestParams().get('priority')).toBe('CRITICAL'));
        expect(latestParams().get('status')).toBe('TODO,IN_PROGRESS,WAITING_VENDOR');
        expect(screen.getByText('Status: Aktif')).toBeInTheDocument();
        await clickCard('Overdue');
        await waitFor(() => expect(latestParams().get('overdue')).toBe('true'));
        fireEvent.click(screen.getByText('Clear all'));
        await waitFor(() => expect(latestParams().has('priority')).toBe(false));
        expect(latestParams().has('status')).toBe(false);
        expect(latestParams().has('overdue')).toBe(false);
    });

    it.each([
        ['Open', 'TODO'],
        ['In Progress', 'IN_PROGRESS'],
        ['Waiting Vendor', 'WAITING_VENDOR'],
        ['Resolved', 'RESOLVED,CLOSED'],
    ])('selecting %s clears previous Critical and Overdue constraints', async (label, status) => {
        renderPage();
        await clickCard('Critical');
        await clickCard(label);
        await waitFor(() => expect(latestParams().get('status')).toBe(status));
        expect(latestParams().has('priority')).toBe(false);
        await clickCard('Overdue');
        await clickCard(label);
        await waitFor(() => expect(latestParams().get('status')).toBe(status));
        expect(latestParams().has('overdue')).toBe(false);
        expect(latestParams().has('priority')).toBe(false);
        expect(screen.getAllByText(label, { exact: true })[0].closest('[role="button"]'))
            .toHaveAttribute('aria-pressed', 'true');
    });

    it('switches Overdue to Critical and Critical to Overdue without leftover filters', async () => {
        renderPage();
        await clickCard('Overdue');
        await clickCard('Critical');
        await waitFor(() => expect(latestParams().get('priority')).toBe('CRITICAL'));
        expect(latestParams().get('status')).toBe('TODO,IN_PROGRESS,WAITING_VENDOR');
        expect(latestParams().has('overdue')).toBe(false);
        await clickCard('Overdue');
        await waitFor(() => expect(latestParams().get('overdue')).toBe('true'));
        expect(latestParams().has('priority')).toBe(false);
        expect(latestParams().has('status')).toBe(false);
    });

    it('keeps the URL view toggle working after a composite filter', async () => {
        renderPage();
        await clickCard('Critical');
        fireEvent.click(screen.getByTitle('Kanban Board'));
        expect(await screen.findByText('Kanban IT Support')).toBeInTheDocument();
    });
});
