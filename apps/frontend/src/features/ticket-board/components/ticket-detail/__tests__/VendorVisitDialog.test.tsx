import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { VendorVisitDialog } from '../VendorVisitDialog';

const ticket = { id: 't-1', ticketNumber: 'T-1', title: 'Printer rusak' };

function renderDialog(onConfirm = vi.fn(), extra: Partial<React.ComponentProps<typeof VendorVisitDialog>> = {}) {
    render(<VendorVisitDialog isOpen onClose={vi.fn()} ticket={ticket} mode="start" onConfirm={onConfirm} {...extra} />);
    return onConfirm;
}

describe('VendorVisitDialog note', () => {
    it('needs a note before it can be confirmed', async () => {
        renderDialog();
        expect(screen.getByRole('button', { name: 'Tunggu vendor' })).toBeDisabled();
    });

    it('fills the note from a template and sends it with the appointment', async () => {
        const user = userEvent.setup();
        const onConfirm = renderDialog();

        await user.click(screen.getByRole('button', { name: 'Menunggu spare part' }));
        expect(screen.getByRole('textbox', { name: /Keterangan/ })).toHaveValue('Menunggu spare part');
        await user.click(screen.getByRole('button', { name: 'Tunggu vendor' }));

        expect(onConfirm).toHaveBeenCalledWith(expect.any(String), 'Menunggu spare part');
    });

    it('lets the PIC type a note of their own after "Lainnya"', async () => {
        const user = userEvent.setup();
        const onConfirm = renderDialog();

        await user.click(screen.getByRole('button', { name: 'Lainnya' }));
        const field = screen.getByRole('textbox', { name: /Keterangan/ });
        expect(field).toHaveFocus();
        await user.type(field, '  Menunggu PO dari procurement ');
        expect(screen.getByRole('button', { name: 'Lainnya' })).toHaveAttribute('aria-pressed', 'true');
        await user.click(screen.getByRole('button', { name: 'Tunggu vendor' }));

        expect(onConfirm).toHaveBeenCalledWith(expect.any(String), 'Menunggu PO dari procurement');
    });

    it('starts a reschedule from the saved note', () => {
        renderDialog(vi.fn(), { mode: 'reschedule', ticket: { ...ticket, vendorNote: 'Menunggu lisensi / aktivasi dari vendor' } });
        expect(screen.getByRole('textbox', { name: /Keterangan/ })).toHaveValue('Menunggu lisensi / aktivasi dari vendor');
        expect(screen.getByRole('button', { name: 'Menunggu lisensi / aktivasi dari vendor' })).toHaveAttribute('aria-pressed', 'true');
    });
});
