import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ClientZoomBookingPage } from '../ClientZoomBookingPage';

vi.mock('../../components', () => ({
    SimpleBookingForm: () => <div data-testid="simple-booking-form" />,
    ZoomMyBookingsView: () => <div data-testid="my-bookings-view" />,
}));

describe('ClientZoomBookingPage', () => {
    it('renders quiet booking header, form, and existing booking list', () => {
        render(<ClientZoomBookingPage />);

        expect(screen.getByRole('heading', { name: 'Booking Zoom' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Buat meeting' })).toBeInTheDocument();
        expect(screen.getByTestId('simple-booking-form')).toBeInTheDocument();
        expect(screen.getByTestId('my-bookings-view')).toBeInTheDocument();
    });
});
