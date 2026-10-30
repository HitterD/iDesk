import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { SimpleBookingForm, buildRecurrencePattern, calculateDuration, formatDurationLabel, computeEndTimeOptions } from '../SimpleBookingForm';
import * as hooks from '../../hooks';

vi.mock('sonner', () => ({
    toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

vi.mock('@/components/ui/ModernDatePicker', () => ({
    ModernDatePicker: ({ onChange }: { onChange?: (date: Date) => void }) => (
        <button type="button" aria-label="Tanggal" onClick={() => onChange?.(new Date('2026-09-04T00:00:00'))}>
            Pilih tanggal
        </button>
    ),
}));

vi.mock('../../hooks', () => ({
    useCheckAvailability: vi.fn(),
    useCreateBooking: vi.fn(),
    useDurationOptions: vi.fn(),
    usePublicZoomSettings: vi.fn(),
    useDaySlotsAvailability: vi.fn(),
    useActiveUsersForParticipants: vi.fn(),
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
        vi.mocked(toast.warning).mockReset();
        vi.mocked(hooks.usePublicZoomSettings).mockReturnValue({
            data: { advanceBookingDays: 30, slotStartTime: '08:00', slotEndTime: '18:00', slotIntervalMinutes: 30 },
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
        vi.mocked(hooks.useDaySlotsAvailability).mockReturnValue({
            data: {
                date: '2026-09-04',
                durationMinutes: 60,
                isWorkingDay: true,
                isBlocked: false,
                isPast: false,
                isFutureExceeded: false,
                totalAccounts: 10,
                availableSlotsCount: 16,
                totalSlotsCount: 20,
                isFullyBooked: false,
                slots: [
                    { time: '09:00', endTime: '10:00', available: true, availableAccountsCount: 5, totalAccountsCount: 10 },
                    { time: '10:00', endTime: '11:00', available: true, availableAccountsCount: 3, totalAccountsCount: 10 },
                    { time: '11:00', endTime: '12:00', available: false, availableAccountsCount: 0, totalAccountsCount: 10, reason: 'Semua akun penuh' },
                ],
            },
            isLoading: false,
        } as any);
        vi.mocked(hooks.useActiveUsersForParticipants).mockReturnValue({
            data: [
                { id: 'u1', fullName: 'Bagas Pratama', email: 'bagas@example.com', department: { id: 'd1', name: 'IT' } },
                { id: 'u2', fullName: 'Sarah Jenkins', email: 'sarah@example.com', department: { id: 'd2', name: 'Marketing' } },
            ],
            isLoading: false,
        } as any);
    });

    it('renders without a Zoom account picker', () => {
        render(<SimpleBookingForm />);

        expect(screen.queryByText(/pilih akun/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/zoom account/i)).not.toBeInTheDocument();
    });

    it('shows date availability summary badge when date is selected', () => {
        render(<SimpleBookingForm />);
        fireEvent.click(screen.getByRole('button', { name: 'Tanggal' }));

        expect(screen.getByTestId('date-availability-summary')).toHaveTextContent(/16 dari 20 slot waktu tersedia/i);
    });

    it('shows available state after date and start time are selected', () => {
        render(<SimpleBookingForm />);
        fireEvent.click(screen.getByRole('button', { name: 'Tanggal' }));
        fireEvent.click(screen.getByTestId('zoom-time-select'));
        fireEvent.click(screen.getByTestId('zoom-time-select-option-10:00'));

        expect(screen.getByText('Jam ini tersedia')).toBeInTheDocument();
    });

    it('shows error warning instead of falsely claiming unavailable when availability query fails', () => {
        vi.mocked(hooks.useCheckAvailability).mockReturnValue({
            data: undefined,
            isLoading: false,
            isError: true,
        } as any);

        render(<SimpleBookingForm />);
        fireEvent.click(screen.getByRole('button', { name: 'Tanggal' }));
        fireEvent.click(screen.getByTestId('zoom-time-select'));
        fireEvent.click(screen.getByTestId('zoom-time-select-option-10:00'));

        expect(screen.getByText('Gagal mengecek ketersediaan jam')).toBeInTheDocument();
        expect(screen.queryByText('Jam ini tidak tersedia')).not.toBeInTheDocument();
    });

    it('shows admin 1607 alert and allows emergency double booking when all 10 accounts are full', async () => {
        render(<SimpleBookingForm />);
        fireEvent.change(screen.getByLabelText(/judul/i), { target: { value: 'Rapat Koordinasi Darurat' } });
        fireEvent.click(screen.getByRole('button', { name: 'Tanggal' }));
        fireEvent.click(screen.getByTestId('zoom-time-select'));

        // 11:00 is full across all 10 accounts (available: false)
        const unavailableOption = screen.getByTestId('zoom-time-select-option-11:00');
        fireEvent.click(unavailableOption);

        // Expect Admin 1607 banner and emergency double booking card
        expect(screen.getByTestId('admin-1607-alert')).toBeInTheDocument();
        expect(screen.getByText(/mohon menghubungi admin di 1607/i)).toBeInTheDocument();
        expect(screen.getByTestId('emergency-double-booking-card')).toBeInTheDocument();

        // Submit button is disabled before checking the box
        const submitBtn = screen.getByRole('button', { name: /buat meeting/i });
        expect(submitBtn).toBeDisabled();

        // Check the emergency double booking box
        const checkbox = screen.getByTestId('allow-double-booking-checkbox');
        fireEvent.click(checkbox);
        expect(checkbox).toBeChecked();

        // Submit button becomes enabled with double booking text
        expect(submitBtn).not.toBeDisabled();
        expect(screen.getByRole('button', { name: /buat meeting \(mode dobel booking\)/i })).toBeInTheDocument();

        // Submit form
        mutateAsync.mockResolvedValueOnce({
            id: 'booking-double',
            meeting: { joinUrl: 'https://zoom.us/j/double-123' },
            isDoubleBooking: true,
        });
        fireEvent.click(submitBtn);

        await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
        const dto = mutateAsync.mock.calls[0][0];
        expect(dto.allowDoubleBooking).toBe(true);
        expect(screen.queryByText('Booking Berhasil!')).not.toBeInTheDocument();
    });

    it('submits without zoomAccountId and hands the new booking id to the parent', async () => {
        mutateAsync.mockResolvedValue({ id: 'booking-new', meeting: { joinUrl: 'https://zoom.us/j/123' } });
        const onBookingCreated = vi.fn();
        render(<SimpleBookingForm onBookingCreated={onBookingCreated} />);
        fireEvent.change(screen.getByLabelText(/judul/i), { target: { value: 'Rapat mingguan tim' } });
        fireEvent.click(screen.getByRole('button', { name: 'Tanggal' }));
        fireEvent.click(screen.getByTestId('zoom-time-select'));
        fireEvent.click(screen.getByTestId('zoom-time-select-option-10:00'));
        fireEvent.click(screen.getByRole('button', { name: /buat meeting/i }));

        await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
        const dto = mutateAsync.mock.calls[0][0];
        expect(dto.title).toBe('Rapat mingguan tim');
        expect(dto).not.toHaveProperty('zoomAccountId');
        await waitFor(() => expect(onBookingCreated).toHaveBeenCalledWith('booking-new'));
        // No intermediate success screen: form resets and is ready for the next booking
        expect(screen.queryByText('Booking Berhasil!')).not.toBeInTheDocument();
        expect(screen.getByLabelText(/judul/i)).toHaveValue('');
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

    it('calculates duration correctly and formats duration label', () => {
        expect(calculateDuration('08:00', '09:00')).toBe(60);
        expect(calculateDuration('08:00', '09:30')).toBe(90);
        expect(calculateDuration('08:00', '10:00')).toBe(120);

        expect(formatDurationLabel(30)).toBe('30 menit');
        expect(formatDurationLabel(60)).toBe('1 jam');
        expect(formatDurationLabel(90)).toBe('1 jam 30 mnt');
        expect(formatDurationLabel(120)).toBe('2 jam');
    });

    it('renders Jam Selesai select and displays calculated duration in preview card', () => {
        render(<SimpleBookingForm />);
        fireEvent.click(screen.getByRole('button', { name: 'Tanggal' }));
        fireEvent.click(screen.getByTestId('zoom-time-select'));
        fireEvent.click(screen.getByTestId('zoom-time-select-option-10:00'));

        expect(screen.getByRole('combobox', { name: 'Jam Selesai' })).toBeInTheDocument();
        expect(screen.getByText(/10:00–11:00 WIB/i)).toBeInTheDocument();
        expect(screen.getAllByText(/\(1 jam\)/i).length).toBeGreaterThanOrEqual(1);
    });

    // Slot rows are fetched per sub-slot (30 min). Rows computed for the selected 8h duration
    // flagged 16:00 as "exceeds operating hours" (16:00+8h > 23:59), locking every end time from 17:00.
    it('computeEndTimeOptions lets a long meeting end at 17:00 when every 30-min sub-slot is free', () => {
        const slots = Array.from({ length: 30 }, (_, i) => {
            const mins = 8 * 60 + i * 30;
            const time = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
            return { time, available: true, availableAccountsCount: 10, totalAccountsCount: 10 };
        });

        const opts = computeEndTimeOptions(
            '08:00',
            '2026-10-07',
            { slotEndTime: '23:59', slotIntervalMinutes: 30 },
            [60, 480, 540, 600],
            slots,
        );

        expect(opts.find((o) => o.value === '16:00')?.isUnavailable).toBe(false);
        expect(opts.find((o) => o.value === '17:00')?.isUnavailable).toBe(false);
        expect(opts.find((o) => o.value === '18:00')?.isUnavailable).toBe(false);
    });

    it('requests sub-slot availability at the 30-minute interval, independent of the chosen duration', () => {
        render(<SimpleBookingForm />);
        fireEvent.click(screen.getByRole('button', { name: 'Tanggal' }));

        const calls = vi.mocked(hooks.useDaySlotsAvailability).mock.calls;
        expect(calls.some(([, dur]) => dur === 30)).toBe(true);
    });

    it('computeEndTimeOptions correctly flags full slots and cascades blocker to all subsequent options', () => {
        const slots = [
            { time: '13:00', available: true, availableAccountsCount: 1, totalAccountsCount: 10 },
            { time: '13:30', available: false, availableAccountsCount: 0, totalAccountsCount: 10, reason: 'Penuh (10 akun)' },
            { time: '14:00', available: false, availableAccountsCount: 0, totalAccountsCount: 10, reason: 'Penuh (10 akun)' },
            { time: '14:30', available: false, availableAccountsCount: 0, totalAccountsCount: 10, reason: 'Penuh (10 akun)' },
            { time: '15:00', available: true, availableAccountsCount: 2, totalAccountsCount: 10 },
        ];

        const opts = computeEndTimeOptions(
            '13:00',
            '2026-09-05',
            { slotEndTime: '18:00', slotIntervalMinutes: 30 },
            [30, 60, 90, 120],
            slots
        );

        // 13:30 (30 min) uses only slot 13:00 which is available
        const opt30 = opts.find((o) => o.value === '13:30');
        expect(opt30).toBeDefined();
        expect(opt30?.isUnavailable).toBe(false);

        // 14:00 (60 min) traverses 13:30 which is full
        const opt60 = opts.find((o) => o.value === '14:00');
        expect(opt60).toBeDefined();
        expect(opt60?.isUnavailable).toBe(true);
        expect(opt60?.reason).toBe('Penuh (10 akun)');

        // 14:30 (90 min) cascaded blocker
        const opt90 = opts.find((o) => o.value === '14:30');
        expect(opt90).toBeDefined();
        expect(opt90?.isUnavailable).toBe(true);

        // 15:00 (120 min) cascaded blocker even though 15:00 is free
        const opt120 = opts.find((o) => o.value === '15:00');
        expect(opt120).toBeDefined();
        expect(opt120?.isUnavailable).toBe(true);
    });

    it('auto-selects the first available end time when default duration (+60 min) is full', () => {
        // When 14:00 is chosen, 15:00 is full in mock slots (available: false)
        // It should pick 14:30 (30 min) as the first available option
        vi.mocked(hooks.useDaySlotsAvailability).mockReturnValue({
            data: {
                date: '2026-09-04',
                durationMinutes: 60,
                isWorkingDay: true,
                isBlocked: false,
                isPast: false,
                isFutureExceeded: false,
                totalAccounts: 10,
                availableSlotsCount: 16,
                totalSlotsCount: 20,
                isFullyBooked: false,
                slots: [
                    { time: '14:00', endTime: '14:30', available: true, availableAccountsCount: 2, totalAccountsCount: 10 },
                    { time: '14:30', endTime: '15:00', available: false, availableAccountsCount: 0, totalAccountsCount: 10, reason: 'Penuh (10 akun)' },
                    { time: '15:00', endTime: '15:30', available: false, availableAccountsCount: 0, totalAccountsCount: 10, reason: 'Penuh (10 akun)' },
                ],
            },
            isLoading: false,
        } as any);

        render(<SimpleBookingForm />);
        fireEvent.click(screen.getByRole('button', { name: 'Tanggal' }));
        fireEvent.click(screen.getByTestId('zoom-time-select'));
        fireEvent.click(screen.getByTestId('zoom-time-select-option-14:00'));

        // Since 14:30-15:00 is full, 15:00 (+60 min) is unavailable. First available is 14:30 (30 min).
        expect(screen.getByRole('combobox', { name: 'Jam Selesai' })).toHaveTextContent(/14:30/);
    });

    it('submits with selected internal and external participants', async () => {
        mutateAsync.mockResolvedValue({ meeting: { joinUrl: 'https://zoom.us/j/123' } });
        render(<SimpleBookingForm />);

        fireEvent.change(screen.getByLabelText(/judul/i), { target: { value: 'Rapat Kolaborasi' } });
        fireEvent.click(screen.getByRole('button', { name: 'Tanggal' }));
        fireEvent.click(screen.getByTestId('zoom-time-select'));
        fireEvent.click(screen.getByTestId('zoom-time-select-option-10:00'));

        // Focus on participant picker input
        const participantInput = screen.getByPlaceholderText(/Cari nama\/email rekan iDesk/i);
        fireEvent.focus(participantInput);

        // Select internal user from dropdown
        const userOption = await screen.findByTestId('user-option-u1');
        fireEvent.click(userOption);

        // Type an external email and press enter
        fireEvent.change(participantInput, { target: { value: 'client@external.com' } });
        fireEvent.keyDown(participantInput, { key: 'Enter' });

        // Both chips should be in the document
        expect(screen.getByTestId('participant-chip-bagas@example.com')).toBeInTheDocument();
        expect(screen.getByTestId('participant-chip-client@external.com')).toBeInTheDocument();

        // Submit form
        fireEvent.click(screen.getByRole('button', { name: /buat meeting/i }));

        await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
        const dto = mutateAsync.mock.calls[0][0];
        expect(dto.participantEmails).toEqual(['bagas@example.com', 'client@external.com']);
    });

    describe('Ongoing slot and end time computation', () => {
        beforeEach(() => {
            vi.useFakeTimers();
            // Set clock to today at 10:16 AM
            vi.setSystemTime(new Date('2026-09-11T10:16:00'));
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('computeEndTimeOptions allows future end times (10:30, 11:00) when starting from ongoing slot (10:00 at 10:16)', () => {
            const slots = [
                { time: '10:00', endTime: '10:30', available: true, availableAccountsCount: 5, totalAccountsCount: 10 },
                { time: '10:30', endTime: '11:00', available: true, availableAccountsCount: 5, totalAccountsCount: 10 },
                { time: '11:00', endTime: '11:30', available: true, availableAccountsCount: 5, totalAccountsCount: 10 },
            ];

            const options = computeEndTimeOptions(
                '10:00',
                '2026-09-11',
                { slotStartTime: '08:00', slotEndTime: '18:00', slotIntervalMinutes: 30 } as any,
                [30, 60, 90, 120],
                slots as any
            );

            // 10:30, 11:00, 11:30, 12:00 must all be available (> 10:16)
            expect(options.find(o => o.time === '10:30')?.isUnavailable).toBe(false);
            expect(options.find(o => o.time === '11:00')?.isUnavailable).toBe(false);
            expect(options.find(o => o.time === '11:30')?.isUnavailable).toBe(false);
            expect(options.find(o => o.time === '12:00')?.isUnavailable).toBe(false);
        });

        it('computeEndTimeOptions disables past end times but keeps future end times available', () => {
            // Suppose now is 10:35, and startTime is 10:00
            vi.setSystemTime(new Date('2026-09-11T10:35:00'));

            const slots = [
                { time: '10:00', endTime: '10:30', available: true, availableAccountsCount: 5, totalAccountsCount: 10 },
                { time: '10:30', endTime: '11:00', available: true, availableAccountsCount: 5, totalAccountsCount: 10 },
                { time: '11:00', endTime: '11:30', available: true, availableAccountsCount: 5, totalAccountsCount: 10 },
            ];

            const options = computeEndTimeOptions(
                '10:00',
                '2026-09-11',
                { slotStartTime: '08:00', slotEndTime: '18:00', slotIntervalMinutes: 30 } as any,
                [30, 60, 90],
                slots as any
            );

            // 10:30 (30 min) is in the past (10:30 <= 10:35) -> unavailable
            expect(options.find(o => o.time === '10:30')?.isUnavailable).toBe(true);
            expect(options.find(o => o.time === '10:30')?.reason).toBe('Waktu sudah terlewat');

            // 11:00 (60 min) and 11:30 (90 min) are in the future -> available!
            expect(options.find(o => o.time === '11:00')?.isUnavailable).toBe(false);
            expect(options.find(o => o.time === '11:30')?.isUnavailable).toBe(false);
        });

        it('computeEndTimeOptions marks all end times as unavailable if startTime completely ended in the past', () => {
            // At 10:16, startTime is 08:00 (which ended at 08:30)
            const slots = [
                { time: '08:00', endTime: '08:30', available: false, availableAccountsCount: 0, totalAccountsCount: 10, reason: 'Waktu sudah lewat' },
                { time: '08:30', endTime: '09:00', available: false, availableAccountsCount: 0, totalAccountsCount: 10, reason: 'Waktu sudah lewat' },
            ];

            const options = computeEndTimeOptions(
                '08:00',
                '2026-09-11',
                { slotStartTime: '08:00', slotEndTime: '18:00', slotIntervalMinutes: 30 } as any,
                [30, 60, 90],
                slots as any
            );

            expect(options.every(o => o.isUnavailable)).toBe(true);
            expect(options[0].reason).toBe('Waktu sudah terlewat');
        });
    });
});

