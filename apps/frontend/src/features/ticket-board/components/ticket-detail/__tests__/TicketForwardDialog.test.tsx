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

    it('lets OPS_SUPPORT forward to another active self-handled site and excludes current and delegated sites', async () => {
        const confirm = vi.fn().mockResolvedValue(undefined);
        const sites = [
            { id: 'spj', code: 'SPJ', name: 'Head Office SPJ', isActive: true, handledBySiteId: null },
            { id: 'krw', code: 'KRW', name: 'Karawang', isActive: true, handledBySiteId: null },
            { id: 'jtb', code: 'JTB', name: 'Jatibarang', isActive: true, handledBySiteId: null },
            { id: 'smg', code: 'SMG', name: 'Semarang', isActive: true, handledBySiteId: null },
            { id: 'skd', code: 'SKD', name: 'Sukadana', isActive: true, handledBySiteId: 'spj' },
        ];
        render(
            <TicketForwardDialog
                isOpen
                ticket={{ ...ticket, siteId: 'spj', site: { id: 'spj', code: 'SPJ', name: 'Head Office SPJ' } }}
                sites={sites}
                onClose={vi.fn()}
                onConfirm={confirm}
            />
        );

        const opsRadio = screen.getByRole('radio', { name: /IT Support/ });
        expect(opsRadio).not.toBeDisabled();
        fireEvent.click(opsRadio);

        const siteCombo = screen.getByRole('combobox', { name: /Site tujuan/ });
        await userEvent.click(siteCombo);
        expect(screen.getByRole('option', { name: /KRW/ })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: /JTB/ })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: /SMG/ })).toBeInTheDocument();
        expect(screen.queryByRole('option', { name: /SKD/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('option', { name: /SPJ/ })).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('option', { name: /KRW/ }));

        fireEvent.click(screen.getByRole('button', { name: 'Teruskan tiket' }));
        await waitFor(() => expect(confirm).toHaveBeenCalledWith(
            'OPS_SUPPORT',
            'Salah routing awal',
            'krw',
        ));
    });

    it('defaults Site tujuan to current ticket site when Dev team forwards back to IT Support and allows picking another site', async () => {
        const confirm = vi.fn().mockResolvedValue(undefined);
        const sites = [
            { id: 'spj', code: 'SPJ', name: 'Head Office SPJ', isActive: true, handledBySiteId: null },
            { id: 'smg', code: 'SMG', name: 'Semarang', isActive: true, handledBySiteId: null },
            { id: 'skd', code: 'SKD', name: 'Sukadana', isActive: true, handledBySiteId: 'spj' },
        ];
        render(
            <TicketForwardDialog
                isOpen
                ticket={{ ...ticket, handlingTeam: 'ORACLE_DEV', siteId: 'spj', site: { id: 'spj', code: 'SPJ', name: 'Head Office SPJ' } }}
                sites={sites}
                onClose={vi.fn()}
                onConfirm={confirm}
            />
        );

        fireEvent.click(screen.getByRole('radio', { name: /IT Support/ }));
        const siteCombo = screen.getByRole('combobox', { name: /Site tujuan/ });
        expect(siteCombo).toHaveTextContent('SPJ — Head Office SPJ (Site saat ini)');

        await userEvent.click(siteCombo);
        expect(screen.queryByRole('option', { name: /SKD/ })).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('option', { name: /SMG/ }));

        fireEvent.click(screen.getByRole('button', { name: 'Teruskan tiket' }));
        await waitFor(() => expect(confirm).toHaveBeenCalledWith(
            'OPS_SUPPORT',
            'Masalah infrastruktur / perangkat / IT Support',
            'smg',
        ));
    });
});
