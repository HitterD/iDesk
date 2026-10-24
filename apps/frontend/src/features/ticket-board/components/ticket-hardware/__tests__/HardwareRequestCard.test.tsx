import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HardwareRequestCard } from '../HardwareRequestCard';
import type { TicketHardwareRequest } from '../hardwareFlow';

const api = vi.hoisted(() => ({ accept: vi.fn(() => Promise.resolve()), decline: vi.fn(() => Promise.resolve()) }));
vi.mock('../api', () => ({ ticketHardwareApi: api }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const request: TicketHardwareRequest = {
    id: 'req-1', requestNumber: 'HR-2026-0012', status: 'DRAFT', requestType: 'HARDWARE_INSTALLATION',
    justification: 'Mouse rusak', rejectReason: null, proposedBy: { id: 'a-1', name: 'Agen' },
    items: [{ name: 'Mouse Standard', category: 'ACCESSORY', quantity: 2 }], schedule: null,
    createdAt: '2026-10-24T06:00:00Z', submittedAt: null, approvedAt: null, procuredAt: null, installMarkedDoneAt: null, completedAt: null,
};
const proposed = { id: 'req-1', number: 'HR-2026-0012', phase: 'PROPOSED' as const };

const renderCard = (props: Partial<React.ComponentProps<typeof HardwareRequestCard>> = {}) => render(
    <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
            <HardwareRequestCard event={proposed} createdAt="2026-10-24T06:00:00Z" ticketId="t-1" isRequester
                hardwareBasePath="/client/hardware-requests" request={request} actorName="Agen" {...props} />
        </MemoryRouter>
    </QueryClientProvider>,
);

describe('HardwareRequestCard', () => {
    beforeEach(() => vi.clearAllMocks());

    it('lets the requester accept a proposal from the chat', async () => {
        renderCard();
        expect(screen.getByText('Mouse Standard')).toBeInTheDocument();
        expect(screen.getByText('×2')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /Setujui & ajukan/ }));

        await waitFor(() => expect(api.accept).toHaveBeenCalledWith('req-1', expect.anything()));
    });

    it('asks once more before declining', async () => {
        renderCard();
        fireEvent.click(screen.getByRole('button', { name: 'Tolak' }));
        expect(api.decline).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Ya, tolak' }));

        await waitFor(() => expect(api.decline).toHaveBeenCalledWith('req-1', expect.anything()));
    });

    it('shows staff that the requester still has to answer', () => {
        renderCard({ isRequester: false });
        expect(screen.queryByRole('button', { name: /Setujui/ })).not.toBeInTheDocument();
        expect(screen.getByText('Menunggu konfirmasi pemohon')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Tarik usulan' })).toBeInTheDocument();
    });

    it('lets staff withdraw an unanswered proposal after confirming', async () => {
        renderCard({ isRequester: false });
        fireEvent.click(screen.getByRole('button', { name: 'Tarik usulan' }));
        fireEvent.click(screen.getByRole('button', { name: 'Ya, tarik' }));

        await waitFor(() => expect(api.decline).toHaveBeenCalledWith('req-1', expect.anything()));
    });

    it('sends the requester to confirm the installation once it is done', () => {
        renderCard({ request: { ...request, status: 'AWAITING_USER_CONFIRMATION' } });
        expect(screen.getByRole('link', { name: /Konfirmasi pemasangan/ })).toHaveAttribute('href', '/client/hardware-requests/req-1');
        expect(screen.getByRole('list', { name: 'Progres hardware request' })).toBeInTheDocument();
    });

    it('renders later steps as one line with the reason', () => {
        renderCard({ event: { ...proposed, phase: 'REJECTED' }, reason: 'Stok habis' });
        expect(screen.getByText(/ditolak ICT/)).toBeInTheDocument();
        expect(screen.getByText('“Stok habis”')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'HR-2026-0012' })).toHaveAttribute('href', '/client/hardware-requests/req-1');
    });
});
