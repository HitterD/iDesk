import React, { useEffect, useMemo, useRef } from 'react';
import { addDays, format, isSameDay, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CalendarSlot } from '../types';
import { clashWith, displayTime, durationLabel, endsBeforeMidnight, fromMinutes, occupants, toMinutes } from '../utils/slotAvailability';
import { ZoomTimeCombobox, type TimeOption } from './ZoomTimeCombobox';
import './zoom-slot-picker.css';

/** Never render more than this many day chips, whatever the advance-booking window is. */
const MAX_STRIP_DAYS = 60;
const STRIP_SCROLL = 280;

export interface ZoomSlotPickerProps {
    /** yyyy-MM-dd */
    date: string;
    onDateChange: (date: string) => void;
    startTime: string;
    onStartTimeChange: (time: string) => void;
    /** Meeting length in minutes. Picked as an end time; callers keep working in minutes. */
    duration: number;
    onDurationChange: (minutes: number) => void;
    /** Calendar slots of `date` for the chosen account (undefined while loading). */
    slots?: CalendarSlot[];
    loading?: boolean;
    /** Start times offered by the settings window, "HH:mm". */
    times: string[];
    /** Allowed meeting lengths (the backend accepts only these), offered as end times. */
    durations: number[];
    /** 0 = Sunday; days outside are not bookable. */
    workingDays?: number[];
    maxDaysAhead: number;
    /** Rescheduling: this booking does not block itself, and its current slot is marked. */
    excludeBookingId?: string;
    current?: { date: string; startTime: string };
    /** Gabungan mode: a busy slot can still go to another account, so it stays pickable. */
    allowBusy?: boolean;
}

/**
 * Date strip + typeable start and end time fields, showing availability up front so a clash is never picked blind:
 * the lists say who holds each taken slot. The end is picked as a clock time ("selesai 15.00"), not a length, so
 * nobody has to work out when a 2-hour meeting ends. Shared by "Book Meeting" and "Reschedule".
 */
export const ZoomSlotPicker: React.FC<ZoomSlotPickerProps> = ({
    date, onDateChange, startTime, onStartTimeChange, duration, onDurationChange,
    slots, loading = false, times, durations, workingDays, maxDaysAhead, excludeBookingId, current, allowBusy = false,
}) => {
    const stripRef = useRef<HTMLDivElement>(null);
    const today = useMemo(() => new Date(), []);
    const days = useMemo(
        () => Array.from({ length: Math.min(MAX_STRIP_DAYS, Math.max(1, maxDaysAhead) + 1) }, (_, i) => addDays(today, i)),
        [today, maxDaysAhead],
    );
    const busy = useMemo(() => occupants(slots, excludeBookingId), [slots, excludeBookingId]);
    const selectedDay = parseISO(date);
    const isToday = isSameDay(selectedDay, today);
    const nowMinutes = today.getHours() * 60 + today.getMinutes();
    // The chosen time always shows, even when it lies outside the offered window (e.g. preselected from the calendar).
    const offered = startTime && !times.includes(startTime) ? [...times, startTime].sort() : times;
    const visibleTimes = offered.filter((t) => t === startTime || !isToday || toMinutes(t) > nowMinutes);
    const shortest = Math.min(...durations, 30);
    const timeOptions = visibleTimes.map((time) => {
        const taken = clashWith(busy, time, shortest);
        return {
            time,
            busyTitle: taken?.title,
            isCurrent: current?.date === date && current.startTime === time,
            disabled: Boolean(taken) && !allowBusy,
        };
    });

    // Keep the chosen day in view (e.g. a preselected date two weeks out).
    useEffect(() => {
        stripRef.current?.querySelector('[aria-checked="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
    }, [date]);

    const scrollStrip = (direction: number) => stripRef.current?.scrollBy({ left: direction * STRIP_SCROLL, behavior: 'smooth' });
    const end = startTime ? fromMinutes(toMinutes(startTime) + duration) : '';
    const clash = startTime ? clashWith(busy, startTime, duration) : undefined;
    // One end time per allowed length; ends past midnight are not offered at all.
    const endOptions: TimeOption[] = startTime
        ? [...durations].sort((a, b) => a - b).filter((minutes) => endsBeforeMidnight(startTime, minutes)).map((minutes) => {
            const blockedBy = clashWith(busy, startTime, minutes);
            return {
                time: fromMinutes(toMinutes(startTime) + minutes),
                note: durationLabel(minutes),
                busyTitle: blockedBy?.title,
                disabled: Boolean(blockedBy) && !allowBusy,
            };
        })
        : [];
    const pickEnd = (time: string) => onDurationChange(toMinutes(time) - toMinutes(startTime));

    return (
        <div className="zsp">
            <div className="zsp-row">
                <span className="zsp-label" id="zsp-date">Tanggal</span>
                <div className="zsp-strip-wrap">
                    <button type="button" className="zsp-nav" onClick={() => scrollStrip(-1)} aria-label="Tanggal sebelumnya"><ChevronLeft aria-hidden="true" /></button>
                    <div className="zsp-strip" ref={stripRef} role="radiogroup" aria-labelledby="zsp-date">
                        {days.map((day) => {
                            const value = format(day, 'yyyy-MM-dd');
                            const closed = workingDays ? !workingDays.includes(day.getDay()) : false;
                            const selected = value === date;
                            return (
                                <button key={value} type="button" role="radio" aria-checked={selected} disabled={closed}
                                    aria-label={format(day, 'EEEE, d MMMM yyyy', { locale: idLocale })}
                                    className={cn('zsp-day', selected && 'is-selected', current?.date === value && 'is-current')}
                                    onClick={() => onDateChange(value)}>
                                    <small>{isSameDay(day, today) ? 'Hari ini' : format(day, 'EEE', { locale: idLocale })}</small>
                                    <b>{format(day, 'd')}</b>
                                    <small>{format(day, 'MMM', { locale: idLocale })}</small>
                                </button>
                            );
                        })}
                    </div>
                    <button type="button" className="zsp-nav" onClick={() => scrollStrip(1)} aria-label="Tanggal berikutnya"><ChevronRight aria-hidden="true" /></button>
                </div>
            </div>

            <div className="zsp-times">
            <div className="zsp-row">
                <span className="zsp-label" id="zsp-time">
                    Jam mulai
                    {loading && <Loader2 className="zsp-spin" aria-label="Memeriksa ketersediaan" />}
                </span>
                {visibleTimes.length === 0 ? (
                    <p className="zsp-empty">Tidak ada jam tersisa di tanggal ini. Pilih tanggal lain.</p>
                ) : (
                    <ZoomTimeCombobox value={startTime} onChange={onStartTimeChange} options={timeOptions} disabled={loading} labelledBy="zsp-time" />
                )}
            </div>

            <div className="zsp-row">
                <span className="zsp-label" id="zsp-end">Jam selesai</span>
                {!startTime ? (
                    <p className="zsp-empty">Pilih jam mulai dulu.</p>
                ) : endOptions.length === 0 ? (
                    <p className="zsp-empty">Tidak ada jam selesai sebelum tengah malam. Pilih jam mulai lebih awal.</p>
                ) : (
                    <ZoomTimeCombobox value={end} onChange={pickEnd} options={endOptions} disabled={loading} labelledBy="zsp-end"
                        placeholder="Ketik atau pilih, mis. 15.00" noun="Jam selesai" />
                )}
            </div>
            </div>

            {startTime && (
                <p className={cn('zsp-summary', clash && !allowBusy && 'is-clash')} role="status">
                    <span className="capitalize">{format(selectedDay, 'EEEE, d MMM', { locale: idLocale })}</span> · {displayTime(startTime)}–{displayTime(end)} WIB · {durationLabel(duration)}
                    {clash && <span> · bentrok dengan {clash.title}</span>}
                </p>
            )}
        </div>
    );
};
