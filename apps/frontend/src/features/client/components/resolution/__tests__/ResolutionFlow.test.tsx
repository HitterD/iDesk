import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import api from '@/lib/api';
import { toast } from 'sonner';
import { ResolutionConfirmationBanner } from '../ResolutionConfirmationBanner';
import { SelfResolveButton } from '../SelfResolveButton';
import { AgentRatingForm } from '../AgentRatingForm';

vi.mock('@/lib/api', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(() => Promise.resolve({ data: {} })),
    },
}));

vi.mock('sonner', () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}));

const mockedApi = api as unknown as { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };

const renderWithClient = (ui: React.ReactElement) => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
    return { invalidateSpy };
};

beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.post.mockResolvedValue({ data: {} });
});

describe('ResolutionConfirmationBanner', () => {
    it('confirms resolution and invalidates the ticket query', async () => {
        const onConfirmed = vi.fn();
        const { invalidateSpy } = renderWithClient(
            <ResolutionConfirmationBanner ticketId="t-1" deadlineAt="2026-08-20T10:00:00.000Z" onConfirmed={onConfirmed} />,
        );

        expect(screen.getByText(/Tiket akan ditutup otomatis pada/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Ya, sudah selesai' }));

        await waitFor(() => expect(onConfirmed).toHaveBeenCalled());
        expect(mockedApi.post).toHaveBeenCalledWith('/tickets/t-1/confirm-resolution', {}, { skipToast: true });
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['ticket', 't-1'] });
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['tickets'] });
    });

    it('requires a reason before disputing, then posts it', async () => {
        renderWithClient(<ResolutionConfirmationBanner ticketId="t-1" />);

        fireEvent.click(screen.getByRole('button', { name: 'Masih bermasalah' }));
        const submit = screen.getByRole('button', { name: 'Buka Kembali Tiket' });
        expect(submit).toBeDisabled();

        const textarea = screen.getByLabelText(/Alasan/);
        expect(textarea).toHaveAttribute('maxLength', '1000');
        fireEvent.change(textarea, { target: { value: '   ' } });
        expect(submit).toBeDisabled();

        fireEvent.change(textarea, { target: { value: '  Printer masih error  ' } });
        expect(submit).toBeEnabled();
        fireEvent.click(submit);

        await waitFor(() =>
            expect(mockedApi.post).toHaveBeenCalledWith(
                '/tickets/t-1/dispute',
                { reason: 'Printer masih error' },
                { skipToast: true },
            ),
        );
        await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    });

    it('shows the backend message when confirmation fails', async () => {
        mockedApi.post.mockRejectedValueOnce({ response: { data: { message: 'Batas konfirmasi sudah lewat' } } });
        renderWithClient(<ResolutionConfirmationBanner ticketId="t-1" />);

        fireEvent.click(screen.getByRole('button', { name: 'Ya, sudah selesai' }));
        await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Batas konfirmasi sudah lewat'));
    });
});

describe('SelfResolveButton', () => {
    it('asks for confirmation before closing the ticket', async () => {
        const onResolved = vi.fn();
        renderWithClient(<SelfResolveButton ticketId="t-2" onResolved={onResolved} />);

        fireEvent.click(screen.getByRole('button', { name: 'Masalah sudah selesai' }));
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
        expect(screen.getByText(/akan ditutup dan tidak dapat dibalas lagi/)).toBeInTheDocument();
        expect(mockedApi.post).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Ya, tutup tiket' }));
        await waitFor(() => expect(onResolved).toHaveBeenCalled());
        expect(mockedApi.post).toHaveBeenCalledWith('/tickets/t-2/self-resolve', {}, { skipToast: true });
    });

    it('does nothing when the dialog is cancelled', () => {
        renderWithClient(<SelfResolveButton ticketId="t-2" />);
        fireEvent.click(screen.getByRole('button', { name: 'Masalah sudah selesai' }));
        fireEvent.click(screen.getAllByRole('button', { name: 'Belum' })[0]);
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
        expect(mockedApi.post).not.toHaveBeenCalled();
    });
});

describe('AgentRatingForm', () => {
    it('submits star ratings and trimmed comments for unrated agents only', async () => {
        mockedApi.get.mockResolvedValue({
            data: {
                canRate: true,
                ratingDeadline: '2026-08-27T10:00:00.000Z',
                agents: [
                    { agentId: 'a-1', fullName: 'Agent Satu', rating: null, comment: null },
                    { agentId: 'a-2', fullName: 'Agent Dua', rating: null, comment: null },
                    { agentId: 'a-3', fullName: 'Agent Tiga', rating: 4, comment: 'Sudah dinilai' },
                ],
            },
        });
        renderWithClient(<AgentRatingForm ticketId="t-3" />);

        expect(await screen.findByText('Agent Satu')).toBeInTheDocument();
        // Already-rated agent is read-only (no radio buttons for it).
        expect(screen.getByText('Sudah dinilai')).toBeInTheDocument();
        expect(screen.queryByRole('radio', { name: /untuk Agent Tiga/ })).not.toBeInTheDocument();

        const submit = screen.getByRole('button', { name: 'Kirim Penilaian' });
        expect(submit).toBeDisabled();

        fireEvent.click(screen.getByRole('radio', { name: '5 bintang untuk Agent Satu' }));
        const comments = screen.getAllByLabelText(/Kesan & saran/);
        fireEvent.change(comments[0], { target: { value: '  Cepat dan ramah  ' } });
        expect(submit).toBeEnabled();
        fireEvent.click(submit);

        await waitFor(() =>
            expect(mockedApi.post).toHaveBeenCalledWith(
                '/tickets/t-3/agent-ratings',
                { ratings: [{ agentId: 'a-1', rating: 5, comment: 'Cepat dan ramah' }] },
                { skipToast: true },
            ),
        );
        await waitFor(() => expect(toast.success).toHaveBeenCalled());
    });

    it('renders nothing when there are no agents to rate', async () => {
        mockedApi.get.mockResolvedValue({ data: { canRate: true, ratingDeadline: null, agents: [] } });
        renderWithClient(<AgentRatingForm ticketId="t-4" />);
        await waitFor(() => expect(mockedApi.get).toHaveBeenCalled());
        expect(screen.queryByText('Beri Penilaian Layanan')).not.toBeInTheDocument();
    });

    it('hides the form after "Lewati"', async () => {
        mockedApi.get.mockResolvedValue({
            data: {
                canRate: true,
                ratingDeadline: null,
                agents: [{ agentId: 'a-1', fullName: 'Agent Satu', rating: null, comment: null }],
            },
        });
        renderWithClient(<AgentRatingForm ticketId="t-5" />);
        fireEvent.click(await screen.findByRole('button', { name: 'Lewati' }));
        expect(screen.queryByText('Beri Penilaian Layanan')).not.toBeInTheDocument();
    });
});
