import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
        expect(screen.getByText('Sisa sebelumnya: 2j 0m (dijeda)')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Tambahan menit'), { target: { value: '60' } });
        expect(screen.getByText('Sisa baru: 3j 0m (dijeda)')).toBeInTheDocument();
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
});
