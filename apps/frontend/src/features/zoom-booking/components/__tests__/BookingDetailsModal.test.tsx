import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ZoomBooking } from '../../types';
import { BookingDetailsModal } from '../BookingDetailsModal';
import { isMeetingOver } from '../MeetingDetailContent';
import * as hooks from '../../hooks';

const FUTURE_DATE = '2099-07-23';
const PAST_DATE = '2020-07-01';

const booking = {
    id: 'booking-1',
    title: 'Weekly Operations Sync',
    description: 'Review pekerjaan minggu ini.',
    bookingDate: FUTURE_DATE,
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

vi.mock('../SendReminderModal', () => ({
    SendReminderModal: () => null,
}));

vi.mock('../../utils', () => ({
    copyToClipboard: vi.fn(),
    formatZoomAccountName: (name: string) => name,
    generateInvitationText: vi.fn(),
    extractMeetingId: () => '812 3456 789',
}));

function mockBooking(data: ZoomBooking) {
    vi.mocked(hooks.useBookingDetails).mockReturnValue({
        data,
        isLoading: false,
    } as ReturnType<typeof hooks.useBookingDetails>);
}

describe('BookingDetailsModal', () => {
    beforeEach(() => {
        mockBooking(booking);
    });

    it('renders grouped metadata with one primary action and a compact footer', async () => {
        render(<BookingDetailsModal isOpen onClose={vi.fn()} bookingId="booking-1" />);

        expect(await screen.findByRole('heading', { name: booking.title })).toBeInTheDocument();
        expect(screen.getByText('Terkonfirmasi')).toBeInTheDocument();
        expect(screen.getByText('Tanggal')).toBeInTheDocument();
        expect(screen.getByText('Durasi')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /join meeting/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /salin undangan/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^pengingat$/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /aksi lainnya/i })).toBeInTheDocument();

        // Removed clutter
        expect(screen.queryByRole('button', { name: /outlook/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /^reschedule$/i })).not.toBeInTheDocument();
        // Future meeting: recording row stays hidden
        expect(screen.queryByText('Rekaman')).not.toBeInTheDocument();
    });

    it('opens reschedule and cancel from the overflow menu', async () => {
        const user = userEvent.setup();
        render(<BookingDetailsModal isOpen onClose={vi.fn()} bookingId="booking-1" />);

        await user.click(await screen.findByRole('button', { name: /aksi lainnya/i }));

        expect(await screen.findByRole('menuitem', { name: /reschedule/i })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: /batalkan meeting/i })).toBeInTheDocument();
    });

    it('renders recording rows when the meeting is over and recording is available', async () => {
        mockBooking({
            ...booking,
            bookingDate: PAST_DATE,
            meeting: {
                ...booking.meeting,
                recordingUrl: 'https://zoom.us/rec/play/sample-recording',
                recordingPasscode: 'recpass123',
                recordingDuration: 45,
            },
        } as unknown as ZoomBooking);

        render(<BookingDetailsModal isOpen onClose={vi.fn()} bookingId="booking-1" />);

        expect(await screen.findByText('Rekaman')).toBeInTheDocument();
        expect(screen.getByText('45 menit')).toBeInTheDocument();
        expect(screen.getByText('https://zoom.us/rec/play/sample-recording')).toBeInTheDocument();
        expect(screen.getByText('recpass123')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^tonton$/i })).toBeInTheDocument();
    });

    it('renders sync recording button when meeting is finished but recording not yet arrived', async () => {
        mockBooking({
            ...booking,
            bookingDate: PAST_DATE,
            status: 'COMPLETED',
            meeting: {
                id: '12345678901',
                joinUrl: 'https://zoom.us/j/12345678901',
                recordingUrl: null,
            },
        } as unknown as ZoomBooking);

        render(<BookingDetailsModal isOpen onClose={vi.fn()} bookingId="booking-1" />);

        expect(await screen.findByRole('button', { name: /cek rekaman/i })).toBeInTheDocument();
    });
});

describe('isMeetingOver', () => {
    const now = new Date('2026-07-23T10:30:00');

    it('is true after the scheduled end time', () => {
        expect(isMeetingOver({ bookingDate: '2026-07-23', endTime: '10:00' }, now)).toBe(true);
    });

    it('is false before the scheduled end time', () => {
        expect(isMeetingOver({ bookingDate: '2026-07-23', endTime: '11:00' }, now)).toBe(false);
    });
});
