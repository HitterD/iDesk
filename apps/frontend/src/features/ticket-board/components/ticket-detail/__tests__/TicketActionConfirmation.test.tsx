import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';

describe('Ticket action confirmations', () => {
    it('keeps destruction explicit and does not execute on cancellation', () => {
        const onConfirm = vi.fn();
        const onCancel = vi.fn();
        render(<ConfirmationDialog appearance="ticket" isOpen title="Keluarkan anggota?" description="Anggota akan dikeluarkan."
            variant="destructive" confirmText="Keluarkan anggota" cancelText="Kembali" onConfirm={onConfirm} onCancel={onCancel} />);
        expect(screen.getByRole('alertdialog', { name: 'Keluarkan anggota?' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Kembali' }));
        expect(onCancel).toHaveBeenCalledOnce();
        expect(onConfirm).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Keluarkan anggota' }));
        expect(onConfirm).toHaveBeenCalledOnce();
    });
    it('keeps optional explanation fields and locks both actions while saving', () => {
        const onConfirm = vi.fn();
        render(<ConfirmationDialog appearance="ticket" isOpen isLoading title="Batalkan tiket?" description="Tiket akan dibatalkan."
            confirmText="Batalkan tiket" cancelText="Kembali" onConfirm={onConfirm} onCancel={vi.fn()}>
            <label htmlFor="reason">Alasan pembatalan</label><textarea id="reason" defaultValue="Duplikat" />
        </ConfirmationDialog>);
        expect(screen.getByRole('textbox', { name: 'Alasan pembatalan' })).toHaveValue('Duplikat');
        expect(screen.getByRole('button', { name: 'Kembali' })).toBeDisabled();
        const save = screen.getByRole('button', { name: 'Menyimpan…' });
        expect(save).toBeDisabled();
        expect(save).toHaveAttribute('aria-busy', 'true');
        fireEvent.click(save);
        expect(onConfirm).not.toHaveBeenCalled();
    });
});
