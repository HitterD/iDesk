import React, { useState, useMemo, useCallback, useId } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import {
    format,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    getDay,
    isSameDay,
    isToday,
    addMonths,
    subMonths,
    startOfDay,
    isBefore,
    isAfter,
} from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import './datetime-picker.css';

export interface ModernDateTimePickerProps {
    value?: Date;
    onChange?: (date: Date) => void;
    minDate?: Date;
    maxDate?: Date;
    disabled?: boolean;
    className?: string;
    placeholder?: string;
}

const WEEKDAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const QUICK_HOURS = [8, 9, 10, 12, 14, 16, 17];
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const MINUTES = Array.from({ length: 60 }, (_, minute) => minute);
const pad = (n: number) => String(n).padStart(2, '0');

const atTime = (day: Date, hour: number, minute: number) => {
    const next = new Date(day);
    next.setHours(hour, minute, 0, 0);
    return next;
};

/**
 * Date and time in one popover, laid out like the iOS / macOS date picker: month header with arrows,
 * round day cells (today in the accent colour, the chosen day filled), then the time as one compact
 * pill with quick hours below it. Times outside minDate / maxDate cannot be picked.
 */
export const ModernDateTimePicker: React.FC<ModernDateTimePickerProps> = ({
    value,
    onChange,
    minDate,
    maxDate,
    disabled = false,
    className,
    placeholder = 'Pilih Tanggal & Waktu',
}) => {
    const [open, setOpen] = useState(false);
    const timeLabelId = useId();
    const selectedDate = useMemo(() => value || new Date(), [value]);
    const [viewMonth, setViewMonth] = useState<Date>(selectedDate);

    const handleOpenChange = (newOpen: boolean) => {
        if (newOpen) setViewMonth(selectedDate);
        setOpen(newOpen);
    };

    const monthDays = useMemo(
        () => eachDayOfInterval({ start: startOfMonth(viewMonth), end: endOfMonth(viewMonth) }),
        [viewMonth],
    );
    const leadingBlanks = getDay(startOfMonth(viewMonth));

    const isDateDisabled = useCallback(
        (day: Date) =>
            Boolean((minDate && startOfDay(day) < startOfDay(minDate)) || (maxDate && startOfDay(day) > startOfDay(maxDate))),
        [minDate, maxDate],
    );
    const isTimeOutOfRange = useCallback(
        (candidate: Date) => Boolean((minDate && isBefore(candidate, minDate)) || (maxDate && isAfter(candidate, maxDate))),
        [minDate, maxDate],
    );
    const canGoBack = !minDate || startOfMonth(viewMonth) > startOfMonth(minDate);
    const canGoForward = !maxDate || startOfMonth(viewMonth) < startOfMonth(maxDate);

    const currentHour = selectedDate.getHours();
    const currentMinute = selectedDate.getMinutes();

    const handleSelectDay = (day: Date) => {
        if (isDateDisabled(day)) return;
        let next = atTime(day, currentHour, currentMinute);
        if (minDate && isBefore(next, minDate)) next = atTime(day, minDate.getHours(), minDate.getMinutes());
        onChange?.(next);
    };

    const handleSelectTime = (hour: number, minute: number) => onChange?.(atTime(selectedDate, hour, minute));

    const formattedDateText = value ? format(value, 'EEEE, d MMMM yyyy', { locale: idLocale }) : placeholder;
    const formattedTimeText = value ? `${format(value, 'HH.mm')} WIB` : '--.-- WIB';

    return (
        <Popover open={open} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    disabled={disabled}
                    aria-label={value ? `${formattedDateText}, ${formattedTimeText}` : placeholder}
                    className={cn('datetime-trigger', className)}
                >
                    <CalendarIcon className="w-4 h-4 shrink-0" />
                    <span className="min-w-0 flex-1">{formattedDateText}<small className="block">{formattedTimeText}</small></span>
                    <ChevronDown className="w-4 h-4 shrink-0" />
                </button>
            </PopoverTrigger>

            <PopoverContent
                align="start"
                sideOffset={8}
                className="datetime-popover"
                collisionPadding={12}
                onEscapeKeyDown={(event) => event.stopPropagation()}
            >
                <div className="dtp-head">
                    <h4 aria-live="polite">{format(viewMonth, 'MMMM yyyy', { locale: idLocale })}</h4>
                    <div className="dtp-nav">
                        <button type="button" aria-label="Bulan sebelumnya" disabled={!canGoBack}
                            onClick={() => setViewMonth((m) => subMonths(m, 1))}>
                            <ChevronLeft aria-hidden="true" />
                        </button>
                        <button type="button" aria-label="Bulan berikutnya" disabled={!canGoForward}
                            onClick={() => setViewMonth((m) => addMonths(m, 1))}>
                            <ChevronRight aria-hidden="true" />
                        </button>
                    </div>
                </div>

                <div className="dtp-grid" role="group" aria-label="Tanggal">
                    {WEEKDAYS.map((weekday) => <span key={weekday} className="dtp-weekday" aria-hidden="true">{weekday}</span>)}
                    {Array.from({ length: leadingBlanks }, (_, i) => <span key={`blank-${i}`} aria-hidden="true" />)}
                    {monthDays.map((day) => {
                        const selected = Boolean(value && isSameDay(day, value));
                        return (
                            <button
                                key={day.toISOString()}
                                type="button"
                                aria-label={format(day, 'd MMMM yyyy', { locale: idLocale })}
                                aria-pressed={selected}
                                aria-current={isToday(day) ? 'date' : undefined}
                                disabled={isDateDisabled(day)}
                                onClick={() => handleSelectDay(day)}
                                className={cn('dtp-day', selected && 'is-selected', isToday(day) && 'is-today')}
                            >
                                {format(day, 'd')}
                            </button>
                        );
                    })}
                </div>

                <div className="dtp-time">
                    <div className="dtp-time-row">
                        <span id={timeLabelId}>Waktu</span>
                        <div className="dtp-time-pill" role="group" aria-labelledby={timeLabelId}>
                            <select aria-label="Jam" value={currentHour} onChange={(e) => handleSelectTime(Number(e.target.value), currentMinute)}>
                                {HOURS.map((hour) => <option key={hour} value={hour}>{pad(hour)}</option>)}
                            </select>
                            <span aria-hidden="true">.</span>
                            <select aria-label="Menit" value={currentMinute} onChange={(e) => handleSelectTime(currentHour, Number(e.target.value))}>
                                {MINUTES.map((minute) => <option key={minute} value={minute}>{pad(minute)}</option>)}
                            </select>
                            <span className="dtp-zone">WIB</span>
                        </div>
                    </div>
                    <div className="dtp-quick" role="group" aria-label="Jam cepat">
                        {QUICK_HOURS.map((hour) => {
                            const active = currentHour === hour && currentMinute === 0;
                            return (
                                <button
                                    key={hour}
                                    type="button"
                                    aria-pressed={active}
                                    disabled={isTimeOutOfRange(atTime(selectedDate, hour, 0))}
                                    onClick={() => handleSelectTime(hour, 0)}
                                    className={cn('dtp-chip', active && 'is-active')}
                                >
                                    {pad(hour)}.00
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="dtp-foot">
                    <button
                        type="button"
                        className="dtp-today"
                        disabled={isDateDisabled(new Date())}
                        onClick={() => {
                            const today = new Date();
                            setViewMonth(today);
                            handleSelectDay(today);
                        }}
                    >
                        Hari ini
                    </button>
                    <button type="button" className="dtp-done" onClick={() => setOpen(false)}>Selesai</button>
                </div>
            </PopoverContent>
        </Popover>
    );
};

export default ModernDateTimePicker;
