import { useMemo } from 'react';
import { format, isToday, startOfWeek, addDays, eachDayOfInterval } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { SLOT_INTERVAL, SLOT_HEIGHT, SLOT_BG, processBookingsForDay } from './ZoomCalendarGrid';
import type { CalendarDay } from '../types';
import type { ProcessedBooking } from './ZoomCalendarGrid';
import { Video } from 'lucide-react';

interface ZoomWeekViewProps {
    currentDate: Date;
    calendar: CalendarDay[];
    timeLabels: string[];
    currentTime: Date;
    canBook: boolean;
    onSlotClick: (day: CalendarDay, slotIndex: number) => void;
    onBookingClick: (booking: ProcessedBooking) => void;
}

function getCurrentTimeOffset(timeLabels: string[], currentTime: Date): number | null {
    if (!timeLabels.length) return null;

    const now = currentTime;
    const currentTotal = now.getHours() * 60 + now.getMinutes();
    const [startH, startM] = timeLabels[0].split(':').map(Number);
    const startTotal = startH * 60 + startM;
    const [endH, endM] = timeLabels[timeLabels.length - 1].split(':').map(Number);
    const endTotal = endH * 60 + endM + SLOT_INTERVAL;

    if (currentTotal < startTotal || currentTotal > endTotal) return null;

    const offset = currentTotal - startTotal;
    const totalRange = endTotal - startTotal;
    return (offset / totalRange) * timeLabels.length * SLOT_HEIGHT;
}

export function ZoomWeekView({
    currentDate,
    calendar,
    timeLabels,
    currentTime,
    canBook,
    onSlotClick,
    onBookingClick,
}: ZoomWeekViewProps) {
    const weekDays = useMemo(() => {
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        return eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });
    }, [currentDate]);

    const calendarMap = useMemo(() => {
        const map = new Map<string, CalendarDay>();
        for (const day of calendar) {
            map.set(day.date, day);
        }
        return map;
    }, [calendar]);

    const timeIndicatorOffset = useMemo(
        () => getCurrentTimeOffset(timeLabels, currentTime),
        [timeLabels, currentTime]
    );

    const HEADER_HEIGHT = 60;
    const TIME_COL_WIDTH = 64;
    const numCols = weekDays.length;

    return (
        <div className="relative min-w-[600px]">
            {/* Day headers */}
            <div
                className="sticky top-0 z-20 grid border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                style={{ gridTemplateColumns: `${TIME_COL_WIDTH}px repeat(${numCols}, 1fr)` }}
            >
                <div className="border-r border-slate-200 dark:border-slate-700" style={{ height: HEADER_HEIGHT }} />
                {weekDays.map((day) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const today = isToday(day);
                    const calDay = calendarMap.get(dateStr);
                    return (
                        <div
                            key={dateStr}
                            className={cn(
                                "flex flex-col items-center justify-center py-2 border-r border-slate-200 dark:border-slate-700",
                                today && "bg-gradient-to-b from-blue-50 to-blue-50/0 dark:from-blue-950/30 dark:to-blue-950/0 border-b-2 border-b-blue-500"
                            )}
                            style={{ height: HEADER_HEIGHT }}
                        >
                            <span className={cn(
                                "text-xs font-semibold capitalize",
                                today ? "text-blue-600 dark:text-blue-400" : "text-slate-500 dark:text-slate-400"
                            )}>
                                {format(day, 'EEEE', { locale: idLocale })}
                            </span>
                            <span className={cn(
                                "text-lg font-bold",
                                today ? "text-blue-600 dark:text-blue-400" : "text-slate-800 dark:text-slate-200"
                            )}>
                                {format(day, 'd')}
                            </span>
                            {(() => {
                                const meetingCount = calDay ? new Set(calDay.slots.filter(s => s.booking).map(s => s.booking!.id)).size : 0;
                                return meetingCount > 0 && (
                                    <span className="mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/30">
                                        {meetingCount} meetings
                                    </span>
                                );
                            })()}
                            {calDay?.isBlocked && (
                                <span className="text-[9px] text-red-500 font-medium bg-red-50 dark:bg-red-950/30 px-1 rounded">Blokir</span>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Time slots */}
            <div
                className="relative grid"
                style={{ gridTemplateColumns: `${TIME_COL_WIDTH}px repeat(${numCols}, 1fr)` }}
            >
                {timeLabels.map((time, timeIndex) => {
                    const isHour = time.endsWith(':00');
                    return (
                        <div key={time} className="contents">
                            {/* Time label */}
                            <div
                                className={cn(
                                    "sticky left-0 z-10 flex items-start justify-end pr-3 border-r border-slate-200 dark:border-slate-700",
                                    isHour
                                        ? "text-xs font-bold text-slate-700 dark:text-slate-300 pt-1"
                                        : "text-[10px] text-slate-400 dark:text-slate-500 pt-1"
                                )}
                                style={{ height: SLOT_HEIGHT }}
                            >
                                {isHour ? time : <span className="opacity-75">{time}</span>}
                            </div>

                            {/* Day cells */}
                            {weekDays.map((day) => {
                                const dateStr = format(day, 'yyyy-MM-dd');
                                const calDay = calendarMap.get(dateStr);
                                const slot = calDay?.slots[timeIndex];
                                const today = isToday(day);

                                return (
                                    <div
                                        key={`${dateStr}-${time}`}
                                        className={cn(
                                            "border-b border-r border-slate-200 dark:border-slate-700 relative group",
                                            isHour && "border-b-slate-300 dark:border-b-slate-600",
                                            today && "bg-blue-50/30 dark:bg-blue-950/10",
                                            slot ? SLOT_BG[slot.status as keyof typeof SLOT_BG] : "bg-slate-50/50 dark:bg-slate-800/20",
                                            (day.getDay() === 0 || day.getDay() === 6) && 'bg-slate-100/80 dark:bg-slate-800/40 opacity-60 cursor-not-allowed'
                                        )}
                                        style={{ height: SLOT_HEIGHT }}
                                        onClick={() => {
                                            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                                            if (calDay && !isWeekend) onSlotClick(calDay, timeIndex);
                                        }}
                                    >
                                        {slot?.status === 'available' && canBook && (
                                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 border border-dashed border-blue-400/70 rounded-lg m-0.5 bg-blue-50/50 dark:bg-blue-950/30 z-10 pointer-events-none">
                                                <span className="text-[10px] font-medium text-blue-500 dark:text-blue-400 flex items-center gap-1">
                                                    <Video className="h-3 w-3" /> Book {time}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}

                {/* Booking overlays */}
                {weekDays.map((day, colIdx) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const calDay = calendarMap.get(dateStr);
                    if (!calDay) return null;

                    const bookings = processBookingsForDay(calDay);
                    return bookings.map((booking) => {
                        const topPx = (booking.rowStart - 2) * SLOT_HEIGHT;
                        const heightPx = booking.rowSpan * SLOT_HEIGHT - 4;

                        return (
                            <div
                                key={booking.id}
                                className={cn(
                                    "absolute rounded-xl cursor-pointer select-none",
                                    "transition-all duration-150 ease-out",
                                    "hover:brightness-110 hover:shadow-lg hover:z-20 hover:-translate-y-px",
                                    "ring-1 ring-black/10 overflow-hidden flex flex-col",
                                    booking.isExternal
                                        ? "bg-slate-200/80 dark:bg-slate-700/80 border-l-[3px] border-l-slate-400 text-slate-700 dark:text-slate-300"
                                        : booking.isMyBooking
                                            ? "bg-gradient-to-br from-blue-500 to-blue-600 border-l-[3px] border-l-blue-300 text-white"
                                            : "bg-gradient-to-br from-amber-400 to-amber-500 border-l-[3px] border-l-amber-200 text-white"
                                )}
                                style={{
                                    top: topPx + 2,
                                    height: heightPx,
                                    left: `calc(${TIME_COL_WIDTH}px + ${colIdx} / ${numCols} * (100% - ${TIME_COL_WIDTH}px) + ${booking.columnIndex} / ${booking.totalColumns} * (100% - ${TIME_COL_WIDTH}px) / ${numCols} + 4px)`,
                                    width: `calc((100% - ${TIME_COL_WIDTH}px) / ${numCols} / ${booking.totalColumns} - 8px)`,
                                }}
                                onClick={() => onBookingClick(booking)}
                            >
                                <div className="p-1.5 flex flex-col min-h-0">
                                    <div className="text-[11px] font-bold truncate flex items-center gap-1">
                                        <Video className="h-3 w-3 shrink-0" />
                                        <span className="truncate">{booking.title}</span>
                                    </div>
                                    {booking.rowSpan >= 2 && (
                                        <div className="flex flex-col min-h-0 mt-0.5">
                                            <div className="text-[11px] opacity-80 truncate">
                                                {booking.startTime} – {booking.endTime}
                                            </div>
                                            <div className="text-[10px] opacity-70 truncate mt-0.5">
                                                {booking.bookedBy}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    });
                })}

                {/* Current time indicator */}
                {timeIndicatorOffset !== null && (
                    <div
                        className="absolute left-0 right-0 z-30 pointer-events-none flex items-center"
                        style={{ top: `${timeIndicatorOffset}px` }}
                    >
                        <div
                            className="shrink-0 w-3 h-3 rounded-full bg-red-500 shadow-lg shadow-red-500/50 animate-pulse"
                            style={{ marginLeft: TIME_COL_WIDTH - 6 }}
                        />
                        <div className="flex-1 h-0.5 bg-red-500" />
                    </div>
                )}
            </div>
        </div>
    );
}
