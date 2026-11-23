import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/lib/api';
import { ApprovalsPage } from '../ApprovalsPage';

vi.mock('@/lib/api', () => ({ default: { get: vi.fn() } }));

afterEach(cleanup);

const row = (over: Record<string, unknown> = {}) => ({
    ticketId: 't-1', ticketNumber: '221126-QC-0035', title: 'Akses VPN', requesterName: 'Leony', requestKind: 'EFORM',
    flowPhase: 'appr_mgr', flowPhaseLabel: 'Menunggu Atasan', flowPaused: true, needsMyAction: true, ...over,
});

function Where() { return <span data-testid="where">{useLocation().pathname}</span>; }
function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={['/client/approvals']}>
                <Routes><Route path="/client/approvals" element={<ApprovalsPage />} /><Route path="/tickets/:id" element={<Where />} /></Routes>
            </MemoryRouter>
        </QueryClientProvider>,
    );
}

describe('ApprovalsPage', () => {
    beforeEach(() => vi.mocked(api.get).mockReset());

    it('lists the requests waiting for my signature, with the person who asked and the type tag', async () => {
        vi.mocked(api.get).mockResolvedValue({ data: [row(), row({ ticketId: 't-2', ticketNumber: '221126-QC-0036', title: 'Laptop Design', requesterName: 'Budi', requestKind: 'HARDWARE' })] });
        renderPage();
        expect(await screen.findByText('Akses VPN')).toBeInTheDocument();
        expect(screen.getByText('Laptop Design')).toBeInTheDocument();
        expect(screen.getByText('Leony')).toBeInTheDocument();
        expect(screen.getByText('E-Form')).toBeInTheDocument();
        expect(screen.getByText('Hardware')).toBeInTheDocument();
        expect(api.get).toHaveBeenCalledWith('/request-flow/approvals');
    });

    it('filters the approval list by type and title', async () => {
        vi.mocked(api.get).mockResolvedValue({ data: [row(), row({ ticketId: 't-2', title: 'Laptop Design', requestKind: 'HARDWARE' })] });
        renderPage();
        await screen.findByText('Laptop Design');
        fireEvent.change(screen.getByLabelText('Tipe permintaan'), { target: { value: 'EFORM' } });
        expect(screen.queryByText('Laptop Design')).not.toBeInTheDocument();
        fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'tidak cocok' } });
        expect(screen.queryByText('Akses VPN')).not.toBeInTheDocument();
    });

    it('"Sudah selesai" lists what I already signed, from the history endpoint', async () => {
        vi.mocked(api.get).mockImplementation(async (url: string) => ({ data: url === '/request-flow/approvals/history' ? [{ ...row({ ticketId: 't-7', title: 'Akses lama' }), signedAt: '2026-11-20T01:00:00.000Z' }] : [row()] }));
        renderPage();
        await screen.findByText('Akses VPN');
        fireEvent.click(screen.getByRole('button', { name: 'Sudah selesai' }));
        expect(await screen.findByText('Akses lama')).toBeInTheDocument();
        expect(screen.queryByText('Akses VPN')).not.toBeInTheDocument();
        expect(screen.queryByText('Menunggu tanda tangan Anda')).not.toBeInTheDocument();
    });

    it('a row opens its ticket, where the one green button is', async () => {
        vi.mocked(api.get).mockResolvedValue({ data: [row()] });
        renderPage();
        fireEvent.click(await screen.findByRole('link', { name: /Akses VPN/ }));
        expect(await screen.findByTestId('where')).toHaveTextContent('/tickets/t-1');
    });

    it('says so when nothing waits for me', async () => {
        vi.mocked(api.get).mockResolvedValue({ data: [] });
        renderPage();
        expect(await screen.findByText(/Tidak ada permintaan yang menunggu tanda tangan Anda/)).toBeInTheDocument();
    });

    it('says so when the list cannot be loaded', async () => {
        vi.mocked(api.get).mockResolvedValue(undefined as never);
        renderPage();
        // A response without a body is as unusable as a network failure: the page must say it could not load.
        expect(await screen.findByRole('alert')).toHaveTextContent(/Gagal memuat/);
    });
});
