import { useMemo, useState } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isToday } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { CalendarDay, CalendarSlot } from '../types';
import { ZoomMonthDayPopover } from './ZoomMonthDayPopover';

const DAY_NAMES = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

const PILL_BG: Record<string, string> = {
    available:  'bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400',
    booked:     'bg-gradient-to-r from-amber-400 to-amber-500 text-white shadow-sm shadow-amber-200',
    my_booking: 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-sm shadow-blue-200',
    blocked:    'bg-gradient-to-r from-red-400 to-red-500 text-white shadow-sm',
    external:   'bg-slate-300 dark:bg-slate-600 text-slate-700 dark:text-slate-300',
};

interface ZoomMonthViewProps {
    currentDate: Date;
    calendar: CalendarDay[];
    onSlotClick: (day: CalendarDay, slot: CalendarSlot) => void;
    onDateDoubleClick: (date: Date) => void;
    onBookingClick: (bookingId: string, day: CalendarDay) => void;
}

function getDaysGrid(currentDate: Date): Date[] {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
}

interface DayEvents {
    status: string;
    title: string;
    bookingId?: string;
    startTime?: string;
    joinUrl?: string;
}

function getDayEvents(day: CalendarDay | undefined): DayEvents[] {
    if (!day) return [];
    const events: DayEvents[] = [];
    const seenIds = new Set<string>();

    for (const slot of day.slots) {
        if (slot.booking && !seenIds.has(slot.booking.id)) {
            seenIds.add(slot.booking.id);
            events.push({
                status: slot.status,
                title: slot.booking.title,
                bookingId: slot.booking.id,
                startTime: slot.booking.startTime || slot.time,
                joinUrl: slot.booking.joinUrl,
            });
        }
    }
    return events;
}

export function ZoomMonthView({
    currentDate,
    calendar,
    onSlotClick,
    onDateDoubleClick,
    onBookingClick,
}: ZoomMonthViewProps) {
    const [popoverDate, setPopoverDate] = useState<string | null>(null);
    const days = useMemo(() => getDaysGrid(currentDate), [currentDate]);

    const calendarMap = useMemo(() => {
        const map = new Map<string, CalendarDay>();
        for (const day of calendar) {
            map.set(day.date, day);
        }
        return map;
    }, [calendar]);

    return (
        <div className="flex flex-col h-full select-none">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700 shrink-0">
                {DAY_NAMES.map((name) => (
                    <div
                        key={name}
                        className="py-2 text-center text-xs font-semibold text-slate-500 dark:text-slate-400"
                    >
                        {name}
                    </div>
                ))}
            </div>

            {/* Day cells grid */}
            <div
                className="grid grid-cols-7 flex-1 min-h-0"
                style={{ gridTemplateRows: `repeat(${days.length / 7}, minmax(0, 1fr))` }}
            >
                {days.map((day) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const calDay = calendarMap.get(dateStr);
                    const inMonth = isSameMonth(day, currentDate);
                    const today = isToday(day);
                    const events = getDayEvents(calDay);
                    const visibleEvents = events.slice(0, 3);
                    const overflow = events.length - visibleEvents.length;
                    const isBlocked = calDay?.isBlocked ?? false;

                    return (
                        <div
                            key={dateStr}
                            className={cn(
                                "min-h-[80px] p-1 border-b border-r border-slate-200 dark:border-slate-700",
                                "cursor-pointer transition-colors duration-100 relative",
                                inMonth
                                    ? "bg-white dark:bg-slate-900 hover:bg-slate-50/80 dark:hover:bg-slate-800/60 hover:shadow-inner"
                                    : "bg-slate-50/40 dark:bg-slate-800/20",
                                today && "bg-blue-50/60 dark:bg-blue-950/20",
                                isBlocked && "bg-red-50/40 dark:bg-red-950/20"
                            )}
                            onClick={() => {
                                if (calDay && calDay.slots.length > 0) {
                                    onSlotClick(calDay, calDay.slots[0]);
                                }
                            }}
                            onDoubleClick={() => onDateDoubleClick(day)}
                        >
                            {/* Day number */}
                            <div className="flex items-center justify-between mb-1 px-0.5">
                                <span className={cn(
                                    "text-xs font-semibold inline-flex items-center justify-center w-6 h-6 rounded-full",
                                    today
                                        ? "bg-blue-600 text-white"
                                        : inMonth
                                            ? "text-slate-800 dark:text-slate-200"
                                            : "text-slate-400 dark:text-slate-600"
                                )}>
                                    {format(day, 'd')}
                                </span>
                                {isBlocked && (
                                    <span className="text-[9px] text-red-500 font-medium">Blokir</span>
                                )}
                            </div>

                            {/* Events */}
                            <div className="space-y-0.5 px-0.5">
                                {visibleEvents.map((event, idx) => (
                                    <div
                                        key={`${event.bookingId ?? idx}`}
                                        className={cn(
                                            "text-[10px] px-1.5 py-0.5 rounded-md truncate font-medium cursor-pointer animate-[pillSlideIn_0.3s_ease-out_forwards] opacity-0",
                                            PILL_BG[event.status] ?? PILL_BG.available
                                        )}
                                        style={{ animationDelay: `${idx * 50}ms` }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (event.bookingId && calDay) {
                                                onBookingClick(event.bookingId, calDay);
                                            }
                                        }}
                                    >
                                        {event.title}
                                    </div>
                                ))}
                                {overflow > 0 && (
                                    <div className="relative mt-1">
                                        <button
                                            className="text-[10px] text-blue-600 dark:text-blue-400 px-1 font-semibold hover:underline w-full text-left"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setPopoverDate(popoverDate === dateStr ? null : dateStr);
                                            }}
                                        >
                                            +{overflow} lainnya
                                        </button>
                                        {popoverDate === dateStr && (
                                            <ZoomMonthDayPopover
                                                date={dateStr}
                                                events={events.map((ev) => ({
                                                    bookingId: ev.bookingId ?? '',
                                                    status: ev.status,
                                                    title: ev.title,
                                                    startTime: ev.startTime,
                                                    joinUrl: ev.joinUrl,
                                                }))}
                                                onClose={() => setPopoverDate(null)}
                                                onEventClick={(id) => {
                                                    if (calDay) onBookingClick(id, calDay);
                                                }}
                                                anchorRef={{ current: null } as any}
                                            />
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
