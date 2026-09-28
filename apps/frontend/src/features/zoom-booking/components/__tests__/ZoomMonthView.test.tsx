import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ZoomMonthView } from '../ZoomMonthView';
import type { CalendarDay, CalendarSlot } from '../../types';

vi.mock('../../hooks/useZoomSettings', () => ({
    useZoomSettings: () => ({ data: { workingDays: [1, 2, 3, 4, 5] } }),
    isWorkingDay: (date: Date, days: number[]) => days.includes(date.getDay()),
}));

const DATE = '2026-09-09'; // Wednesday

const slot = (i: number): CalendarSlot => ({
    date: DATE,
    time: `${String(8 + i).padStart(2, '0')}:00`,
    endTime: `${String(9 + i).padStart(2, '0')}:00`,
    status: 'booked',
    booking: {
        id: `b-${i}`,
        title: `Meeting ${i}`,
        bookedBy: 'u',
        durationMinutes: 60,
        startTime: `${String(8 + i).padStart(2, '0')}:00`,
        zoomAccountId: 'acc-1',
    } as CalendarSlot['booking'],
});

const day = (count: number): CalendarDay => ({
    date: DATE,
    dayOfWeek: 3,
    isWorkingDay: true,
    isBlocked: false,
    slots: Array.from({ length: count }, (_, i) => slot(i)),
});

const renderMonth = (count: number, onBookingClick = vi.fn()) =>
    render(
        <ZoomMonthView
            currentDate={new Date(`${DATE}T00:00:00`)}
            calendar={[day(count)]}
            accounts={[{ id: 'acc-1', name: 'Zoom Admin 1', colorHex: '#ff0000' } as any]}
            onSlotClick={vi.fn()}
            onDateDoubleClick={vi.fn()}
            onBookingClick={onBookingClick}
        />,
    );

describe('ZoomMonthView', () => {
    it('drops the per-day meeting counter badge', () => {
        renderMonth(3);
        expect(screen.queryByText(/3 meetings/i)).not.toBeInTheDocument();
    });

    it('shows every event when they fit, without an overflow row', () => {
        renderMonth(3);
        expect(screen.getByText('Meeting 0')).toBeInTheDocument();
        expect(screen.getByText('Meeting 2')).toBeInTheDocument();
        expect(screen.queryByText(/lagi$/)).not.toBeInTheDocument();
    });

    it('collapses the rest into "N lagi" and opens the day list', async () => {
        renderMonth(6);
        const more = screen.getByRole('button', { name: '4 lagi' });
        await userEvent.click(more);
        expect(screen.getByText(/6 meeting · 1 akun Zoom/)).toBeInTheDocument();
    });

    it('opens the booking when an event is clicked', async () => {
        const onBookingClick = vi.fn();
        renderMonth(1, onBookingClick);
        await userEvent.click(screen.getByText('Meeting 0'));
        expect(onBookingClick).toHaveBeenCalledWith('b-0', expect.objectContaining({ date: DATE }));
    });
});
