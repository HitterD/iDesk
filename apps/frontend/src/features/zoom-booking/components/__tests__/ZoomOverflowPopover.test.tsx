import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ZoomOverflowPopover } from '../ZoomOverflowPopover';

const bookings = Array.from({ length: 6 }, (_, i) => ({
    id: `b${i}`,
    title: `Meeting ${i}`,
    startTime: '14:00',
    endTime: '15:00',
    accountId: `acc-${i}`,
    accountName: `Account ${i}`,
    accountColorHex: `hsl(${i * 60}, 70%, 50%)`,
    isMine: i === 0,
}));

describe('ZoomOverflowPopover', () => {
    it('renders header with count and date', () => {
        render(
            <ZoomOverflowPopover
                open={true}
                onClose={vi.fn()}
                onSelectBooking={vi.fn()}
                onBookSlot={vi.fn()}
                bookings={bookings}
                timeRange="14:00 – 15:00"
                date="Rabu, 11 Juni 2026"
            />
        );
        expect(screen.getAllByText(/6 Meeting/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Rabu/i).length).toBeGreaterThan(0);
    });

    it('renders all 6 bookings as list rows', () => {
        render(
            <ZoomOverflowPopover
                open={true}
                onClose={vi.fn()}
                onSelectBooking={vi.fn()}
                onBookSlot={vi.fn()}
                bookings={bookings}
                timeRange="14:00 – 15:00"
                date="Rabu, 11 Juni 2026"
            />
        );
        bookings.forEach((b) => {
            expect(screen.getByText(b.title)).toBeInTheDocument();
        });
    });

    it('shows SAYA badge for my bookings', () => {
        render(
            <ZoomOverflowPopover
                open={true}
                onClose={vi.fn()}
                onSelectBooking={vi.fn()}
                onBookSlot={vi.fn()}
                bookings={bookings}
                timeRange="14:00 – 15:00"
                date="Rabu, 11 Juni 2026"
            />
        );
        expect(screen.getAllByText(/saya/i).length).toBeGreaterThan(0);
    });

    it('calls onSelectBooking with id when row clicked', async () => {
        const onSelect = vi.fn();
        render(
            <ZoomOverflowPopover
                open={true}
                onClose={vi.fn()}
                onSelectBooking={onSelect}
                onBookSlot={vi.fn()}
                bookings={bookings}
                timeRange="14:00 – 15:00"
                date="Rabu, 11 Juni 2026"
            />
        );
        await userEvent.click(screen.getByText('Meeting 1'));
        expect(onSelect).toHaveBeenCalledWith('b1');
    });

    it('calls onBookSlot when footer button clicked', async () => {
        const onBookSlot = vi.fn();
        render(
            <ZoomOverflowPopover
                open={true}
                onClose={vi.fn()}
                onSelectBooking={vi.fn()}
                onBookSlot={onBookSlot}
                bookings={bookings}
                timeRange="14:00 – 15:00"
                date="Rabu, 11 Juni 2026"
            />
        );
        await userEvent.click(screen.getByRole('button', { name: /book slot kosong/i }));
        expect(onBookSlot).toHaveBeenCalledOnce();
    });
});
