import { useMemo } from 'react';
import { format, isToday, addDays } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Video, User, Clock, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SLOT_INTERVAL, SLOT_HEIGHT, SLOT_BG, processBookingsForDay } from './ZoomCalendarGrid';
import type { CalendarDay } from '../types';
import type { ProcessedBooking } from './ZoomCalendarGrid';

const TIME_COL_WIDTH = 64;

interface ZoomDayViewProps {
    currentDate: Date;
    calendar: CalendarDay[];
    timeLabels: string[];
    currentTime: Date;
    canBook: boolean;
    onSlotClick: (day: CalendarDay, slotIndex: number) => void;
    onBookingClick: (booking: ProcessedBooking) => void;
    onNavigateDay: (delta: number) => void;
}

function getTimeOffset(timeLabels: string[], currentTime: Date): number | null {
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

export function ZoomDayView({
    currentDate,
    calendar,
    timeLabels,
    currentTime,
    canBook,
    onSlotClick,
    onBookingClick,
    onNavigateDay,
}: ZoomDayViewProps) {
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    const calDay = calendar.find((d) => d.date === dateStr);
    const today = isToday(currentDate);

    const bookings = useMemo(() => {
        if (!calDay) return [];
        return processBookingsForDay(calDay);
    }, [calDay]);

    const timeIndicatorOffset = useMemo(
        () => getTimeOffset(timeLabels, currentTime),
        [timeLabels, currentTime]
    );

    return (
        <div className="flex flex-col h-full min-h-0">
            {/* Mini header with prev/next */}
            <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onNavigateDay(-1)}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>

                <div className="flex flex-col items-center">
                    <span className="text-xs font-semibold capitalize text-slate-500 dark:text-slate-400">
                        {format(currentDate, 'EEEE', { locale: idLocale })}
                    </span>
                    <span className={cn(
                        "text-2xl font-bold",
                        today ? "text-blue-600 dark:text-blue-400" : "text-slate-800 dark:text-slate-200"
                    )}>
                        {format(currentDate, 'd')}
                    </span>
                    {calDay?.isBlocked && (
                        <span className="text-xs text-red-500 font-medium">Tanggal Diblokir</span>
                    )}
                </div>

                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onNavigateDay(1)}>
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>

            {/* Time grid */}
            <div className="relative flex-1 overflow-auto custom-scrollbar">
                <div
                    className="relative grid"
                    style={{ gridTemplateColumns: `${TIME_COL_WIDTH}px 1fr` }}
                >
                    {timeLabels.map((time, timeIndex) => {
                        const isHour = time.endsWith(':00');
                        const slot = calDay?.slots[timeIndex];

                        return (
                            <div key={time} className="contents">
                                {/* Time label */}
                                <div
                                    className={cn(
                                        "sticky left-0 z-10 flex items-center justify-end pr-2 text-[11px] border-r border-slate-200 dark:border-slate-700",
                                        isHour
                                            ? "bg-slate-100 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300 border-b border-b-slate-300 dark:border-b-slate-600"
                                            : "bg-slate-50 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-700"
                                    )}
                                    style={{ height: SLOT_HEIGHT }}
                                >
                                    {isHour ? time : <span className="opacity-70">{time}</span>}
                                </div>

                                {/* Slot cell */}
                                <div
                                    className={cn(
                                        "border-b border-slate-200 dark:border-slate-700",
                                        isHour && "border-b-slate-300 dark:border-b-slate-600",
                                        slot ? SLOT_BG[slot.status as keyof typeof SLOT_BG] : "bg-white dark:bg-slate-900"
                                    )}
                                    style={{ height: SLOT_HEIGHT }}
                                    onClick={() => calDay && onSlotClick(calDay, timeIndex)}
                                />
                            </div>
                        );
                    })}

                    {/* Booking overlays */}
                    {bookings.map((booking) => {
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
                                    left: `calc(${TIME_COL_WIDTH}px + ${booking.columnIndex} / ${booking.totalColumns} * (100% - ${TIME_COL_WIDTH}px) + 4px)`,
                                    width: `calc((100% - ${TIME_COL_WIDTH}px) / ${booking.totalColumns} - 8px)`,
                                }}
                                onClick={() => onBookingClick(booking)}
                            >
                                <div className="p-3 flex flex-col gap-1 h-full">
                                    <div className="flex items-center gap-2 font-bold text-sm">
                                        <Video className="h-4 w-4 shrink-0" />
                                        <span className="truncate">{booking.title}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs opacity-80">
                                        <Clock className="h-3.5 w-3.5 shrink-0" />
                                        <span>{booking.startTime} – {booking.endTime} ({booking.durationMinutes} menit)</span>
                                    </div>
                                    {booking.rowSpan >= 3 && (
                                        <div className="flex items-center gap-1.5 text-xs opacity-80">
                                            <User className="h-3.5 w-3.5 shrink-0" />
                                            <span>{booking.bookedBy}</span>
                                        </div>
                                    )}
                                    {booking.isMyBooking && booking.rowSpan >= 4 && (
                                        <div className="mt-auto">
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                className="h-7 text-xs gap-1.5 bg-white/20 hover:bg-white/30 text-white border-white/30"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onBookingClick(booking);
                                                }}
                                            >
                                                <ExternalLink className="h-3 w-3" />
                                                Lihat Detail
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {/* Current time indicator */}
                    {timeIndicatorOffset !== null && today && (
                        <div
                            className="absolute left-0 right-0 z-30 pointer-events-none flex items-center"
                            style={{ top: `${timeIndicatorOffset}px` }}
                        >
                            <div
                                className="shrink-0 w-3 h-3 rounded-full bg-red-500 shadow-lg shadow-red-500/50 animate-pulse"
                                style={{ marginLeft: TIME_COL_WIDTH - 6 }}
                            />
                            <div className="flex-1 h-0.5 bg-red-500" />
                            <div className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-l-md">
                                {format(currentTime, 'HH:mm')}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
