import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ZoomBooking } from '../../types';
import { ZoomBookingDetailView } from '../ZoomBookingDetailView';
import * as hooks from '../../hooks';

const booking = {
    id: 'booking-1',
    title: 'Weekly Operations Sync',
    description: 'Review pekerjaan minggu ini.',
    bookingDate: '2099-07-23',
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
    useSyncRecording: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/stores/useAuth', () => ({
    useAuth: () => ({ user: { id: 'user-1', role: 'USER' } }),
}));

vi.mock('../SendReminderModal', () => ({
    SendReminderModal: () => null,
}));

vi.mock('../CancelBookingModal', () => ({
    CancelBookingModal: () => null,
}));

vi.mock('../../utils', () => ({
    copyToClipboard: vi.fn(),
    formatZoomAccountName: (name: string) => name,
    generateInvitationText: vi.fn(),
    extractMeetingId: () => '812 3456 789',
}));

describe('ZoomBookingDetailView', () => {
    beforeEach(() => {
        vi.mocked(hooks.useBookingDetails).mockReturnValue({
            data: booking,
            isLoading: false,
        } as ReturnType<typeof hooks.useBookingDetails>);
    });

    it('renders quiet record metadata and keeps actions for booking owner', async () => {
        render(<ZoomBookingDetailView bookingId="booking-1" onClose={vi.fn()} onReschedule={vi.fn()} />);

        expect(await screen.findByRole('heading', { name: booking.title })).toBeInTheDocument();
        expect(screen.getByText('Meeting ID')).toBeInTheDocument();
        expect(screen.getByText('Passcode')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /join meeting/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^pengingat$/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /aksi lainnya/i })).toBeInTheDocument();
    });
});
