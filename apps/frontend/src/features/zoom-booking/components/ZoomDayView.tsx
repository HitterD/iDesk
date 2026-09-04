import { useMemo, useState, useEffect, useRef } from 'react';
import { format, isToday } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Video, User, Plus, Calendar, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
    SLOT_INTERVAL,
    SLOT_HEIGHT,
    processBookingsForDayV2,
} from './ZoomCalendarGrid';
import type { ProcessedBookingV2 } from './ZoomCalendarGrid';
import type { CalendarDay, ZoomAccount } from '../types';
import type { ProcessedBooking } from './ZoomCalendarGrid';
import {
    ZoomOverflowPopover,
    type OverflowBooking,
} from './ZoomOverflowPopover';
import { useZoomSettings, isWorkingDay } from '../hooks/useZoomSettings';

const TIME_COL_WIDTH = 64;
const ACCOUNT_COL_MIN_WIDTH = 190;

export interface ZoomDayViewProps {
    currentDate: Date;
    calendar: CalendarDay[];
    timeLabels: string[];
    currentTime: Date;
    canBook: boolean;
    accounts?: ZoomAccount[];
    onSlotClick: (day: CalendarDay, slotIndex: number, accountId?: string) => void;
    onBookingClick: (booking: ProcessedBooking) => void;
    onNavigateDay: (delta: number) => void;
    forceSingleAccountMode?: boolean;
    forceSingleAccountName?: string;
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

function getShortAccountName(name?: string): string {
    if (!name) return 'Zoom';
    const match = name.match(/Zoom\s+(?:Admin\s+)?(\d+)/i);
    if (match) return `Zoom ${match[1]}`;
    return name.length > 12 ? name.substring(0, 11) + '..' : name;
}

function getBookingAccountId(b: ProcessedBookingV2): string {
    return (b as any).accountId || (b as any).zoomAccountId || (b as any).zoomAccount?.id || '';
}

export function ZoomDayView({
    currentDate,
    calendar,
    timeLabels,
    currentTime,
    canBook,
    accounts = [],
    onSlotClick,
    onBookingClick,
    onNavigateDay,
    forceSingleAccountMode = false,
    forceSingleAccountName,
}: ZoomDayViewProps) {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    const calDay = calendar.find((d) => d.date === dateStr);
    const today = isToday(currentDate);

    const { data: zoomSettings } = useZoomSettings();
    const workingDays = zoomSettings?.workingDays ?? [1, 2, 3, 4, 5];
    const isWeekend = !isWorkingDay(currentDate, workingDays);

    const isMultiAccountGrid = !forceSingleAccountMode && accounts.length > 1;

    const allBookings = useMemo(() => {
        if (!calDay) return [];
        return processBookingsForDayV2(calDay);
    }, [calDay]);

    // Per-account meeting counts for this day
    const accountDayCounts = useMemo(() => {
        const map = new Map<string, number>();
        accounts.forEach((acc) => map.set(acc.id, 0));
        allBookings.forEach((b) => {
            const accId = getBookingAccountId(b);
            if (accId && map.has(accId)) {
                map.set(accId, (map.get(accId) ?? 0) + 1);
            }
        });
        return map;
    }, [accounts, allBookings]);

    const timeIndicatorOffset = useMemo(
        () => getTimeOffset(timeLabels, currentTime),
        [timeLabels, currentTime]
    );

    // Auto-scroll to 08:00 on mount
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
        rowStart: number | null;
        bookings: OverflowBooking[];
    }>({ anchor: null, open: false, rowStart: null, bookings: [] });

    const openOverflow = (
        anchor: HTMLElement,
        rowStart: number,
        group: ProcessedBookingV2[],
    ) => {
        const bookingsForPopover: OverflowBooking[] = group.map((b) => ({
            id: b.id,
            title: b.title,
            startTime: b.startTime,
            endTime: b.endTime,
            accountId: getBookingAccountId(b),
            accountName: b.accountName || 'Zoom',
            accountColorHex: b.accountColorHex,
            isMine: b.isMyBooking,
        }));
        setOverflowState({ anchor, open: true, rowStart, bookings: bookingsForPopover });
    };

    const HEADER_HEIGHT = 56;
    const numAccountCols = accounts.length;

    return (
        <div className="flex flex-col h-full min-h-0 select-none bg-background">
            {/* Top Date Header & Navigation Bar */}
            <div className="sticky top-0 z-30 flex items-center justify-between px-4 py-2 border-b border-border bg-card/95 backdrop-blur-xs shrink-0 shadow-2xs">
                <div className="flex items-center gap-1.5">
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7 rounded-lg hover:bg-muted cursor-pointer"
                        onClick={() => onNavigateDay(-1)}
                        title="Hari sebelumnya"
                    >
                        <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7 rounded-lg hover:bg-muted cursor-pointer"
                        onClick={() => onNavigateDay(1)}
                        title="Hari berikutnya"
                    >
                        <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                    <div className="flex items-center gap-2 ml-2">
                        <span className={cn(
                            "text-sm font-extrabold capitalize",
                            today ? "text-primary" : "text-foreground"
                        )}>
                            {format(currentDate, 'EEEE, d MMMM yyyy', { locale: idLocale })}
                        </span>
                        {today && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                                Hari Ini
                            </span>
                        )}
                        {isWeekend && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                Akhir Pekan
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                    <span className="flex items-center gap-1.5 bg-muted/60 px-2.5 py-1 rounded-lg border border-border/80">
                        <Calendar className="w-3.5 h-3.5 text-primary" />
                        <strong className="text-foreground">{allBookings.length}</strong> Total Meeting Hari Ini
                    </span>
                    {isMultiAccountGrid && (
                        <span className="text-[11px] text-muted-foreground/80 hidden md:inline">
                            (Grid {accounts.length} Akun Zoom)
                        </span>
                    )}
                </div>
            </div>

            {/* Main Day Grid Container */}
            <div
                ref={scrollContainerRef}
                className="relative flex-1 min-h-0 overflow-y-auto overflow-x-auto custom-scrollbar bg-background"
            >
                {isMultiAccountGrid ? (
                    /* ============================================================
                       MULTI-ACCOUNT RESOURCE GRID (1 Column per Zoom Account)
                       ============================================================ */
                    <div style={{ minWidth: `${TIME_COL_WIDTH + numAccountCols * ACCOUNT_COL_MIN_WIDTH}px` }}>
                        {/* Sticky Account Headers */}
                        <div
                            className="sticky top-0 z-20 grid border-b-2 border-border bg-card/95 backdrop-blur-xs shadow-2xs"
                            style={{ gridTemplateColumns: `${TIME_COL_WIDTH}px repeat(${numAccountCols}, 1fr)` }}
                        >
                            {/* WIB Corner */}
                            <div
                                className="border-r-2 border-border/80 flex items-center justify-center text-[10px] font-mono text-muted-foreground font-bold tracking-wider"
                                style={{ height: HEADER_HEIGHT }}
                            >
                                WIB
                            </div>

                            {/* Account Column Headers */}
                            {accounts.map((acc) => {
                                const count = accountDayCounts.get(acc.id) ?? 0;
                                return (
                                    <div
                                        key={acc.id}
                                        className="flex items-center justify-between px-3 border-r-2 border-border/80 hover:bg-muted/30 transition-colors"
                                        style={{ height: HEADER_HEIGHT }}
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span
                                                className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs ring-2 ring-background"
                                                style={{ backgroundColor: acc.colorHex }}
                                            />
                                            <span className="text-xs font-bold text-foreground truncate" title={acc.name}>
                                                {acc.name}
                                            </span>
                                        </div>
                                        <span
                                            className={cn(
                                                "text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md shrink-0 transition-all",
                                                count > 0 ? "bg-primary/10 text-primary font-bold" : "text-muted-foreground/50"
                                            )}
                                        >
                                            {count} meeting
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Multi-Account Time Slots Grid */}
                        <div
                            className="relative grid"
                            style={{ gridTemplateColumns: `${TIME_COL_WIDTH}px repeat(${numAccountCols}, 1fr)` }}
                        >
                            {timeLabels.map((time, timeIndex) => {
                                const isHour = time.endsWith(':00');

                                return (
                                    <div key={time} className="contents">
                                        {/* Time Label (Sticky Left) */}
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

                                        {/* Cells for each Zoom Account */}
                                        {accounts.map((acc) => {
                                            return (
                                                <div
                                                    key={`${acc.id}-${time}`}
                                                    className={cn(
                                                        "border-r-2 border-border/70 relative group transition-colors",
                                                        isHour ? "border-b border-border/80" : "border-b border-dashed border-border/40",
                                                        isWeekend && "bg-muted/20 cursor-not-allowed",
                                                        !isWeekend && "cursor-pointer hover:bg-muted/30"
                                                    )}
                                                    style={{ height: SLOT_HEIGHT }}
                                                    onClick={() => {
                                                        if (calDay && !isWeekend) onSlotClick(calDay, timeIndex, acc.id);
                                                    }}
                                                >
                                                    {/* Hover prompt */}
                                                    {canBook && !isWeekend && (
                                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 border border-dashed border-primary/40 rounded m-0.5 bg-primary/5 z-10 pointer-events-none">
                                                            <span className="text-[10px] font-semibold text-primary flex items-center gap-1">
                                                                <Plus className="h-3 w-3" /> Book {time}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}

                            {/* Meeting Overlays per Account */}
                            {accounts.map((acc, colIdx) => {
                                const accBookings = allBookings.filter((b) => getBookingAccountId(b) === acc.id);
                                if (accBookings.length === 0) return null;

                                // Group overlapping within the same account
                                const groups = new Map<number, ProcessedBookingV2[]>();
                                accBookings.forEach((b) => {
                                    const arr = groups.get(b.rowStart) ?? [];
                                    arr.push(b);
                                    groups.set(b.rowStart, arr);
                                });

                                const cells: React.ReactNode[] = [];
                                groups.forEach((group, rowStart) => {
                                    const groupLen = group.length;

                                    group.forEach((booking, bookingIdx) => {
                                        const topPx = (rowStart - 2) * SLOT_HEIGHT + 2;
                                        const heightPx = Math.max(34, (booking.rowSpan * SLOT_HEIGHT) - 4);

                                        const colWidthPercent = 100 / groupLen;
                                        const colLeftPercent = bookingIdx * colWidthPercent;

                                        const cellLeft = `calc(${TIME_COL_WIDTH}px + ${colIdx} / ${numAccountCols} * (100% - ${TIME_COL_WIDTH}px) + 2px + (${colLeftPercent}% / ${numAccountCols}))`;
                                        const cellWidth = `calc(((100% - ${TIME_COL_WIDTH}px) / ${numAccountCols} - 4px) * ${colWidthPercent / 100})`;

                                        const accountColor = acc.colorHex || '#3b82f6';
                                        const isLarge = booking.rowSpan >= 2;

                                        cells.push(
                                            <div
                                                key={booking.id}
                                                className={cn(
                                                    "absolute rounded-xl cursor-pointer select-none p-2 border shadow-xs transition-all overflow-hidden flex flex-col justify-between group/card",
                                                    "hover:shadow-md hover:z-30 hover:scale-[1.01]",
                                                    booking.isMyBooking && "ring-2 ring-blue-500/60"
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
                                                title={`${booking.title}\n${booking.startTime} – ${booking.endTime}\nBooked by: ${booking.bookedBy}`}
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
                                                        totalColumns: groupLen,
                                                    } as ProcessedBooking)
                                                }
                                            >
                                                <div className="flex items-center justify-between gap-1 min-w-0">
                                                    <span className="font-bold text-xs text-foreground truncate">
                                                        {booking.title}
                                                    </span>
                                                    <span className="text-[10px] font-mono font-bold text-muted-foreground shrink-0">
                                                        {booking.startTime}
                                                    </span>
                                                </div>

                                                <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-auto pt-1 border-t border-border/30">
                                                    <span className="truncate font-medium">{booking.bookedBy}</span>
                                                    <span className="font-mono text-[9px]">{booking.endTime}</span>
                                                </div>
                                            </div>
                                        );
                                    });
                                });

                                return <div key={acc.id} className="contents">{cells}</div>;
                            })}

                            {/* Real-time Indicator */}
                            {today && timeIndicatorOffset !== null && (
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
                ) : (
                    /* ============================================================
                       SINGLE-ACCOUNT DAY VIEW
                       ============================================================ */
                    <div className="relative">
                        {forceSingleAccountName && (
                            <div className="sticky top-0 z-20 px-4 py-2 bg-muted/60 border-b border-border text-xs font-bold text-foreground flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                                <span>Akun: {forceSingleAccountName}</span>
                            </div>
                        )}

                        <div className="relative grid" style={{ gridTemplateColumns: `${TIME_COL_WIDTH}px 1fr` }}>
                            {timeLabels.map((time, timeIndex) => {
                                const isHour = time.endsWith(':00');
                                const slot = calDay?.slots[timeIndex];

                                return (
                                    <div key={time} className="contents">
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

                                        <div
                                            className={cn(
                                                "relative group transition-colors",
                                                isHour ? "border-b border-border/80" : "border-b border-dashed border-border/40",
                                                isWeekend && "bg-muted/20 cursor-not-allowed",
                                                !isWeekend && "cursor-pointer hover:bg-muted/30"
                                            )}
                                            style={{ height: SLOT_HEIGHT }}
                                            onClick={() => {
                                                if (calDay && !isWeekend) onSlotClick(calDay, timeIndex);
                                            }}
                                        >
                                            {slot?.status === 'available' && canBook && !isWeekend && (
                                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 border border-dashed border-primary/40 rounded m-0.5 bg-primary/5 z-10 pointer-events-none">
                                                    <span className="text-[11px] font-semibold text-primary flex items-center gap-1">
                                                        <Plus className="h-3 w-3" /> Book {time}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Overlays for single account */}
                            {(() => {
                                if (!calDay) return null;
                                const groups = new Map<number, ProcessedBookingV2[]>();
                                allBookings.forEach((b) => {
                                    const arr = groups.get(b.rowStart) ?? [];
                                    arr.push(b);
                                    groups.set(b.rowStart, arr);
                                });

                                const cells: React.ReactNode[] = [];
                                groups.forEach((group, rowStart) => {
                                    const groupLen = group.length;

                                    group.forEach((booking, bookingIdx) => {
                                        const topPx = (rowStart - 2) * SLOT_HEIGHT + 2;
                                        const heightPx = Math.max(36, (booking.rowSpan * SLOT_HEIGHT) - 4);

                                        const colWidthPercent = 100 / groupLen;
                                        const colLeftPercent = bookingIdx * colWidthPercent;

                                        const cellLeft = `calc(${TIME_COL_WIDTH}px + 4px + (${colLeftPercent}% * (100% - ${TIME_COL_WIDTH}px - 8px) / 100))`;
                                        const cellWidth = `calc((100% - ${TIME_COL_WIDTH}px - 8px) * ${colWidthPercent / 100} - 4px)`;

                                        const accountColor = booking.accountColorHex || '#3b82f6';
                                        const isLarge = booking.rowSpan >= 2;

                                        cells.push(
                                            <div
                                                key={booking.id}
                                                className={cn(
                                                    "absolute rounded-xl cursor-pointer select-none p-3 border shadow-xs transition-all overflow-hidden flex flex-col justify-between group/card",
                                                    "hover:shadow-md hover:z-30 hover:scale-[1.005]",
                                                    booking.isMyBooking && "ring-2 ring-blue-500/60"
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
                                                        totalColumns: groupLen,
                                                    } as ProcessedBooking)
                                                }
                                            >
                                                <div className="flex items-center justify-between gap-2 min-w-0">
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        <span
                                                            className="px-2 py-0.5 rounded text-[10px] font-extrabold text-white shrink-0 shadow-2xs leading-none"
                                                            style={{ backgroundColor: accountColor }}
                                                        >
                                                            {getShortAccountName(booking.accountName)}
                                                        </span>
                                                        <span className="font-bold text-xs text-foreground truncate">
                                                            {booking.title}
                                                        </span>
                                                    </div>
                                                    <span className="text-[11px] font-mono font-bold text-muted-foreground shrink-0">
                                                        {booking.startTime} – {booking.endTime}
                                                    </span>
                                                </div>

                                                {isLarge && (
                                                    <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-auto pt-2 border-t border-border/40">
                                                        <div className="flex items-center gap-1">
                                                            <User className="w-3.5 h-3.5 text-primary/70" />
                                                            <span className="font-medium">Booked by {booking.bookedBy}</span>
                                                        </div>
                                                        <span className="font-mono text-[10px]">{booking.durationMinutes} menit</span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    });
                                });

                                return cells;
                            })()}

                            {/* Current time indicator */}
                            {today && timeIndicatorOffset !== null && (
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
                )}
            </div>

            {/* Overflow Popover */}
            <ZoomOverflowPopover
                open={overflowState.open}
                onClose={() => setOverflowState({ anchor: null, open: false, rowStart: null, bookings: [] })}
                onSelectBooking={(id) => {
                    setOverflowState({ anchor: null, open: false, rowStart: null, bookings: [] });
                    onBookingClick({ id } as ProcessedBooking);
                }}
                bookings={overflowState.bookings}
                date={dateStr}
            />
        </div>
    );
}
