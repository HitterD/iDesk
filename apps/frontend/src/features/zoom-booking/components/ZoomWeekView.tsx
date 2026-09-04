import { useMemo, useState, useEffect, useRef, Fragment } from 'react';
import { format, isToday, startOfWeek, addDays, eachDayOfInterval } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
    SLOT_INTERVAL,
    SLOT_HEIGHT,
    processBookingsForDayV2,
} from './ZoomCalendarGrid';
import type { ProcessedBookingV2 } from './ZoomCalendarGrid';
import type { CalendarDay, ZoomAccount } from '../types';
import type { ProcessedBooking } from './ZoomCalendarGrid';
import { Plus, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    ZoomOverflowPopover,
    type OverflowBooking,
} from './ZoomOverflowPopover';
import { useZoomSettings, isWorkingDay } from '../hooks/useZoomSettings';

interface ZoomWeekViewProps {
    currentDate: Date;
    calendar: CalendarDay[];
    timeLabels: string[];
    currentTime: Date;
    canBook: boolean;
    accounts?: ZoomAccount[];
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

function getShortAccountName(name?: string): string {
    if (!name) return 'Zoom';
    const match = name.match(/Zoom\s+(?:Admin\s+)?(\d+)/i);
    if (match) return `Zoom ${match[1]}`;
    return name.length > 8 ? name.substring(0, 7) + '..' : name;
}

export function ZoomWeekView({
    currentDate,
    calendar,
    timeLabels,
    currentTime,
    canBook,
    accounts = [],
    onSlotClick,
    onBookingClick,
}: ZoomWeekViewProps) {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [filterOnlyMyBookings, setFilterOnlyMyBookings] = useState(false);
    const [filterAccountId, setFilterAccountId] = useState<string>('');

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

    const { data: zoomSettings } = useZoomSettings();
    const workingDays = zoomSettings?.workingDays ?? [1, 2, 3, 4, 5];

    // Compute weekly meeting metrics
    const { totalWeekMeetings, myWeekMeetingCount } = useMemo(() => {
        let total = 0;
        let myTotal = 0;
        const seen = new Set<string>();

        weekDays.forEach((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const calDay = calendarMap.get(dateStr);
            if (!calDay) return;

            const dayBookings = processBookingsForDayV2(calDay);
            dayBookings.forEach((b) => {
                if (!seen.has(b.id)) {
                    seen.add(b.id);
                    total++;
                    if (b.isMyBooking) myTotal++;
                }
            });
        });

        return { totalWeekMeetings: total, myWeekMeetingCount: myTotal };
    }, [weekDays, calendarMap]);

    // Auto-scroll to 08:00 or current time on load
    useEffect(() => {
        if (!scrollContainerRef.current) return;
        const targetIndex = timeLabels.findIndex((t) => t.startsWith('08:00'));
        if (targetIndex > 0) {
            scrollContainerRef.current.scrollTop = targetIndex * SLOT_HEIGHT - 20;
        }
    }, [timeLabels]);

    // Overflow popover state
    const [overflowState, setOverflowState] = useState<{
        anchor: HTMLElement | null;
        open: boolean;
        date: string | null;
        rowStart: number | null;
        bookings: OverflowBooking[];
    }>({ anchor: null, open: false, date: null, rowStart: null, bookings: [] });

    const openOverflow = (
        anchor: HTMLElement,
        date: string,
        rowStart: number,
        bookings: ProcessedBookingV2[],
    ) => {
        const bookingsForPopover: OverflowBooking[] = bookings.map((b) => ({
            id: b.id,
            title: b.title,
            startTime: b.startTime,
            endTime: b.endTime,
            accountId: (b as any).accountId ?? (b as any).zoomAccountId ?? '',
            accountName: b.accountName || 'Zoom',
            accountColorHex: b.accountColorHex,
            isMine: b.isMyBooking,
        }));
        setOverflowState({
            anchor,
            open: true,
            date,
            rowStart,
            bookings: bookingsForPopover,
        });
    };

    const HEADER_HEIGHT = 64;
    const TIME_COL_WIDTH = 64;
    const numCols = weekDays.length;

    return (
        <div className="flex flex-col h-full min-h-0 select-none bg-background">
            {/* Quick Filter Toolbar */}
            <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b border-border bg-card/60">
                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        size="sm"
                        variant={filterOnlyMyBookings ? 'default' : 'outline'}
                        onClick={() => setFilterOnlyMyBookings(!filterOnlyMyBookings)}
                        className={cn(
                            "h-7 px-2.5 text-xs font-bold rounded-lg gap-1.5 transition-all shadow-2xs cursor-pointer",
                            filterOnlyMyBookings
                                ? "bg-blue-600 text-white hover:bg-blue-700 ring-2 ring-blue-400/30"
                                : "text-muted-foreground hover:text-foreground border-border/80"
                        )}
                        title="Hanya tampilkan meeting milik Anda di kalender mingguan"
                    >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Hanya Meeting Saya</span>
                        {myWeekMeetingCount > 0 && (
                            <span className={cn(
                                "ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold",
                                filterOnlyMyBookings ? "bg-white/20 text-white" : "bg-primary/10 text-primary"
                            )}>
                                {myWeekMeetingCount}
                            </span>
                        )}
                    </Button>

                    {accounts.length > 1 && (
                        <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-muted-foreground hidden sm:inline">Filter Akun:</span>
                            <select
                                value={filterAccountId}
                                onChange={(e) => setFilterAccountId(e.target.value)}
                                className="h-7 px-2 text-xs font-semibold rounded-lg bg-background border border-border/80 text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer max-w-[160px] truncate"
                            >
                                <option value="">Semua Akun Zoom ({accounts.length})</option>
                                {accounts.map((acc) => (
                                    <option key={acc.id} value={acc.id}>
                                        {acc.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                    <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-primary" />
                        <strong className="text-foreground">{totalWeekMeetings}</strong> Meeting Minggu Ini
                    </span>
                    {filterOnlyMyBookings && (
                        <span className="text-blue-600 dark:text-blue-400 font-bold">
                            · ({myWeekMeetingCount} Milik Anda)
                        </span>
                    )}
                </div>
            </div>

            {/* Scrollable Week Grid */}
            <div
                ref={scrollContainerRef}
                data-testid="zoom-week-view"
                className="relative flex-1 min-h-0 overflow-y-auto overflow-x-auto custom-scrollbar select-none bg-background"
            >
                <div className="min-w-[1080px]">
                    {/* Day headers */}
                    <div
                        className="sticky top-0 z-20 grid border-b-2 border-border bg-card/95 backdrop-blur-xs shadow-2xs"
                        style={{ gridTemplateColumns: `${TIME_COL_WIDTH}px repeat(${numCols}, 1fr)` }}
                    >
                        {/* Time header label */}
                        <div
                            className="border-r-2 border-border/80 flex items-center justify-center text-[10px] font-mono text-muted-foreground font-bold tracking-wider"
                            style={{ height: HEADER_HEIGHT }}
                        >
                            WIB
                        </div>

                        {/* Day headers */}
                        {weekDays.map((day) => {
                            const dateStr = format(day, 'yyyy-MM-dd');
                            const today = isToday(day);
                            const isWeekend = !isWorkingDay(day, workingDays);

                            return (
                                <div
                                    key={dateStr}
                                    className={cn(
                                        "flex flex-col items-center justify-center py-2 border-r-2 border-border/80 transition-colors",
                                        today && "bg-blue-50/25 dark:bg-blue-950/20 border-b-2 border-b-primary",
                                        isWeekend && "bg-muted/40 opacity-75"
                                    )}
                                    style={{ height: HEADER_HEIGHT }}
                                >
                                    <span className={cn(
                                        "text-[11px] font-bold uppercase tracking-wider",
                                        today ? "text-primary" : "text-muted-foreground"
                                    )}>
                                        {format(day, 'EEE', { locale: idLocale })}
                                    </span>
                                    <span className={cn(
                                        "text-base font-extrabold inline-flex items-center justify-center w-7 h-7 rounded-full transition-all mt-0.5",
                                        today
                                            ? "bg-primary text-primary-foreground shadow-xs font-black"
                                            : "text-foreground"
                                    )}>
                                        {format(day, 'd')}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Time slots grid */}
                    <div
                        className="relative grid"
                        style={{ gridTemplateColumns: `${TIME_COL_WIDTH}px repeat(${numCols}, 1fr)` }}
                    >
                        {timeLabels.map((time, timeIndex) => {
                            const isHour = time.endsWith(':00');

                            return (
                                <div key={time} className="contents">
                                    {/* Time label column (sticky left) */}
                                    <div
                                        className={cn(
                                            "sticky left-0 z-10 flex items-start justify-end pr-2.5 border-r-2 border-border/80 bg-card/95",
                                            isHour
                                                ? "text-xs font-bold text-foreground pt-1 border-b border-border/80"
                                                : "text-[10px] font-mono text-muted-foreground/60 pt-1 border-b border-dashed border-border/40"
                                        )}
                                        style={{ height: SLOT_HEIGHT }}
                                    >
                                        {isHour ? time : <span className="opacity-50">{time}</span>}
                                    </div>

                                    {/* Day cells */}
                                    {weekDays.map((day) => {
                                        const dateStr = format(day, 'yyyy-MM-dd');
                                        const calDay = calendarMap.get(dateStr);
                                        const today = isToday(day);
                                        const isWeekend = !isWorkingDay(day, workingDays);

                                        return (
                                            <div
                                                key={`${dateStr}-${time}`}
                                                className={cn(
                                                    "border-r-2 border-border/70 relative group transition-colors",
                                                    isHour ? "border-b border-border/80" : "border-b border-dashed border-border/40",
                                                    today && "bg-blue-500/[0.02] dark:bg-blue-500/[0.04]",
                                                    isWeekend && "bg-muted/20 cursor-not-allowed",
                                                    !isWeekend && "cursor-pointer hover:bg-muted/30"
                                                )}
                                                style={{ height: SLOT_HEIGHT }}
                                                onClick={() => {
                                                    if (calDay && !isWeekend) onSlotClick(calDay, timeIndex);
                                                }}
                                            >
                                                {/* Hover prompt */}
                                                {canBook && !isWeekend && (
                                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 border border-dashed border-primary/40 rounded m-0.5 bg-primary/5 z-10 pointer-events-none">
                                                        <span className="text-[10px] font-semibold text-primary flex items-center gap-1">
                                                            <Plus className="h-3 w-3" /> {time}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}

                        {/* Booking Overlays — Smart Stacking (Max 2 cards side-by-side, no cramming) */}
                        {weekDays.map((day, colIdx) => {
                            const dateStr = format(day, 'yyyy-MM-dd');
                            const calDay = calendarMap.get(dateStr);
                            if (!calDay) return null;

                            const allDayBookings = processBookingsForDayV2(calDay);

                            // Apply local filters if enabled
                            const bookings = allDayBookings.filter((b) => {
                                if (filterOnlyMyBookings && !b.isMyBooking) return false;
                                if (filterAccountId) {
                                    const accId = (b as any).accountId ?? (b as any).zoomAccountId;
                                    if (accId && accId !== filterAccountId) return false;
                                }
                                return true;
                            });

                            if (bookings.length === 0) return null;

                            // Group overlapping bookings
                            const groups = new Map<number, ProcessedBookingV2[]>();
                            bookings.forEach((b) => {
                                const arr = groups.get(b.rowStart) ?? [];
                                arr.push(b);
                                groups.set(b.rowStart, arr);
                            });

                            const cells: React.ReactNode[] = [];
                            const MAX_SIDE_BY_SIDE = 2;

                            groups.forEach((group, rowStart) => {
                                // Sort: personal bookings first, then start time
                                const sorted = [...group].sort((a, b) => {
                                    if (a.isMyBooking !== b.isMyBooking) return a.isMyBooking ? -1 : 1;
                                    return a.startTime.localeCompare(b.startTime);
                                });

                                const visible = sorted.slice(0, MAX_SIDE_BY_SIDE);
                                const overflowCount = Math.max(0, sorted.length - MAX_SIDE_BY_SIDE);
                                const visibleLen = visible.length;

                                visible.forEach((booking, bookingIdx) => {
                                    const topPx = (rowStart - 2) * SLOT_HEIGHT + 2;
                                    const heightPx = Math.max(34, (booking.rowSpan * SLOT_HEIGHT) - 4);

                                    // Side-by-side percentage (max 2)
                                    const widthPercent = visibleLen === 1 ? 100 : 50;
                                    const leftPercent = bookingIdx * widthPercent;

                                    const cellLeft = `calc(${TIME_COL_WIDTH}px + ${colIdx} / ${numCols} * (100% - ${TIME_COL_WIDTH}px) + 2px + (${leftPercent}% / ${numCols}))`;
                                    const cellWidth = `calc(((100% - ${TIME_COL_WIDTH}px) / ${numCols} - 4px) * ${widthPercent / 100})`;

                                    const accountColor = booking.accountColorHex || '#3b82f6';
                                    const isCompact = heightPx < 55;

                                    cells.push(
                                        <div
                                            key={booking.id}
                                            className={cn(
                                                "absolute rounded-xl cursor-pointer select-none p-1.5 border shadow-xs transition-all overflow-hidden flex flex-col justify-between group/card",
                                                "hover:shadow-md hover:z-30 hover:scale-[1.01]",
                                                booking.isMyBooking && "ring-2 ring-blue-500/50"
                                            )}
                                            style={{
                                                top: topPx,
                                                left: cellLeft,
                                                width: cellWidth,
                                                height: heightPx,
                                                backgroundColor: `${accountColor}15`,
                                                borderColor: `${accountColor}40`,
                                                borderLeftWidth: '4px',
                                                borderLeftColor: accountColor,
                                            }}
                                            title={`${booking.title}\n${booking.startTime} – ${booking.endTime}\nAkun: ${booking.accountName}\nBooked by: ${booking.bookedBy}`}
                                            onClick={() =>
                                                onBookingClick({
                                                    id: booking.id,
                                                    title: booking.title,
                                                    bookedBy: booking.bookedBy,
                                                    startTime: booking.startTime,
                                                    endTime: booking.endTime,
                                                    durationMinutes: booking.durationMinutes,
                                                    rowStart: booking.rowStart,
                                                    rowSpan: booking.rowSpan,
                                                    isMyBooking: booking.isMyBooking,
                                                    isExternal: booking.isExternal,
                                                    columnIndex: bookingIdx,
                                                    totalColumns: visibleLen,
                                                } as ProcessedBooking)
                                            }
                                        >
                                            {/* Header: Account badge + Start Time */}
                                            <div className="flex items-center justify-between gap-1 min-w-0">
                                                <span
                                                    className="px-1.5 py-0.5 rounded text-[9px] font-extrabold text-white shrink-0 shadow-2xs leading-none"
                                                    style={{ backgroundColor: accountColor }}
                                                >
                                                    {getShortAccountName(booking.accountName)}
                                                </span>
                                                <span className="text-[10px] font-mono font-bold text-foreground/80 shrink-0">
                                                    {booking.startTime}
                                                </span>
                                            </div>

                                            {/* Meeting Title */}
                                            <div className="font-bold text-xs text-foreground truncate leading-tight mt-0.5">
                                                {booking.title}
                                            </div>

                                            {/* Footer: Host & End Time */}
                                            {!isCompact && (
                                                <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-auto pt-1 border-t border-border/30">
                                                    <span className="truncate font-medium">{booking.bookedBy}</span>
                                                    <span className="font-mono text-[9px]">{booking.endTime}</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                });

                                // Single elegant overflow indicator when more than 2 meetings exist at this slot
                                if (overflowCount > 0) {
                                    const pillTopPx = (rowStart - 2) * SLOT_HEIGHT + 36;
                                    const cellLeft = `calc(${TIME_COL_WIDTH}px + ${colIdx} / ${numCols} * (100% - ${TIME_COL_WIDTH}px) + 4px)`;
                                    const cellWidth = `calc((100% - ${TIME_COL_WIDTH}px) / ${numCols} - 8px)`;

                                    cells.push(
                                        <button
                                            type="button"
                                            key={`overflow-${dateStr}-${rowStart}`}
                                            data-testid="overflow-pill"
                                            className="absolute h-5 px-2 rounded-md bg-slate-900/90 dark:bg-slate-100 text-white dark:text-slate-900 text-[10px] font-bold flex items-center justify-center gap-1 hover:scale-105 z-30 cursor-pointer shadow-sm transition-transform"
                                            style={{ top: pillTopPx, left: cellLeft, width: cellWidth }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openOverflow(e.currentTarget, dateStr, rowStart, sorted);
                                            }}
                                            title={`Klik untuk melihat total ${sorted.length} meeting di jam ini`}
                                        >
                                            <span>+{overflowCount} meeting lagi</span>
                                        </button>
                                    );
                                }
                            });

                            return <Fragment key={dateStr}>{cells}</Fragment>;
                        })}

                        {/* Real-time current time indicator */}
                        {timeIndicatorOffset !== null && (
                            <div
                                className="absolute left-0 right-0 z-30 pointer-events-none flex items-center"
                                style={{ top: `${timeIndicatorOffset}px` }}
                            >
                                <div
                                    className="shrink-0 w-3 h-3 rounded-full bg-red-500 shadow-md shadow-red-500/50 animate-pulse"
                                    style={{ marginLeft: TIME_COL_WIDTH - 6 }}
                                />
                                <div className="flex-1 h-0.5 bg-red-500" />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Overflow popover */}
            <ZoomOverflowPopover
                open={overflowState.open}
                onClose={() => setOverflowState({ anchor: null, open: false, date: null, rowStart: null, bookings: [] })}
                onSelectBooking={(id) => {
                    setOverflowState({ anchor: null, open: false, date: null, rowStart: null, bookings: [] });
                    onBookingClick({ id } as ProcessedBooking);
                }}
                bookings={overflowState.bookings}
                date={overflowState.date ?? ''}
            />
        </div>
    );
}
