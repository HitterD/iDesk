import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TicketForwardDialog } from '../../TicketForwardDialog';

const ticket = { id: 'ticket-1', ticketNumber: 'T-01', title: 'Printer marketing', handlingTeam: 'OPS_SUPPORT' };
const renderDialog = (onConfirm = vi.fn()) => render(<TicketForwardDialog isOpen ticket={ticket} onClose={vi.fn()} onConfirm={onConfirm} />);

describe('approved forward form', () => {
    it('uses four radios, disables the current team and exposes reason as a select', () => {
        renderDialog();
        expect(screen.getAllByRole('radio')).toHaveLength(4);
        expect(screen.getByRole('radio', { name: /IT Support/ })).toBeDisabled();
        expect(screen.getByRole('radio', { name: /Oracle/ })).toBeChecked();
        expect(screen.getByRole('combobox', { name: /Alasan/ })).toHaveTextContent('Terkait aplikasi Oracle / K2');
        expect(screen.getByRole('button', { name: 'Teruskan tiket' })).toHaveClass('ticket-action-forward');
        expect(screen.queryByText('Riwayat penerusan')).not.toBeInTheDocument();
    });
    it('preserves real team, reason composition and the note limit', async () => {
        const confirm = vi.fn();
        renderDialog(confirm);
        fireEvent.click(screen.getByRole('radio', { name: /Web Developer/ }));
        expect(screen.getByRole('combobox')).toHaveTextContent('Terkait aplikasi Web / Portal / Frontend');
        const note = screen.getByRole('textbox', { name: /Catatan tambahan/ });
        expect(note).toHaveAttribute('maxlength', '500');
        fireEvent.change(note, { target: { value: '  Periksa portal  ' } });
        fireEvent.keyDown(note, { key: 'Enter', ctrlKey: true });
        await waitFor(() => expect(confirm).toHaveBeenCalledWith('WEB_DEV', 'Terkait aplikasi Web / Portal / Frontend: Periksa portal'));
    });
    it('requires a note for Lainnya and retains it on server failure', async () => {
        renderDialog(vi.fn().mockRejectedValue(new Error('Jaringan terputus')));
        await userEvent.click(screen.getByRole('combobox', { name: /Alasan/ }));
        await userEvent.click(screen.getByRole('option', { name: 'Lainnya' }));
        expect(screen.getByRole('button', { name: 'Teruskan tiket' })).toBeDisabled();
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Akses khusus' } });
        fireEvent.click(screen.getByRole('button', { name: 'Teruskan tiket' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Jaringan terputus');
        expect(screen.getByRole('textbox')).toHaveValue('Akses khusus');
    });
});
