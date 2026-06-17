import { useState, useRef, useMemo } from 'react';
import { isToday, format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Plus, Video, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CalendarDay } from '../types';

export const SLOT_INTERVAL = 30;
export const SLOT_HEIGHT = 48;

export const formatTimeDisplay = (time: string): { main: string; isHour: boolean } => {
    const [h, m] = time.split(':');
    const isHour = m === '00';
    return {
        main: isHour ? `${h}:00` : time,
        isHour,
    };
};

export const isHourStart = (time: string): boolean => {
    return time.endsWith(':00');
};

export const SLOT_BG = {
    available: 'bg-transparent cursor-pointer transition-colors duration-150 hover:bg-blue-500/10 hover:ring-1 hover:ring-inset hover:ring-blue-400/40',
    booked: 'bg-amber-400/15 border-l-2 border-amber-400 cursor-pointer transition-colors duration-150 hover:bg-amber-400/25',
    my_booking: 'bg-blue-400/15 border-l-2 border-blue-400 cursor-pointer transition-colors duration-150 hover:bg-blue-400/25',
    blocked: 'bg-gray-500/10 cursor-not-allowed opacity-60',
    external: 'bg-slate-400/15 border-l-2 border-slate-400 cursor-pointer transition-colors duration-150 hover:bg-slate-400/25 cursor-not-allowed',
};

export interface ProcessedBooking {
    id: string;
    title: string;
    bookedBy: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    rowStart: number;
    rowSpan: number;
    isMyBooking: boolean;
    isExternal: boolean;
    columnIndex: number;
    totalColumns: number;
}

export function processBookingsForDay(day: CalendarDay): ProcessedBooking[] {
    const bookings: ProcessedBooking[] = [];
    const processedSlots = new Set<string>();

    day.slots.forEach((slot, index) => {
        if (slot.booking && !processedSlots.has(slot.booking.id)) {
            const rowSpan = Math.max(1, Math.ceil(slot.booking.durationMinutes / SLOT_INTERVAL));
            bookings.push({
                id: slot.booking.id,
                title: slot.booking.title,
                bookedBy: slot.booking.bookedBy,
                startTime: slot.booking.startTime || slot.time,
                endTime: slot.booking.endTime || slot.endTime,
                durationMinutes: slot.booking.durationMinutes,
                rowStart: index + 2,
                rowSpan,
                isMyBooking: slot.status === 'my_booking',
                isExternal: slot.booking.isExternal || false,
                columnIndex: 0,
                totalColumns: 1,
            });
            processedSlots.add(slot.booking.id);
        }
    });

    for (let i = 0; i < bookings.length; i++) {
        const a = bookings[i];
        const aStart = a.rowStart;
        const aEnd = a.rowStart + a.rowSpan;

        const overlappingGroup = bookings.filter((b) => {
            const bStart = b.rowStart;
            const bEnd = b.rowStart + b.rowSpan;
            return aStart < bEnd && aEnd > bStart;
        });

        overlappingGroup.sort((x, y) => x.rowStart - y.rowStart);
        const total = overlappingGroup.length;
        overlappingGroup.forEach((b, colIdx) => {
            b.columnIndex = colIdx;
            b.totalColumns = total;
        });
    }

    return bookings;
}

interface ZoomCalendarGridProps {
    calendar: CalendarDay[];
    timeLabels: string[];
    canBook: boolean;
    onSlotClick: (day: CalendarDay, slotIndex: number) => void;
    onBookingClick: (booking: ProcessedBooking) => void;
    currentTime: Date;
}

export function ZoomCalendarGrid({
    calendar,
    timeLabels,
    canBook,
    onSlotClick,
    onBookingClick,
    currentTime
}: ZoomCalendarGridProps) {
    const [focusedCell, setFocusedCell] = useState<{ dayIndex: number; timeIndex: number } | null>(null);
    const calendarRef = useRef<HTMLDivElement>(null);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!calendar || !focusedCell) return;

        const { dayIndex, timeIndex } = focusedCell;
        let newDayIndex = dayIndex;
        let newTimeIndex = timeIndex;

        switch (e.key) {
            case 'ArrowUp':
                e.preventDefault();
                newTimeIndex = Math.max(0, timeIndex - 1);
                break;
            case 'ArrowDown':
                e.preventDefault();
                newTimeIndex = Math.min(timeLabels.length - 1, timeIndex + 1);
                break;
            case 'ArrowLeft':
                e.preventDefault();
                newDayIndex = Math.max(0, dayIndex - 1);
                break;
            case 'ArrowRight':
                e.preventDefault();
                newDayIndex = Math.min(calendar.length - 1, dayIndex + 1);
                break;
            case 'Enter':
            case ' ':
                e.preventDefault();
                if (calendar[dayIndex]) {
                    onSlotClick(calendar[dayIndex], timeIndex);
                }
                return;
            case 'Escape':
                setFocusedCell(null);
                return;
            default:
                return;
        }

        setFocusedCell({ dayIndex: newDayIndex, timeIndex: newTimeIndex });
    };

    const getCurrentTimePosition = useMemo(() => {
        if (!timeLabels.length) return null;

        const now = currentTime;
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTotalMinutes = currentHour * 60 + currentMinute;

        const [startH, startM] = timeLabels[0].split(':').map(Number);
        const startTotalMinutes = startH * 60 + startM;

        const [endH, endM] = timeLabels[timeLabels.length - 1].split(':').map(Number);
        const endTotalMinutes = endH * 60 + endM + SLOT_INTERVAL;

        if (currentTotalMinutes < startTotalMinutes || currentTotalMinutes > endTotalMinutes) {
            return null;
        }

        const totalRange = endTotalMinutes - startTotalMinutes;
        const offset = currentTotalMinutes - startTotalMinutes;
        const percentage = (offset / totalRange) * 100;

        const headerHeight = 72; // Approximate header row height
        const totalSlotsHeight = timeLabels.length * SLOT_HEIGHT;
        const pixelOffset = headerHeight + (offset / totalRange) * totalSlotsHeight;

        return { percentage, pixelOffset };
    }, [timeLabels, currentTime]);

    return (
        <div
            ref={calendarRef}
            className="min-w-[800px] relative outline-none"
            tabIndex={0}
            onKeyDown={handleKeyDown}
            role="grid"
            aria-label="Zoom booking calendar grid"
            onFocus={() => {
                if (!focusedCell) {
                    setFocusedCell({ dayIndex: 0, timeIndex: 0 });
                }
            }}
        >
            <div
                className="grid"
                style={{
                    gridTemplateColumns: '95px repeat(5, 1fr)',
                    gridTemplateRows: `auto repeat(${timeLabels.length}, ${SLOT_HEIGHT}px)`,
                }}
            >
                {/* Header Row - Time column (Sticky on both axes) */}
                <div className="bg-slate-50 dark:bg-slate-800 p-2 grid-separator-h grid-separator-v text-center text-sm font-medium sticky left-0 top-0 z-30 text-slate-600 dark:text-slate-300">
                    Time
                </div>

                {/* Header Row - Day columns (Sticky vertically) */}
                {calendar.map((day) => {
                    const dayDate = new Date(day.date);
                    const dayIsToday = isToday(dayDate);
                    const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6;
                    return (
                        <div
                            key={day.date}
                            className={cn(
                                'p-3 grid-separator-h text-center transition-colors sticky top-0 z-20',
                                dayIsToday
                                    ? 'bg-blue-50 dark:bg-blue-950/30 border-b-2 border-b-primary'
                                    : 'bg-slate-50 dark:bg-slate-800/90',
                                !day.isWorkingDay && 'opacity-70',
                                isWeekend && 'bg-slate-100/80 dark:bg-slate-800/40 opacity-60'
                            )}
                        >
                            <div className={cn(
                                'text-sm font-semibold capitalize',
                                dayIsToday && 'text-blue-600 dark:text-blue-400'
                            )}>
                                {format(new Date(day.date), 'EEEE', { locale: idLocale })}
                            </div>
                            <div className="flex items-center justify-center gap-2">
                                <span className={cn(
                                    'text-lg font-bold',
                                    dayIsToday && 'text-blue-600 dark:text-blue-400'
                                )}>
                                    {format(new Date(day.date), 'd')}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {format(new Date(day.date), 'MMM')}
                                </span>
                                {dayIsToday && (
                                    <span className="text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded-full font-semibold">
                                        TODAY
                                    </span>
                                )}
                            </div>
                            {(() => {
                                const meetingCount = new Set(day.slots.filter(s => s.booking).map(s => s.booking!.id)).size;
                                return meetingCount > 0 && (
                                    <span className="mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/30">
                                        {meetingCount} meetings
                                    </span>
                                );
                            })()}
                            {day.isBlocked && (
                                <span className="text-[10px] text-red-500 font-medium bg-red-500/10 px-2 py-0.5 rounded-full mt-1 inline-block">
                                    Blocked
                                </span>
                            )}
                        </div>
                    );
                })}

                {/* Time Slots */}
                {timeLabels.map((time, timeIndex) => {
                    const { main: displayTime, isHour } = formatTimeDisplay(time);
                    const hourStart = isHourStart(time);
                    return (
                        <div key={`time-group-${time}`} className="contents">
                            {/* Time Label (Sticky horizontally) */}
                            <div
                                className={cn(
                                    'pr-3 flex items-start justify-end sticky left-0 z-10 transition-colors border-r border-slate-200 dark:border-slate-700',
                                    hourStart
                                        ? 'text-xs font-bold text-slate-700 dark:text-slate-300 pt-1'
                                        : 'text-[10px] text-slate-400 dark:text-slate-500 pt-1'
                                )}
                            >
                                {isHour ? displayTime : <span className="opacity-75">{displayTime}</span>}
                            </div>

                            {/* Day cells */}
                            {calendar.map((day, dayIndex) => {
                                const slot = day.slots[timeIndex];
                                const dayIsToday = isToday(new Date(day.date));

                                return (
                                    <div
                                        key={`${day.date}-${time}`}
                                        className={cn(
                                            'relative group',
                                            hourStart ? 'grid-separator-h-strong' : 'grid-separator-h',
                                            'grid-separator-v',
                                            dayIsToday && 'bg-primary/5',
                                            slot ? SLOT_BG[slot.status as keyof typeof SLOT_BG] : 'bg-gray-500/5',
                                            focusedCell?.dayIndex === dayIndex && focusedCell?.timeIndex === timeIndex &&
                                            'ring-2 ring-inset ring-blue-500 z-10',                                            (new Date(day.date).getDay() === 0 || new Date(day.date).getDay() === 6) && 'bg-slate-100/80 dark:bg-slate-800/40 opacity-60 cursor-not-allowed'
                                        )}
                                        onClick={() => {
                                            const isWeekend = new Date(day.date).getDay() === 0 || new Date(day.date).getDay() === 6;
                                            if (!isWeekend) onSlotClick(day, timeIndex);
                                        }}
                                        title={
                                            slot?.status === 'available'
                                                ? canBook
                                                    ? 'Click to book (Enter)'
                                                    : 'You don\'t have permission to book meetings'
                                                : undefined
                                        }
                                        style={{
                                            cursor: (new Date(day.date).getDay() === 0 || new Date(day.date).getDay() === 6) || (slot?.status === 'available' && !canBook) ? 'not-allowed' : undefined
                                        }}
                                        role="gridcell"
                                        aria-selected={focusedCell?.dayIndex === dayIndex && focusedCell?.timeIndex === timeIndex}
                                    >
                                        {slot?.status === 'available' && canBook && (
                                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 border border-dashed border-blue-400/70 rounded-lg m-0.5 bg-blue-50/50 dark:bg-blue-950/30">
                                                <span className="text-xs font-medium text-blue-500 dark:text-blue-400 flex items-center gap-1">
                                                    <Plus className="h-3 w-3" /> Book {time}
                                                </span>
                                            </div>
                                        )}
                                        {slot?.status === 'available' && !canBook && (
                                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <span className="text-[9px] text-slate-400 font-medium">View only</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>

            {/* Overlay for bookings */}
            <div
                className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none"
                style={{
                    display: 'grid',
                    gridTemplateColumns: '95px repeat(5, 1fr)',
                    gridTemplateRows: `auto repeat(${timeLabels.length}, ${SLOT_HEIGHT}px)`,
                }}
            >
                <div className="col-span-6" style={{ height: 'auto' }} />

                {calendar.map((day, dayIndex) => {
                    const bookings = processBookingsForDay(day);

                    return bookings.map((booking) => (
                        <div
                            key={booking.id}
                            title={`${booking.title}\n${booking.startTime} - ${booking.endTime} (${booking.durationMinutes} min)\nBooked by: ${booking.bookedBy}\nKlik untuk lihat link Zoom`}
                            className={cn(
                                "absolute rounded-xl cursor-pointer select-none",
                                "transition-all duration-150 ease-out",
                                "hover:brightness-110 hover:shadow-lg hover:z-20 hover:-translate-y-px",
                                "ring-1 ring-black/10 overflow-hidden flex flex-col pointer-events-auto",
                                booking.isExternal
                                    ? "bg-slate-200/80 dark:bg-slate-700/80 border-l-[3px] border-l-slate-400 text-slate-700 dark:text-slate-300"
                                    : booking.isMyBooking
                                        ? "bg-gradient-to-br from-blue-500 to-blue-600 border-l-[3px] border-l-blue-300 text-white"
                                        : "bg-gradient-to-br from-amber-400 to-amber-500 border-l-[3px] border-l-amber-200 text-white"
                            )}
                            style={{
                                gridColumn: dayIndex + 2,
                                gridRow: `${booking.rowStart} / span ${booking.rowSpan}`,
                                margin: '2px 4px',
                                minWidth: 0,
                            }}
                            onClick={() => onBookingClick(booking)}
                        >
                            <div className={cn(
                                "h-full flex flex-col min-w-0 flex-1 overflow-hidden",
                                booking.rowSpan === 1 ? "p-1.5" : "p-2"
                            )}>
                                <div className="font-bold text-[11px] truncate flex items-center gap-1">
                                    <Video className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{booking.title}</span>
                                </div>
                                {booking.rowSpan >= 2 && (
                                    <div className="flex flex-col min-h-0 mt-0.5">
                                        <div className="text-[11px] font-medium opacity-90 truncate">
                                            {booking.startTime} - {booking.endTime}
                                        </div>
                                        <div className="text-[10px] opacity-75 truncate">
                                            {booking.bookedBy}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ));
                })}
            </div>

            {/* Current Time Indicator */}
            {getCurrentTimePosition && isToday(new Date()) && (
                <div
                    className="absolute left-[95px] right-0 z-30 pointer-events-none flex items-center"
                    style={{ top: `${getCurrentTimePosition.pixelOffset}px` }}
                >
                    <div className="w-3 h-3 -ml-1.5 rounded-full bg-red-500 shadow-lg shadow-red-500/50 animate-pulse" />
                    <div className="flex-1 h-0.5 bg-gradient-to-r from-red-500 to-red-400 shadow-sm" />
                    <div className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-l-md shadow-lg">
                        {format(currentTime, 'HH:mm')}
                    </div>
                </div>
            )}
        </div>
    );
}
