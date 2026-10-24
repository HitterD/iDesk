import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { addDays, format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import type { CalendarSlot } from '../../types';
import { ZoomSlotPicker, type ZoomSlotPickerProps } from '../ZoomSlotPicker';

const day = format(addDays(new Date(), 2), 'yyyy-MM-dd');
const meeting = { id: 'b-9', title: 'Diskusi Air', bookedBy: 'A', durationMinutes: 120, startTime: '14:00', endTime: '16:00' };
const slots: CalendarSlot[] = [
    { date: day, time: '14:00', endTime: '14:30', status: 'booked', booking: meeting },
    { date: day, time: '14:30', endTime: '15:00', status: 'booked', booking: meeting },
];

const startField = () => screen.getByRole('combobox', { name: 'Jam mulai' });
const endField = () => screen.getByRole('combobox', { name: 'Jam selesai' });

const renderPicker = (props: Partial<ZoomSlotPickerProps> = {}) => {
    const handlers = { onDateChange: vi.fn(), onStartTimeChange: vi.fn(), onDurationChange: vi.fn() };
    render(
        <ZoomSlotPicker date={day} startTime="" duration={60} slots={slots} times={['01:30', '13:00', '13:30', '14:00', '15:00', '16:00']}
            durations={[30, 60, 120]} maxDaysAhead={14} {...handlers} {...props} />,
    );
    return handlers;
};

describe('ZoomSlotPicker', () => {
    it('lists taken start times with who has them and keeps them unpickable', () => {
        const { onStartTimeChange } = renderPicker();
        fireEvent.focus(startField());

        const taken = screen.getByRole('option', { name: /14\.00 Terisi · Diskusi Air/ });
        expect(taken).toHaveAttribute('aria-disabled', 'true');
        fireEvent.click(taken);
        expect(onStartTimeChange).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('option', { name: /16\.00 Kosong/ }));
        expect(onStartTimeChange).toHaveBeenCalledWith('16:00');
    });

    it('takes a typed time, and refuses one that is taken', () => {
        const { onStartTimeChange } = renderPicker();
        const field = startField();

        fireEvent.change(field, { target: { value: '1300' } });
        fireEvent.keyDown(field, { key: 'Enter' });
        expect(onStartTimeChange).toHaveBeenCalledWith('13:00');

        fireEvent.change(field, { target: { value: '14.00' } });
        fireEvent.keyDown(field, { key: 'Enter' });
        expect(screen.getByRole('alert')).toHaveTextContent('14.00 sudah terisi: Diskusi Air');
        expect(onStartTimeChange).toHaveBeenCalledTimes(1);
    });

    it('narrows the list to what is being typed', () => {
        renderPicker();
        fireEvent.change(startField(), { target: { value: '13' } });

        expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['13.00Kosong', '13.30Kosong']);

        fireEvent.change(startField(), { target: { value: '1' } });
        expect(screen.getAllByRole('option').map((o) => o.textContent?.slice(0, 5))).toEqual(['01.30', '13.00', '13.30', '14.00', '15.00', '16.00']);
    });

    it('offers end times (not lengths) and blocks one that runs into the next booking', () => {
        const { onDurationChange } = renderPicker({ startTime: '13:00' });
        fireEvent.focus(endField());

        expect(screen.getAllByRole('option').map((o) => o.getAttribute('aria-label'))).toEqual([
            '13.30 30 mnt', '14.00 1 jam', '15.00 Terisi · Diskusi Air',
        ]);
        expect(screen.getByRole('option', { name: /15\.00/ })).toHaveAttribute('aria-disabled', 'true');

        fireEvent.click(screen.getByRole('option', { name: '14.00 1 jam' }));
        expect(onDurationChange).toHaveBeenCalledWith(60);
    });

    it('takes a typed end time and turns it into the meeting length', () => {
        const { onDurationChange } = renderPicker({ startTime: '16:00' });
        fireEvent.change(endField(), { target: { value: '18' } });
        fireEvent.keyDown(endField(), { key: 'Enter' });
        expect(onDurationChange).toHaveBeenCalledWith(120);

        fireEvent.change(endField(), { target: { value: '17.15' } });
        fireEvent.keyDown(endField(), { key: 'Enter' });
        expect(screen.getByRole('alert')).toHaveTextContent('Jam selesai 17.15 tidak tersedia');
    });

    it('asks for the start time before offering end times, and never offers one past midnight', () => {
        renderPicker();
        expect(screen.queryByRole('combobox', { name: 'Jam selesai' })).not.toBeInTheDocument();
        expect(screen.getByText('Pilih jam mulai dulu.')).toBeInTheDocument();
    });

    it('lets Gabungan pick a busy slot, another account can take it', () => {
        renderPicker({ allowBusy: true, startTime: '14:00' });

        fireEvent.focus(startField());
        expect(screen.getByRole('option', { name: /14\.00 Terisi/ })).not.toHaveAttribute('aria-disabled');
        expect(screen.getByRole('status')).toHaveTextContent('bentrok dengan Diskusi Air');
    });

    it('does not count the booking being rescheduled and marks its current slot', () => {
        renderPicker({ excludeBookingId: 'b-9', current: { date: day, startTime: '14:00' } });

        fireEvent.focus(startField());
        expect(screen.getByRole('option', { name: '14.00 Jadwal saat ini' })).not.toHaveAttribute('aria-disabled');
    });

    it('picks another day from the strip', () => {
        const { onDateChange } = renderPicker();
        const tomorrow = addDays(new Date(), 1);

        fireEvent.click(screen.getByRole('radio', { name: format(tomorrow, 'EEEE, d MMMM yyyy', { locale: idLocale }) }));

        expect(onDateChange).toHaveBeenCalledWith(format(tomorrow, 'yyyy-MM-dd'));
    });
});
