import { useMemo, useState, Fragment } from 'react';
import { format, isToday, addDays } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Video, User, Clock, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
    SLOT_INTERVAL,
    SLOT_HEIGHT,
    SLOT_BG,
    processBookingsForDayV2,
    MAX_VISIBLE_ROWS,
} from './ZoomCalendarGrid';
import type { ProcessedBookingV2 } from './ZoomCalendarGrid';
import type { CalendarDay } from '../types';
import type { ProcessedBooking } from './ZoomCalendarGrid';
import {
    ZoomOverflowPopover,
    type OverflowBooking,
} from './ZoomOverflowPopover';
import { useZoomSettings, isWorkingDay } from '../hooks/useZoomSettings';

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
    /** When true, day view is rendering in single-account fallback mode because
     *  the user was in Gabungan mode. The banner explains this and shows which
     *  account was auto-picked. */
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

export function ZoomDayView({
    currentDate,
    calendar,
    timeLabels,
    currentTime,
    canBook,
    onSlotClick,
    onBookingClick,
    onNavigateDay,
    forceSingleAccountMode = false,
    forceSingleAccountName,
}: ZoomDayViewProps) {
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    const calDay = calendar.find((d) => d.date === dateStr);
    const today = isToday(currentDate);

    const { data: zoomSettings } = useZoomSettings();
    const workingDays = zoomSettings?.workingDays ?? [1, 2, 3, 4, 5];

    const bookings = useMemo(() => {
        if (!calDay) return [];
        return processBookingsForDayV2(calDay);
    }, [calDay]);

    const timeIndicatorOffset = useMemo(
        () => getTimeOffset(timeLabels, currentTime),
        [timeLabels, currentTime]
    );

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
            accountId: (b as any).accountId ?? '',
            accountName: (b as any).accountName ?? '',
            accountColorHex: b.accountColorHex,
            isMine: b.isMyBooking,
        }));
        setOverflowState({ anchor, open: true, rowStart, bookings: bookingsForPopover });
    };

    return (
        <div className="flex flex-col h-full min-h-0">
            {forceSingleAccountMode && (
                <div
                    data-testid="zoom-day-view-force-single-banner"
                    className="sticky top-0 z-30 flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 text-xs font-medium text-amber-800 dark:text-amber-200"
                >
                    <span className="inline-block w-2 h-2 rounded-full bg-amber-500" aria-hidden="true" />
                    Day view menampilkan 1 akun{forceSingleAccountName ? `: ${forceSingleAccountName}` : ''}. Untuk lihat semua akun, gunakan Week atau Month view.
                </div>
            )}
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
                                        "sticky left-0 z-10 flex items-start justify-end pr-3 border-r border-slate-200 dark:border-slate-700",
                                        isHour
                                            ? "text-xs font-bold text-slate-700 dark:text-slate-300 pt-1"
                                            : "text-[10px] text-slate-400 dark:text-slate-500 pt-1"
                                    )}
                                    style={{ height: SLOT_HEIGHT }}
                                >
                                    {isHour ? time : <span className="opacity-75">{time}</span>}
                                </div>

                                {/* Slot cell */}
                                <div
                                    className={cn(
                                        "border-b border-slate-200 dark:border-slate-700 relative group",
                                        isHour && "border-b-slate-300 dark:border-b-slate-600",
                                        slot ? SLOT_BG[slot.status as keyof typeof SLOT_BG] : "bg-white dark:bg-slate-900",
                                        !isWorkingDay(currentDate, workingDays) && 'bg-slate-100/80 dark:bg-slate-800/40 opacity-60 cursor-not-allowed'
                                    )}
                                    style={{ height: SLOT_HEIGHT }}
                                    onClick={() => {
                                        const isWeekend = !isWorkingDay(currentDate, workingDays);
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
                            </div>
                        );
                    })}

                    {/* Booking overlays — V2 vertical stack with overflow popover */}
                    {(() => {
                        if (!calDay) return null;
                        // Group by rowStart (time slot)
                        const groups = new Map<number, ProcessedBookingV2[]>();
                        bookings.forEach((b) => {
                            const arr = groups.get(b.rowStart) ?? [];
                            arr.push(b);
                            groups.set(b.rowStart, arr);
                        });

                        const cells: React.ReactNode[] = [];
                        groups.forEach((group, rowStart) => {
                            const visible = group
                                .filter((b) => b.rowIndex < b.totalRows)
                                .sort((a, b) => a.rowIndex - b.rowIndex);
                            const overflowCount = group[0]?.overflowCount ?? 0;

                            visible.forEach((booking) => {
                                // Day view: each row gets a tall card (room for details)
                                const isLarge = booking.rowSpan >= 4;
                                const topPx = (rowStart - 2) * SLOT_HEIGHT + 2;
                                const heightPx = Math.max(
                                    isLarge ? 88 : 36,
                                    booking.rowSpan * SLOT_HEIGHT - 4,
                                );
                                const rowHeight = isLarge ? 88 : 36;
                                const rowTop =
                                    (rowStart - 2) * SLOT_HEIGHT + 2 + booking.rowIndex * (rowHeight + 4);

                                cells.push(
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
                                            top: isLarge ? topPx : rowTop,
                                            height: heightPx,
                                            left: `calc(${TIME_COL_WIDTH}px + 4px)`,
                                            width: `calc(100% - ${TIME_COL_WIDTH}px - 8px)`,
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
                                                columnIndex: 0,
                                                totalColumns: 1,
                                            } as ProcessedBooking)
                                        }
                                    >
                                        <div className="p-2 flex flex-col gap-1 h-full">
                                            <div className="flex items-center gap-2 font-bold text-xs">
                                                <Video className="h-3 w-3 shrink-0" />
                                                <span
                                                    className="w-1.5 h-1.5 rounded-full bg-white/90 ring-1 ring-black/20 shrink-0"
                                                    aria-hidden="true"
                                                />
                                                <span className="opacity-95 font-semibold truncate">
                                                    {booking.accountName}
                                                </span>
                                                <span className="truncate">{booking.title}</span>
                                            </div>
                                            {(isLarge || booking.rowSpan >= 2) && (
                                                <div className="flex items-center gap-1 text-[10px] opacity-90">
                                                    <Clock className="h-3 w-3 shrink-0" />
                                                    <span>{booking.startTime} – {booking.endTime}</span>
                                                </div>
                                            )}
                                            {isLarge && (
                                                <div className="flex items-center gap-1 text-[10px] opacity-80">
                                                    <User className="h-3 w-3 shrink-0" />
                                                    <span className="truncate">{booking.bookedBy}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>,
                                );
                            });

                            // Overflow pill at bottom of stack when count > visible
                            if (overflowCount > 0) {
                                const pillTop =
                                    (rowStart - 2) * SLOT_HEIGHT + 2 + MAX_VISIBLE_ROWS * 40;
                                cells.push(
                                    <button
                                        type="button"
                                        key={`overflow-${rowStart}`}
                                        data-testid="overflow-pill"
                                        className="absolute h-5 rounded-md bg-slate-800 text-white text-[10px] font-semibold flex items-center justify-center hover:bg-slate-900 z-20"
                                        style={{
                                            top: pillTop,
                                            left: `calc(${TIME_COL_WIDTH}px + 4px)`,
                                            width: `calc(100% - ${TIME_COL_WIDTH}px - 8px)`,
                                        }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            openOverflow(e.currentTarget, rowStart, group);
                                        }}
                                    >
                                        +{overflowCount} lainnya
                                    </button>,
                                );
                            }
                        });

                        return <Fragment>{cells}</Fragment>;
                    })()}

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

            {/* Overflow popover */}
            <ZoomOverflowPopover
                open={overflowState.open}
                onClose={() =>
                    setOverflowState({ anchor: null, open: false, rowStart: null, bookings: [] })
                }
                onSelectBooking={(id) => {
                    const found = overflowState.bookings.find((b) => b.id === id);
                    if (found) {
                        onBookingClick({
                            id: found.id,
                            title: found.title,
                            bookedBy: found.accountName,
                            startTime: found.startTime,
                            endTime: found.endTime,
                            durationMinutes: 60,
                            rowStart: 0,
                            rowSpan: 1,
                            isMyBooking: found.isMine,
                            isExternal: false,
                            columnIndex: 0,
                            totalColumns: 1,
                        } as ProcessedBooking);
                    }
                    setOverflowState({ anchor: null, open: false, rowStart: null, bookings: [] });
                }}
                onBookSlot={() => {
                    if (overflowState.rowStart !== null && calDay) {
                        onSlotClick(calDay, overflowState.rowStart - 2);
                    }
                    setOverflowState({ anchor: null, open: false, rowStart: null, bookings: [] });
                }}
                bookings={overflowState.bookings}
                timeRange={
                    overflowState.bookings[0]
                        ? `${overflowState.bookings[0].startTime} – ${overflowState.bookings[0].endTime}`
                        : ''
                }
                date={format(currentDate, 'EEEE, d MMMM yyyy', { locale: idLocale })}
            />
        </div>
    );
}
