import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClientZoomBookingPage } from '../ClientZoomBookingPage';

vi.mock('../../components', () => ({
    SimpleBookingForm: ({ onBookingCreated }: { onBookingCreated?: (id: string) => void }) => (
        <div data-testid="simple-booking-form">
            <button data-testid="mock-success-btn" onClick={() => onBookingCreated?.('booking-new')}>
                Trigger Success
            </button>
        </div>
    ),
    ZoomMyBookingsView: () => <div data-testid="my-bookings-view" />,
    BookingDetailsModal: ({ bookingId }: { bookingId: string }) => (
        <div data-testid="booking-details-modal">{bookingId}</div>
    ),
}));

const mockBookings: any[] = [];
vi.mock('../../hooks', () => ({
    useMyBookings: () => ({
        data: mockBookings,
        isLoading: false,
    }),
}));

describe('ClientZoomBookingPage', () => {
    it('renders quiet booking header, form, and mobile tab controls', () => {
        render(<ClientZoomBookingPage />);

        expect(screen.getByRole('heading', { name: 'Booking Zoom' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Buat meeting' })).toBeInTheDocument();
        expect(screen.getByTestId('simple-booking-form')).toBeInTheDocument();
        expect(screen.getByTestId('my-bookings-view')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Buat Meeting/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Kalender & Meeting|Meeting Saya/i })).toBeInTheDocument();
    });

    it('handles mobile tab switcher interactions', async () => {
        const user = userEvent.setup();
        render(<ClientZoomBookingPage />);

        const myBookingsTab = screen.getByRole('button', { name: /Kalender & Meeting|Meeting Saya/i });
        await user.click(myBookingsTab);

        expect(myBookingsTab).toHaveClass('font-bold');

        const buatMeetingTab = screen.getByRole('button', { name: /Buat Meeting/i });
        await user.click(buatMeetingTab);

        expect(buatMeetingTab).toHaveClass('font-bold');
    });

    it('opens the new meeting detail modal right after a booking is created', async () => {
        const user = userEvent.setup();
        render(<ClientZoomBookingPage />);

        expect(screen.queryByTestId('booking-details-modal')).not.toBeInTheDocument();
        await user.click(screen.getByTestId('mock-success-btn'));

        expect(screen.getByTestId('booking-details-modal')).toHaveTextContent('booking-new');
    });

    it('allows toggling form visibility on desktop', async () => {
        const user = userEvent.setup();
        render(<ClientZoomBookingPage />);

        const toggleBtn = screen.getByRole('button', { name: /Sembunyikan Form \(Mode Luas\)/i });
        expect(toggleBtn).toBeInTheDocument();

        await user.click(toggleBtn);
        expect(screen.getByRole('button', { name: /Buka Form Booking/i })).toBeInTheDocument();

        const openBtn = screen.getByRole('button', { name: /Buka Form Booking/i });
        await user.click(openBtn);
        expect(screen.getByRole('button', { name: /Sembunyikan Form \(Mode Luas\)/i })).toBeInTheDocument();
    });
});

