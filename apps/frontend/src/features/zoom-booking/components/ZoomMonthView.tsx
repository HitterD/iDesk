import { useEffect, useMemo, useRef, useState } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isToday } from 'date-fns';
import { cn } from '@/lib/utils';
import type { CalendarDay, CalendarSlot, ZoomAccount } from '../types';
import { ZoomMonthDayPopover } from './ZoomMonthDayPopover';
import { Plus } from 'lucide-react';
import { useZoomSettings, isWorkingDay } from '../hooks/useZoomSettings';
import { softBackground } from '../utils/accountColors';

const DAY_NAMES = [
    { full: 'Senin', short: 'Sen' },
    { full: 'Selasa', short: 'Sel' },
    { full: 'Rabu', short: 'Rab' },
    { full: 'Kamis', short: 'Kam' },
    { full: 'Jumat', short: 'Jum' },
    { full: 'Sabtu', short: 'Sab' },
    { full: 'Minggu', short: 'Min' },
];

interface ZoomMonthViewProps {
    currentDate: Date;
    calendar: CalendarDay[];
    accounts?: ZoomAccount[];
    /** Kept for API compatibility; each event is tinted with its account color. */
    isGabungan?: boolean;
    onSlotClick: (day: CalendarDay, slot: CalendarSlot) => void;
    onDateDoubleClick: (date: Date) => void;
    onBookingClick: (bookingId: string, day: CalendarDay) => void;
    canBook?: boolean;
}

/** Pixel heights used to decide how many events fit in a day cell. */
const DAY_HEADER_PX = 30;
const EVENT_ROW_PX = 22;
const CELL_PADDING_PX = 8;
const MIN_VISIBLE_EVENTS = 1;
const DEFAULT_VISIBLE_EVENTS = 2;
const FALLBACK_COLOR = '#8E8E93';

/** How many event rows fit in one grid cell, re-measured when the grid resizes. */
function useVisibleEventCount(rows: number) {
    const gridRef = useRef<HTMLDivElement>(null);
    const [count, setCount] = useState(DEFAULT_VISIBLE_EVENTS);

    useEffect(() => {
        const el = gridRef.current;
        if (!el || typeof ResizeObserver === 'undefined') return;
        const measure = () => {
            const cellHeight = el.clientHeight / rows;
            const available = cellHeight - DAY_HEADER_PX - CELL_PADDING_PX;
            // One row is reserved for the "+N lagi" line.
            const fit = Math.floor(available / EVENT_ROW_PX) - 1;
            setCount(Math.max(MIN_VISIBLE_EVENTS, fit));
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(el);
        return () => observer.disconnect();
    }, [rows]);

    return { gridRef, count };
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
    endTime?: string;
    joinUrl?: string;
    accountName?: string;
    accountColorHex: string;
}

function getDayEvents(day: CalendarDay | undefined, accountsMap: Map<string, ZoomAccount>): DayEvents[] {
    if (!day) return [];
    const events: DayEvents[] = [];
    const seenIds = new Set<string>();

    const extractBooking = (b: any, status: string, time: string) => {
        if (!b || !b.id || seenIds.has(b.id)) return;
        seenIds.add(b.id);
        const accountId = b.zoomAccountId || b.zoomAccount?.id;
        const account = accountId ? accountsMap.get(accountId) : undefined;
        const accountName = account?.name || b.zoomAccount?.name || b.accountName || 'Zoom';
        const accountColorHex = account?.colorHex || b.zoomAccount?.colorHex || b.accountColorHex || FALLBACK_COLOR;

        events.push({
            status,
            title: b.title,
            bookingId: b.id,
            startTime: b.startTime || time,
            endTime: b.endTime,
            joinUrl: b.joinUrl,
            accountName,
            accountColorHex,
        });
    };

    for (const slot of day.slots) {
        if (slot.booking) {
            extractBooking(slot.booking, slot.status, slot.time);
        }
        const extraBookings = (slot as any).extraBookings;
        if (Array.isArray(extraBookings)) {
            for (const extra of extraBookings) {
                extractBooking(extra, 'booked', slot.time);
            }
        }
    }

    // Sort by startTime
    return events.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
}

export function ZoomMonthView({
    currentDate,
    calendar,
    accounts = [],
    onSlotClick,
    onDateDoubleClick,
    onBookingClick,
    canBook = true,
}: ZoomMonthViewProps) {
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const days = useMemo(() => getDaysGrid(currentDate), [currentDate]);
    const { data: zoomSettings } = useZoomSettings();
    const workingDays = zoomSettings?.workingDays ?? [1, 2, 3, 4, 5];

    const accountsMap = useMemo(() => {
        const map = new Map<string, ZoomAccount>();
        for (const a of accounts) {
            map.set(a.id, a);
        }
        return map;
    }, [accounts]);

    const calendarMap = useMemo(() => {
        const map = new Map<string, CalendarDay>();
        for (const day of calendar) {
            map.set(day.date, day);
        }
        return map;
    }, [calendar]);

    const totalRows = days.length / 7;
    const { gridRef, count: visibleCount } = useVisibleEventCount(totalRows);

    // Selected day data for popup
    const selectedCalDay = selectedDate ? calendarMap.get(selectedDate) : undefined;
    const selectedEvents = selectedCalDay ? getDayEvents(selectedCalDay, accountsMap) : [];
    const selectedWeekend = selectedDate ? !isWorkingDay(new Date(selectedDate), workingDays) : false;

    return (
        <div className="flex flex-col h-full select-none bg-background relative">
            {/* Day headers */}
            <div className="grid grid-cols-7 shrink-0 border-b border-border/60">
                {DAY_NAMES.map((day, idx) => (
                    <div
                        key={day.full}
                        className={cn(
                            'px-2 py-2 text-right text-[11px] font-medium uppercase tracking-wide',
                            idx >= 5 ? 'text-muted-foreground/60' : 'text-muted-foreground',
                        )}
                    >
                        <span className="hidden sm:inline">{day.full}</span>
                        <span className="inline sm:hidden">{day.short}</span>
                    </div>
                ))}
            </div>

            {/* Day cells grid */}
            <div
                ref={gridRef}
                className="grid grid-cols-7 flex-1 min-h-0"
                style={{ gridTemplateRows: `repeat(${totalRows}, minmax(0, 1fr))` }}
            >
                {days.map((day) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const calDay = calendarMap.get(dateStr);
                    const inMonth = isSameMonth(day, currentDate);
                    const today = isToday(day);
                    const events = getDayEvents(calDay, accountsMap);
                    // "+N lagi" only replaces rows when at least two events would be hidden.
                    const fitsAll = events.length <= visibleCount + 1;
                    const visibleEvents = fitsAll ? events : events.slice(0, visibleCount);
                    const overflow = events.length - visibleEvents.length;
                    const isBlocked = calDay?.isBlocked ?? false;
                    const isWeekend = !isWorkingDay(day, workingDays);
                    const isSelected = selectedDate === dateStr;

                    return (
                        <div
                            key={dateStr}
                            className={cn(
                                'relative group flex flex-col min-h-0 overflow-hidden p-1',
                                'border-b border-r border-border/50 transition-colors duration-150',
                                !isWeekend && 'cursor-pointer hover:bg-muted/40',
                                isWeekend && 'bg-muted/30 cursor-not-allowed',
                                isBlocked && 'bg-destructive/5',
                                isSelected && 'bg-primary/5',
                            )}
                            onClick={() => {
                                if (isWeekend) return;
                                if (calDay && calDay.slots.length > 0) {
                                    onSlotClick(calDay, calDay.slots[0]);
                                }
                            }}
                            onDoubleClick={() => onDateDoubleClick(day)}
                        >
                            {/* Date number, right-aligned like Apple Calendar */}
                            <div className="flex h-[26px] shrink-0 items-center justify-between gap-1 px-1">
                                {isBlocked ? (
                                    <span className="text-[10px] font-medium text-destructive">Diblokir</span>
                                ) : <span />}
                                <span
                                    className={cn(
                                        'inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[13px] tabular-nums',
                                        today
                                            ? 'bg-primary text-primary-foreground font-semibold'
                                            : inMonth
                                                ? 'text-foreground font-medium'
                                                : 'text-muted-foreground/50',
                                    )}
                                >
                                    {format(day, 'd')}
                                </span>
                            </div>

                            {/* Events: soft block tinted with the account color */}
                            <div className="flex min-h-0 flex-col gap-0.5">
                                {visibleEvents.map((event, eventIdx) => (
                                    <button
                                        type="button"
                                        key={`${event.bookingId ?? eventIdx}`}
                                        className={cn(
                                            'flex h-5 w-full shrink-0 items-center gap-1.5 rounded-[5px] border-l-[3px] pl-1.5 pr-1 text-left text-[11.5px] leading-none',
                                            'transition-[filter] hover:brightness-95',
                                            !inMonth && 'opacity-50',
                                        )}
                                        style={{
                                            borderLeftColor: event.accountColorHex,
                                            backgroundColor: softBackground(event.accountColorHex),
                                        }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (event.bookingId && calDay) {
                                                onBookingClick(event.bookingId, calDay);
                                            }
                                        }}
                                        title={`${event.title} · ${(event.startTime || '').slice(0, 5)} · ${event.accountName || 'Zoom'}`}
                                    >
                                        <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                                            {event.title}
                                        </span>
                                        {event.startTime && (
                                            <span className="shrink-0 tabular-nums text-foreground/60">
                                                {event.startTime.slice(0, 5)}
                                            </span>
                                        )}
                                    </button>
                                ))}

                                {overflow > 0 && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedDate(dateStr);
                                        }}
                                        className="h-5 rounded-md px-1.5 text-left text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                    >
                                        {overflow} lagi
                                    </button>
                                )}
                            </div>

                            {/* Book hover prompt on empty days */}
                            {canBook && !isWeekend && !isBlocked && events.length === 0 && (
                                <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                                        <Plus className="h-3 w-3" /> Book
                                    </span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Root-Level Day Schedule Popover Modal (Never clipped by overflow-hidden) */}
            {selectedDate && (
                <ZoomMonthDayPopover
                    date={selectedDate}
                    events={selectedEvents}
                    onClose={() => setSelectedDate(null)}
                    onEventClick={(id) => {
                        if (selectedCalDay) onBookingClick(id, selectedCalDay);
                    }}
                    onNewBooking={canBook && !selectedWeekend && !selectedCalDay?.isBlocked && selectedCalDay?.slots?.length ? () => {
                        onSlotClick(selectedCalDay, selectedCalDay.slots[0]);
                    } : undefined}
                />
            )}
        </div>
    );
}
