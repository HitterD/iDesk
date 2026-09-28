import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ZoomAccountsMatrix, visiblePillCount } from '../ZoomAccountsMatrix';

vi.mock('../../hooks/useZoomSettings', () => ({
    useZoomSettings: () => ({ data: { workingDays: [1, 2, 3, 4, 5] } }),
    isWorkingDay: (date: Date, days: number[]) => days.includes(date.getDay()),
}));

// jsdom lacks ResizeObserver, which the grid and Radix popover rely on.
globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
} as unknown as typeof ResizeObserver;

const DATE = '2026-09-09';

const booking = (id: string, accountId: string, time: string, mine = false) => ({
    id,
    title: `Meeting ${id}`,
    startTime: time,
    zoomAccountId: accountId,
    bookedBy: mine ? 'Saya' : 'Budi',
});

const mergedDays = [
    {
        date: DATE,
        dayOfWeek: 3,
        isWorkingDay: true,
        isBlocked: false,
        slots: [
            { time: '08:00', isMyBooking: false, bookings: [booking('b1', 'a1', '08:00'), booking('b2', 'a1', '09:00', true)] },
            { time: '10:00', isMyBooking: false, bookings: [booking('b3', 'a1', '10:00')] },
        ],
    },
] as any;

const accounts = [
    { id: 'a1', name: 'Zoom Admin 1', colorHex: '#007AFF' },
    { id: 'a2', name: 'Zoom Admin 2', colorHex: '#FF9500' },
] as any;

const renderMatrix = (props: Partial<React.ComponentProps<typeof ZoomAccountsMatrix>> = {}) =>
    render(
        <ZoomAccountsMatrix
            currentDate={new Date(`${DATE}T00:00:00`)}
            mergedDays={mergedDays}
            accounts={accounts}
            onBookingClick={vi.fn()}
            {...props}
        />,
    );

describe('ZoomAccountsMatrix', () => {
    it('highlights the entire current-day column, including a non-working day', () => {
        vi.useFakeTimers();
        try {
            vi.setSystemTime(new Date('2026-09-13T12:00:00'));
            renderMatrix();

            expect(screen.getByTestId(`matrix-day-2026-09-13`)).toHaveClass('bg-primary/[0.07]');
            for (const account of accounts) {
                const cell = within(screen.getByTestId(`matrix-row-${account.id}`))
                    .getByRole('button', { name: new RegExp(`${account.name}, 13 September`) });
                expect(cell).toHaveClass('bg-primary/[0.07]');
            }
            expect(screen.getByTestId(`matrix-day-2026-09-12`)).not.toHaveClass('bg-primary/[0.07]');
        } finally {
            vi.useRealTimers();
        }
    });

    it('shows one compact pill per cell with a +N badge for the rest', () => {
        renderMatrix();
        const row = screen.getByTestId('matrix-row-a1');
        const blocks = within(row).getAllByTestId('matrix-block');
        // Row height falls back to the minimum in jsdom, so one pill fits and the rest become "+N".
        expect(blocks).toHaveLength(1);
        expect(blocks[0]).toHaveTextContent('08:00');
        expect(blocks[0]).not.toHaveAttribute('data-mine');
        expect(within(row).getByText('+2')).toBeInTheDocument();
    });

    it('filters with the segmented control', async () => {
        renderMatrix();
        await userEvent.click(screen.getByRole('radio', { name: 'Ada jadwal' }));
        expect(screen.queryByTestId('matrix-row-a2')).not.toBeInTheDocument();

        await userEvent.click(screen.getByRole('radio', { name: /Punya saya/ }));
        const blocks = within(screen.getByTestId('matrix-row-a1')).getAllByTestId('matrix-block');
        expect(blocks).toHaveLength(1);
        expect(blocks[0]).toHaveAttribute('data-mine', 'true');
    });

    it('opens the cell sheet and schedules on that account', async () => {
        const onCellClick = vi.fn();
        renderMatrix({ onCellClick });
        await userEvent.click(screen.getByRole('button', { name: /Zoom Admin 1, 9 September: 3 meeting/ }));
        const dialog = screen.getByRole('dialog');
        expect(within(dialog).getByText('Meeting b1')).toBeInTheDocument();
        await userEvent.click(within(dialog).getByRole('button', { name: /Jadwalkan di Zoom Admin 1/ }));
        expect(onCellClick).toHaveBeenCalledWith('a1', DATE);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});

describe('visiblePillCount', () => {
    it('fits more pills as rows grow and reserves a line for "+N"', () => {
        expect(visiblePillCount(36, 3)).toBe(1);
        expect(visiblePillCount(50, 2)).toBe(2);
        expect(visiblePillCount(50, 5)).toBe(1);
        expect(visiblePillCount(64, 5)).toBe(2);
        expect(visiblePillCount(36, 0)).toBe(0);
    });
});
