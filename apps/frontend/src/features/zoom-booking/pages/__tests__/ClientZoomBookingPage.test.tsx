import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClientZoomBookingPage } from '../ClientZoomBookingPage';

vi.mock('../../components', () => ({
    SimpleBookingForm: ({ onSuccessViewBookings }: { onSuccessViewBookings?: () => void }) => (
        <div data-testid="simple-booking-form">
            <button data-testid="mock-success-btn" onClick={onSuccessViewBookings}>
                Trigger Success
            </button>
        </div>
    ),
    ZoomMyBookingsView: () => <div data-testid="my-bookings-view" />,
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

    it('switches to Meeting Saya tab when onSuccessViewBookings is called', async () => {
        const user = userEvent.setup();
        render(<ClientZoomBookingPage />);

        const triggerBtn = screen.getByTestId('mock-success-btn');
        await user.click(triggerBtn);

        const myBookingsTab = screen.getByRole('button', { name: /Kalender & Meeting|Meeting Saya/i });
        expect(myBookingsTab).toHaveClass('font-bold');
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

