import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HardwareRequestCard } from '../HardwareRequestCard';
import type { TicketHardwareRequest } from '../hardwareFlow';

const api = vi.hoisted(() => ({
    accept: vi.fn(() => Promise.resolve()), decline: vi.fn(() => Promise.resolve()),
    pickSlot: vi.fn(() => Promise.resolve()), confirmSchedule: vi.fn(() => Promise.resolve()),
    confirmInstallation: vi.fn(() => Promise.resolve()),
}));
vi.mock('../api', () => ({ ticketHardwareApi: api }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const request: TicketHardwareRequest = {
    id: 'req-1', requestNumber: 'HR-2026-0012', status: 'DRAFT', requestType: 'HARDWARE_INSTALLATION',
    justification: 'Mouse rusak', rejectReason: null, requesterId: 'u-1', proposedBy: { id: 'a-1', name: 'Agen' },
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

    it('lets the requester confirm the installation, or report a problem, in the chat', async () => {
        renderCard({ request: { ...request, status: 'AWAITING_USER_CONFIRMATION' } });
        expect(screen.getByRole('list', { name: 'Progres hardware request' })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Ada masalah' }));
        const send = screen.getByRole('button', { name: 'Kirim laporan' });
        expect(send).toBeDisabled();
        fireEvent.change(screen.getByRole('textbox', { name: 'Masalah yang ditemukan' }), { target: { value: 'Mouse tidak terdeteksi' } });
        fireEvent.click(send);
        await waitFor(() => expect(api.confirmInstallation).toHaveBeenCalledWith(
            { requestId: 'req-1', ok: false, comments: 'Mouse tidak terdeteksi' }, expect.anything()));
    });

    it('lets the requester pick one of the offered installation slots', async () => {
        const slots = [{ start: '2026-10-27T02:00:00Z', end: '2026-10-27T03:00:00Z' }, { start: '2026-10-28T07:00:00Z', end: '2026-10-28T08:00:00Z' }];
        renderCard({ request: { ...request, status: 'INSTALLATION', schedule: { id: 's-1', start: null, end: null, status: 'PROPOSED_AWAITING_USER', proposedById: 'ict-1', slots } } });

        expect(screen.getByRole('button', { name: 'Pilih jadwal ini' })).toBeDisabled();
        fireEvent.click(screen.getByRole('radio', { name: /Rabu, 28 Oktober · 14\.00–15\.00 WIB/ }));
        fireEvent.click(screen.getByRole('button', { name: 'Pilih jadwal ini' }));
        await waitFor(() => expect(api.pickSlot).toHaveBeenCalledWith({ requestId: 'req-1', scheduleId: 's-1', slotIndex: 1 }, expect.anything()));
    });

    it('lets the requester accept a moved installation time', async () => {
        renderCard({ request: { ...request, status: 'INSTALLATION', schedule: { id: 's-2', start: '2026-10-27T02:00:00Z', end: '2026-10-27T03:00:00Z', status: 'PROPOSED', proposedById: 'ict-1', slots: [] } } });
        expect(screen.getByText('Selasa, 27 Oktober · 09.00–10.00 WIB')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Setujui jadwal' }));
        await waitFor(() => expect(api.confirmSchedule).toHaveBeenCalledWith('req-1', expect.anything()));
    });

    it('shows the agent what ICT does next instead of the requester\'s questions', () => {
        renderCard({ isRequester: false, request: { ...request, status: 'SUBMITTED' } });
        expect(screen.getByRole('link', { name: /Jadwalkan pemasangan/ })).toHaveAttribute('href', '/client/hardware-requests/req-1');
        expect(screen.queryByRole('button', { name: /Ya, sudah berfungsi/ })).not.toBeInTheDocument();
    });

    it('renders later steps as one line with the reason', () => {
        renderCard({ event: { ...proposed, phase: 'REJECTED' }, reason: 'Stok habis' });
        expect(screen.getByText(/ditolak ICT/)).toBeInTheDocument();
        expect(screen.getByText('“Stok habis”')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'HR-2026-0012' })).toHaveAttribute('href', '/client/hardware-requests/req-1');
    });

    it('says the ticket was closed only when the step really closed it', () => {
        const { unmount } = renderCard({ event: { ...proposed, phase: 'COMPLETED' }, ticketMove: 'closed' });
        expect(screen.getByText(/selesai\. Tiket ditutup otomatis/)).toBeInTheDocument();
        unmount();
        // Another request of the ticket is still running: the ticket stays open, and the line does not claim otherwise.
        renderCard({ event: { ...proposed, phase: 'COMPLETED' }, ticketMove: null });
        expect(screen.getByText(/selesai/)).toBeInTheDocument();
        expect(screen.queryByText(/ditutup otomatis/)).not.toBeInTheDocument();
    });

    it('shows when the requester asked for another installation time, with why', () => {
        renderCard({ event: { ...proposed, phase: 'RESCHEDULE_REQUESTED' }, reason: 'Saya cuti hari itu' });
        expect(screen.getByText(/pemohon minta jadwal pemasangan lain/)).toBeInTheDocument();
        expect(screen.getByText('“Saya cuti hari itu”')).toBeInTheDocument();
    });
});
