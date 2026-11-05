import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CancelReasonNote, CancelTicketDialog, formatCancelReason } from '../CancelTicketDialog';

const ticket = { id: 't-1', ticketNumber: 'T-1', title: 'Printer rusak' };

function renderDialog(onConfirm = vi.fn()) {
    render(<CancelTicketDialog isOpen onClose={vi.fn()} ticket={ticket} onConfirm={onConfirm} />);
    return onConfirm;
}

describe('CancelTicketDialog', () => {
    it('needs a reason before it can be confirmed', () => {
        renderDialog();
        expect(screen.getByRole('button', { name: 'Batalkan tiket' })).toBeDisabled();
    });

    it('sends a fixed reason without a note', async () => {
        const user = userEvent.setup();
        const onConfirm = renderDialog();

        await user.click(screen.getByRole('button', { name: 'Duplikat tiket lain' }));
        await user.click(screen.getByRole('button', { name: 'Batalkan tiket' }));

        expect(onConfirm).toHaveBeenCalledWith({ reasonCode: 'DUPLICATE' });
    });

    it('requires a note of at least 5 characters for "Lainnya" and sends it trimmed', async () => {
        const user = userEvent.setup();
        const onConfirm = renderDialog();

        await user.click(screen.getByRole('button', { name: 'Lainnya' }));
        const note = screen.getByRole('textbox', { name: /Catatan/ });
        expect(note).toHaveFocus();
        await user.type(note, 'abc');
        expect(screen.getByRole('button', { name: 'Batalkan tiket' })).toBeDisabled();

        await user.type(note, 'de  ');
        await user.click(screen.getByRole('button', { name: 'Batalkan tiket' }));
        expect(onConfirm).toHaveBeenCalledWith({ reasonCode: 'OTHER', reason: 'abcde' });
    });

    it('shows the server error and stays open when cancelling fails', async () => {
        const user = userEvent.setup();
        renderDialog(vi.fn().mockRejectedValue({ response: { data: { message: 'Tiket sudah ditutup' } } }));

        await user.click(screen.getByRole('button', { name: 'Tidak lagi dibutuhkan' }));
        await user.click(screen.getByRole('button', { name: 'Batalkan tiket' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Tiket sudah ditutup');
    });
});

describe('cancel reason display', () => {
    it('formats label and note, falling back to the note alone', () => {
        expect(formatCancelReason({ cancelReasonCode: 'SELF_RESOLVED', cancelReason: null })).toBe('Masalah sudah teratasi sendiri');
        expect(formatCancelReason({ cancelReasonCode: 'OTHER', cancelReason: 'Pindah divisi' })).toBe('Lainnya: Pindah divisi');
        expect(formatCancelReason({ cancelReasonCode: null, cancelReason: null })).toBeNull();
    });

    it('shows the reason only on cancelled tickets', () => {
        const { rerender } = render(<CancelReasonNote ticket={{ status: 'CANCELLED', cancelReasonCode: 'DUPLICATE' }} />);
        expect(screen.getByText('Duplikat tiket lain')).toBeInTheDocument();

        rerender(<CancelReasonNote ticket={{ status: 'TODO', cancelReasonCode: 'DUPLICATE' }} />);
        expect(screen.queryByText('Duplikat tiket lain')).not.toBeInTheDocument();
    });
});
