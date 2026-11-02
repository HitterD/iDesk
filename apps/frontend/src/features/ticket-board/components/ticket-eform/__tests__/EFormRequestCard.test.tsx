import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EFormProgress, EFormRequestCard } from '../EFormRequestCard';
import type { TicketEFormRequest } from '../eformFlow';

const api = vi.hoisted(() => ({ cancel: vi.fn(() => Promise.resolve()) }));
vi.mock('../api', () => ({ ticketEFormApi: api }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const request: TicketEFormRequest = {
    id: 'ef-1', code: '#3F2A9C1B', formType: 'VPN', status: 'DRAFT', note: 'WFH, perlu remote ke PC kantor', requesterId: 'u-1',
    proposedBy: { id: 'a-1', name: 'Agen' }, approverName: null, rejectionReason: null,
    createdAt: '2026-10-24T06:00:00Z', submittedAt: null, resolvedAt: null,
};
const proposed = { id: 'ef-1', code: '#3F2A9C1B', formType: 'VPN', phase: 'PROPOSED' as const };

const renderCard = (props: Partial<React.ComponentProps<typeof EFormRequestCard>> = {}) => render(
    <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
            <EFormRequestCard event={proposed} createdAt="2026-10-24T06:00:00Z" ticketId="t-1" isRequester
                eformBasePath="/client/eform-access" request={request} actorName="Agen" {...props} />
        </MemoryRouter>
    </QueryClientProvider>,
);

describe('EFormRequestCard', () => {
    beforeEach(() => vi.clearAllMocks());

    it('sends the requester to sign the prefilled e-form and back to the ticket', () => {
        renderCard();
        expect(screen.getByText('WFH, perlu remote ke PC kantor')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Lengkapi & tanda tangani/ }))
            .toHaveAttribute('href', '/client/eform-access/new?proposal=ef-1&ticket=t-1');
    });

    it('lets the requester decline after confirming', async () => {
        renderCard();
        fireEvent.click(screen.getByRole('button', { name: 'Tolak' }));
        fireEvent.click(screen.getByRole('button', { name: 'Ya, tolak' }));
        await waitFor(() => expect(api.cancel).toHaveBeenCalledWith('ef-1', expect.anything()));
    });

    it('lets IT withdraw, not sign', () => {
        renderCard({ isRequester: false });
        expect(screen.queryByRole('link', { name: /tanda tangani/ })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Tarik usulan' })).toBeInTheDocument();
    });

    it('follows the request once signed, and shows the agent ICT\'s next step', () => {
        renderCard({ isRequester: false, request: { ...request, status: 'PENDING_ICT' } });
        expect(screen.getByRole('list', { name: 'Progres akses E-Form' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Proses akses/ })).toHaveAttribute('href', '/client/eform-access/ef-1');
    });

    it('shows the running document number once the form is submitted', () => {
        renderCard({ isRequester: false, request: { ...request, status: 'PENDING_MANAGER', documentNumber: 'F/ICT/04/0012' } });
        expect(screen.getByText(/No\. F\/ICT\/04\/0012/)).toBeInTheDocument();
    });

    it('says the ticket was closed only when granting the access really closed it', () => {
        const { unmount } = renderCard({ event: { ...proposed, phase: 'GRANTED' }, ticketMove: 'closed' });
        expect(screen.getByText(/aktif\. Tiket ditutup otomatis/)).toBeInTheDocument();
        unmount();
        // Another request of the ticket is still running: the line must not claim the ticket closed.
        renderCard({ event: { ...proposed, phase: 'GRANTED' }, ticketMove: null });
        expect(screen.queryByText(/ditutup otomatis/)).not.toBeInTheDocument();
    });

    it('shows the GM step line', () => {
        renderCard({ event: { ...proposed, phase: 'GM_APPROVED' } });
        expect(screen.getByText(/disetujui GM/)).toBeInTheDocument();
    });

    it('keeps the step labels out of the narrow sidebar bar but available to screen readers', () => {
        const { container } = render(<EFormProgress request={{ formType: 'VPN', status: 'PENDING_GM' }} compact />);
        const bar = container.querySelector('ol')!;
        expect(bar).toHaveClass('is-compact');
        expect(bar.querySelectorAll('li')).toHaveLength(5);
        expect(bar.querySelector('li[aria-current="step"]')).toHaveAttribute('title', 'Persetujuan GM');
    });

    it('renders later steps as one line with the reason', () => {
        renderCard({ event: { ...proposed, phase: 'REJECTED' }, reason: 'Tidak sesuai kebijakan' });
        expect(screen.getByText(/ditolak/)).toBeInTheDocument();
        expect(screen.getByText('“Tidak sesuai kebijakan”')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Akses VPN #3F2A9C1B' })).toHaveAttribute('href', '/client/eform-access/ef-1');
    });
});
