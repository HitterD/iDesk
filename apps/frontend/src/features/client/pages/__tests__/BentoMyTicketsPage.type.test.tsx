import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/lib/api';
import { BentoMyTicketsPage } from '../BentoMyTicketsPage';

const base = { priority: 'MEDIUM', category: 'GENERAL', createdAt: '2026-11-20T08:00:00.000Z', updatedAt: '2026-11-20T10:00:00.000Z', hasUnreadChat: false, assignedTo: null };
const TICKETS = [
    { ...base, id: 't-1', ticketNumber: 'A-1', title: 'Printer rusak', status: 'TODO', ticketType: 'SERVICE' },
    { ...base, id: 't-2', ticketNumber: 'A-2', title: 'Akses VPN', status: 'RESOLVED', ticketType: 'EFORM_REQUEST', requestKind: 'EFORM', flowPhase: 'confirm', flowPhaseLabel: 'Menunggu konfirmasi pemohon', flowPaused: false, needsMyAction: true },
    { ...base, id: 't-3', ticketNumber: 'A-3', title: 'Laptop Design', status: 'WAITING_VENDOR', ticketType: 'HARDWARE_REQUEST', requestKind: 'HARDWARE', flowPhase: 'delivery', flowPhaseLabel: 'Menunggu barang tiba', flowPaused: true, needsMyAction: false },
];
const ACCESS = [{ eformId: 'ef-1', ticketId: 't-9', kind: 'VPN', startDate: '2026-02-01', endDate: '2026-11-28', group: 'soon', daysLeft: 5 }];

vi.mock('@/lib/api', () => ({ default: { get: vi.fn() } }));
vi.mock('@/stores/useAuth', () => ({ useAuth: () => ({ user: { id: 'u-1', role: 'USER', fullName: 'Rina' } }) }));
vi.mock('@/hooks/useTicketSocket', () => ({ useTicketListSocket: () => ({ isConnected: true }) }));
vi.mock('@/lib/socket', () => ({ useSocket: () => ({ socket: { on: vi.fn(), off: vi.fn(), emit: vi.fn() }, isConnected: true }) }));

afterEach(cleanup);

const listUrls = () => vi.mocked(api.get).mock.calls.map(([url]) => String(url)).filter((url) => url.startsWith('/tickets/paginated') && !url.includes('limit=1&') && !url.endsWith('limit=1'));

function Where() { const location = useLocation(); return <span data-testid="where">{location.pathname + location.search}</span>; }

function renderPage(path = '/client/my-tickets') {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={[path]}>
                <Routes>
                    <Route path="/client/my-tickets" element={<BentoMyTicketsPage />} />
                    <Route path="/client/create" element={<Where />} />
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>,
    );
}
const kindButton = (name: string) => within(screen.getByRole('group', { name: 'Filter tipe tiket' })).getByRole('button', { name });

describe('BentoMyTicketsPage with request tickets', () => {
    beforeEach(() => {
        vi.mocked(api.get).mockReset();
        vi.mocked(api.get).mockImplementation(async (url: string) => {
            if (url.startsWith('/request-flow/my-access')) return { data: ACCESS };
            if (url.startsWith('/tickets/paginated')) {
                const params = new URLSearchParams(url.split('?')[1]);
                if (params.get('limit') === '1') return { data: { data: [], meta: { total: 3 } } };
                return { data: { data: TICKETS, meta: { total: 3, page: 1, limit: 10, totalPages: 1, hasNextPage: false, hasPrevPage: false } } };
            }
            return { data: {} };
        });
    });

    it('shows the type tag, the phase and "Perlu tindakan Anda" on a request ticket, and nothing extra on an IT ticket', async () => {
        renderPage();
        await waitFor(() => expect(screen.getAllByText('Akses VPN').length).toBeGreaterThan(0));
        expect(screen.getAllByText('E-Form').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Menunggu konfirmasi pemohon').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Perlu tindakan Anda').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Hardware').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Menunggu barang tiba').length).toBeGreaterThan(0);
    });

    it('the Tipe segment filters the list by requestKind', async () => {
        renderPage();
        await screen.findByRole('group', { name: 'Filter tipe tiket' });
        await waitFor(() => expect(listUrls().length).toBeGreaterThan(0));
        expect(listUrls().every((url) => !url.includes('requestKind'))).toBe(true);
        fireEvent.click(kindButton('Hardware'));
        await waitFor(() => expect(listUrls().some((url) => url.includes('requestKind=HARDWARE'))).toBe(true));
        fireEvent.click(kindButton('E-Form'));
        await waitFor(() => expect(listUrls().some((url) => url.includes('requestKind=EFORM'))).toBe(true));
        fireEvent.click(kindButton('IT Support'));
        await waitFor(() => expect(listUrls().some((url) => url.includes('requestKind=IT'))).toBe(true));
    });

    it('shows the active access cards with days left above the list', async () => {
        renderPage();
        expect(await screen.findByText('Sisa 5 hari')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Perpanjang' })).toBeInTheDocument();
        expect(api.get).toHaveBeenCalledWith('/request-flow/my-access');
    });

    it('renewing opens the e-form form with ?renewFrom of that ticket', async () => {
        renderPage();
        fireEvent.click(await screen.findByRole('button', { name: 'Perpanjang' }));
        expect(await screen.findByTestId('where')).toHaveTextContent('/client/create?type=eform&renewFrom=t-9');
    });
});
