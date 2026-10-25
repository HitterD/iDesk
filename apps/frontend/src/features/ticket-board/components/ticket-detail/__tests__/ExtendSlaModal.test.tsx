import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ExtendSlaModal } from '../ExtendSlaModal';

vi.mock('@/components/ui/ModernDateTimePicker', () => ({ ModernDateTimePicker: () => <div>Date picker</div> }));

const ticket = { id: 'vendor-ticket', title: 'Vendor', status: 'WAITING_VENDOR', slaRemainingMinutes: 120, slaTarget: '2026-10-20T05:00:00Z' };

describe('ExtendSlaModal paused', () => {
    it('shows remaining time only and submits minutes instead of a date', async () => {
        const onConfirm = vi.fn().mockResolvedValue(undefined);
        render(<ExtendSlaModal isOpen onClose={vi.fn()} ticket={ticket} onConfirm={onConfirm} />);
        expect(screen.queryByText('Date picker')).not.toBeInTheDocument();
        expect(screen.queryByText('Sebelumnya:')).not.toBeInTheDocument();
        expect(screen.getByText('Sisa sebelumnya: 2 jam (dijeda)')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Tambahan menit'), { target: { value: '60' } });
        expect(screen.getByText('Sisa baru: 3 jam (dijeda)')).toBeInTheDocument();
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Menunggu sparepart vendor' } });
        fireEvent.click(screen.getByRole('button', { name: 'Perpanjang SLA' }));
        await waitFor(() => expect(onConfirm).toHaveBeenCalledWith({ reasonCategory: 'WAITING_USER', reasonText: 'Menunggu sparepart vendor', minutes: 60 }));
    });

    it.each(['0', '-1', '1.5', '10081', ''])('rejects invalid added minutes: %s', (value) => {
        render(<ExtendSlaModal isOpen onClose={vi.fn()} ticket={ticket} onConfirm={vi.fn()} />);
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Menunggu vendor' } });
        fireEvent.change(screen.getByLabelText('Tambahan menit'), { target: { value } });
        expect(screen.getByRole('button', { name: 'Perpanjang SLA' })).toBeDisabled();
    });

    it('keeps date mode for active tickets', () => {
        render(<ExtendSlaModal isOpen onClose={vi.fn()} ticket={{ ...ticket, status: 'IN_PROGRESS' }} onConfirm={vi.fn()} />);
        expect(screen.getByText('Date picker')).toBeInTheDocument();
    });

    it('applies a quick-pick capsule and the chosen reason category in date mode', async () => {
        const DAY_MS = 24 * 60 * 60 * 1000;
        const onConfirm = vi.fn().mockResolvedValue(undefined);
        render(<ExtendSlaModal isOpen onClose={vi.fn()} ticket={{ ...ticket, status: 'IN_PROGRESS' }} onConfirm={onConfirm} />);
        const presets = screen.getByRole('group', { name: 'Pilihan cepat' });
        expect(screen.getByRole('button', { name: '1 Minggu' })).toHaveAttribute('aria-pressed', 'true');
        fireEvent.click(screen.getByRole('button', { name: '2 Minggu' }));
        expect(presets.querySelector('[aria-pressed="true"]')).toHaveTextContent('2 Minggu');
        await userEvent.click(screen.getByRole('combobox', { name: 'Kategori alasan' }));
        await userEvent.click(screen.getByRole('option', { name: 'Menunggu Vendor' }));
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Menunggu unit pengganti' } });
        fireEvent.click(screen.getByRole('button', { name: 'Perpanjang SLA' }));
        await waitFor(() => expect(onConfirm).toHaveBeenCalledOnce());
        const sent = onConfirm.mock.calls[0][0];
        expect(sent.reasonCategory).toBe('WAITING_VENDOR');
        expect(Math.abs(new Date(sent.newTargetDate).getTime() - (Date.now() + 14 * DAY_MS))).toBeLessThan(60_000);
    });
});
