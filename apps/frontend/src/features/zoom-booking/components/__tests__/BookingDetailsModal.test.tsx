import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ZoomBooking } from '../../types';
import { BookingDetailsModal } from '../BookingDetailsModal';
import * as hooks from '../../hooks';

const booking = {
    id: 'booking-1',
    title: 'Weekly Operations Sync',
    description: 'Review pekerjaan minggu ini.',
    bookingDate: '2026-07-23',
    startTime: '09:00',
    endTime: '10:00',
    durationMinutes: 60,
    status: 'CONFIRMED',
    bookedByUserId: 'user-1',
    bookedByUser: { id: 'user-1', fullName: 'Bagas Pratama', email: 'bagas@example.com' },
    isExternal: false,
    zoomAccount: { id: 'account-1', name: 'Marketing', colorHex: '#2563eb' },
    meeting: { joinUrl: 'https://zoom.us/j/8123456789', password: '123456' },
} as unknown as ZoomBooking;

vi.mock('../../hooks', () => ({
    useBookingDetails: vi.fn(),
}));

vi.mock('@/stores/useAuth', () => ({
    useAuth: () => ({ user: { id: 'user-1', role: 'USER' } }),
}));

vi.mock('../CancelBookingModal', () => ({
    CancelBookingModal: () => null,
}));

vi.mock('../RescheduleModal', () => ({
    RescheduleModal: () => null,
}));

vi.mock('../../utils', () => ({
    copyToClipboard: vi.fn(),
    formatZoomAccountName: (name: string) => name,
    generateInvitationText: vi.fn(),
}));

describe('BookingDetailsModal', () => {
    beforeEach(() => {
        vi.mocked(hooks.useBookingDetails).mockReturnValue({
            data: booking,
            isLoading: false,
        } as ReturnType<typeof hooks.useBookingDetails>);
    });

    it('renders quiet record metadata and owner actions', async () => {
        render(<BookingDetailsModal isOpen onClose={vi.fn()} bookingId="booking-1" />);

        expect(await screen.findByText('Detail meeting')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: booking.title })).toBeInTheDocument();
        expect(screen.getByText('Tanggal')).toBeInTheDocument();
        expect(screen.getByText('Durasi')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /reschedule/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /batalkan/i })).toBeInTheDocument();
    });
});
