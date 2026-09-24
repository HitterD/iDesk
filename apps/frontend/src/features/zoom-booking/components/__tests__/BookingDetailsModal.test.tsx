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
    useSyncRecording: vi.fn(() => ({
        mutate: vi.fn(),
        isPending: false,
    })),
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

    it('renders cloud recording card when recording is available', async () => {
        const bookingWithRecording = {
            ...booking,
            meeting: {
                ...booking.meeting,
                recordingUrl: 'https://zoom.us/rec/play/sample-recording',
                recordingPasscode: 'recpass123',
                recordingDuration: 45,
            },
        } as unknown as ZoomBooking;

        vi.mocked(hooks.useBookingDetails).mockReturnValue({
            data: bookingWithRecording,
            isLoading: false,
        } as ReturnType<typeof hooks.useBookingDetails>);

        render(<BookingDetailsModal isOpen onClose={vi.fn()} bookingId="booking-1" />);

        expect(await screen.findByText('Rekaman Cloud Zoom')).toBeInTheDocument();
        expect(screen.getByText(/Tersedia/i)).toBeInTheDocument();
        expect(screen.getByText(/45 menit/i)).toBeInTheDocument();
        expect(screen.getByDisplayValue('https://zoom.us/rec/play/sample-recording')).toBeInTheDocument();
        expect(screen.getByText('recpass123')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /tonton rekaman/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /buka rekaman/i })).toBeInTheDocument();
    });

    it('renders sync recording button when meeting is finished but recording not yet arrived', async () => {
        const pastBooking = {
            ...booking,
            status: 'COMPLETED',
            meeting: {
                id: '12345678901',
                joinUrl: 'https://zoom.us/j/12345678901',
                recordingUrl: null,
            },
        } as unknown as ZoomBooking;

        vi.mocked(hooks.useBookingDetails).mockReturnValue({
            data: pastBooking,
            isLoading: false,
        } as ReturnType<typeof hooks.useBookingDetails>);

        render(<BookingDetailsModal isOpen onClose={vi.fn()} bookingId="booking-1" />);

        expect(await screen.findByText(/cek rekaman di zoom/i)).toBeInTheDocument();
    });
});
