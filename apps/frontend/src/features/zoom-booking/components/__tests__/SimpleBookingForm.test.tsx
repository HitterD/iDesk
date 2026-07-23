import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { SimpleBookingForm, buildRecurrencePattern } from '../SimpleBookingForm';
import * as hooks from '../../hooks';

vi.mock('sonner', () => ({
    toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('@/components/ui/ModernDatePicker', () => ({
    ModernDatePicker: ({ onChange }: { onChange?: (date: Date) => void }) => (
        <button type="button" aria-label="Tanggal" onClick={() => onChange?.(new Date(Date.now() + 86_400_000))}>
            Pilih tanggal
        </button>
    ),
}));

vi.mock('../../hooks', () => ({
    useCheckAvailability: vi.fn(),
    useCreateBooking: vi.fn(),
    useDurationOptions: vi.fn(),
    usePublicZoomSettings: vi.fn(),
}));

vi.mock('../SimpleRecurringField', () => ({
    SimpleRecurringField: () => <div data-testid="recurring-field" />,
}));

describe('SimpleBookingForm', () => {
    const mutateAsync = vi.fn();

    beforeEach(() => {
        mutateAsync.mockReset();
        vi.mocked(toast.error).mockReset();
        vi.mocked(toast.success).mockReset();
        vi.mocked(hooks.usePublicZoomSettings).mockReturnValue({
            data: { advanceBookingDays: 30 },
        } as ReturnType<typeof hooks.usePublicZoomSettings>);
        vi.mocked(hooks.useDurationOptions).mockReturnValue({
            data: [30, 60, 90, 120],
        } as ReturnType<typeof hooks.useDurationOptions>);
        vi.mocked(hooks.useCheckAvailability).mockReturnValue({
            data: { available: true },
            isLoading: false,
        } as ReturnType<typeof hooks.useCheckAvailability>);
        vi.mocked(hooks.useCreateBooking).mockReturnValue({
            mutateAsync,
            isPending: false,
        } as ReturnType<typeof hooks.useCreateBooking>);
    });

    it('renders without a Zoom account picker', () => {
        render(<SimpleBookingForm />);

        expect(screen.queryByText(/pilih akun/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/zoom account/i)).not.toBeInTheDocument();
    });

    it('shows available state after date and start time are selected', () => {
        render(<SimpleBookingForm />);
        fireEvent.click(screen.getByRole('button', { name: 'Tanggal' }));
        fireEvent.click(screen.getByTestId('zoom-time-select'));
        fireEvent.click(screen.getByTestId('zoom-time-select-option-10:00'));

        expect(screen.getByText('Jam ini tersedia')).toBeInTheDocument();
    });

    it('submits without zoomAccountId', async () => {
        mutateAsync.mockResolvedValue({ meeting: { joinUrl: 'https://zoom.us/j/123' } });
        render(<SimpleBookingForm />);
        fireEvent.change(screen.getByLabelText(/judul/i), { target: { value: 'Rapat mingguan tim' } });
        fireEvent.click(screen.getByRole('button', { name: 'Tanggal' }));
        fireEvent.click(screen.getByTestId('zoom-time-select'));
        fireEvent.click(screen.getByTestId('zoom-time-select-option-10:00'));
        fireEvent.click(screen.getByRole('button', { name: /buat meeting/i }));

        await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
        const dto = mutateAsync.mock.calls[0][0];
        expect(dto.title).toBe('Rapat mingguan tim');
        expect(dto).not.toHaveProperty('zoomAccountId');
        expect(screen.getByText('Booking Berhasil!')).toBeInTheDocument();
    });

    it('keeps form values and shows backend race error when submit conflicts', async () => {
        mutateAsync.mockRejectedValueOnce({
            response: { data: { message: 'Gagal membuat jadwal: Semua akun penuh' } },
        });
        render(<SimpleBookingForm />);
        fireEvent.change(screen.getByLabelText(/judul/i), { target: { value: 'Rapat mingguan tim' } });
        fireEvent.click(screen.getByRole('button', { name: 'Tanggal' }));
        fireEvent.click(screen.getByTestId('zoom-time-select'));
        fireEvent.click(screen.getByTestId('zoom-time-select-option-10:00'));
        fireEvent.click(screen.getByRole('button', { name: /buat meeting/i }));

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Gagal membuat jadwal: Semua akun penuh'));
        expect(screen.getByLabelText(/judul/i)).toHaveValue('Rapat mingguan tim');
    });

    it('builds recurring RRule values compatible with existing booking flow', () => {
        expect(buildRecurrencePattern('WEEKLY', 2, '2026-08-31'))
            .toBe('FREQ=WEEKLY;INTERVAL=2;UNTIL=20260831T235959Z');
        expect(buildRecurrencePattern('DAILY', 1, '')).toBe('FREQ=DAILY;INTERVAL=1');
    });
});
