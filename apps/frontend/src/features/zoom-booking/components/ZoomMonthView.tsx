import { useMemo, useState } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isToday } from 'date-fns';
import { cn } from '@/lib/utils';
import type { CalendarDay, CalendarSlot, ZoomAccount } from '../types';
import { ZoomMonthDayPopover } from './ZoomMonthDayPopover';
import { Plus } from 'lucide-react';
import { useZoomSettings, isWorkingDay } from '../hooks/useZoomSettings';

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
    onSlotClick: (day: CalendarDay, slot: CalendarSlot) => void;
    onDateDoubleClick: (date: Date) => void;
    onBookingClick: (bookingId: string, day: CalendarDay) => void;
    canBook?: boolean;
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
    accountColorHex?: string;
    shortAccountName?: string;
}

function getShortAccountName(name?: string): string {
    if (!name) return 'Zoom';
    // e.g. "Zoom Admin 1" -> "ZA 1" / "Z1", "Marketing" -> "Mktg", "Zoom 1" -> "Zoom 1"
    const match = name.match(/Zoom\s+(?:Admin\s+)?(\d+)/i);
    if (match) return `Z${match[1]}`;
    return name.length > 5 ? name.substring(0, 4) + '..' : name;
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
        const accountColorHex = account?.colorHex || b.zoomAccount?.colorHex || b.accountColorHex || '#3b82f6';

        events.push({
            status,
            title: b.title,
            bookingId: b.id,
            startTime: b.startTime || time,
            endTime: b.endTime,
            joinUrl: b.joinUrl,
            accountName,
            accountColorHex,
            shortAccountName: getShortAccountName(accountName),
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

    // Selected day data for popup
    const selectedCalDay = selectedDate ? calendarMap.get(selectedDate) : undefined;
    const selectedEvents = selectedCalDay ? getDayEvents(selectedCalDay, accountsMap) : [];
    const selectedWeekend = selectedDate ? !isWorkingDay(new Date(selectedDate), workingDays) : false;

    return (
        <div className="flex flex-col h-full select-none bg-background relative">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-border bg-muted/30 shrink-0">
                {DAY_NAMES.map((day, idx) => (
                    <div
                        key={day.full}
                        className={cn(
                            "py-2 text-center text-xs font-bold uppercase tracking-wider",
                            idx >= 5
                                ? "text-muted-foreground/60 bg-muted/20"
                                : "text-foreground"
                        )}
                    >
                        <span className="hidden sm:inline">{day.full}</span>
                        <span className="inline sm:hidden text-[11px]">{day.short}</span>
                    </div>
                ))}
            </div>

            {/* Day cells grid */}
            <div
                className="grid grid-cols-7 flex-1 min-h-0 divide-x divide-y divide-border/70 border-b border-border"
                style={{ gridTemplateRows: `repeat(${totalRows}, minmax(0, 1fr))` }}
            >
                {days.map((day) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const calDay = calendarMap.get(dateStr);
                    const inMonth = isSameMonth(day, currentDate);
                    const today = isToday(day);
                    const events = getDayEvents(calDay, accountsMap);
                    
                    // Adaptive pills: show at most 2 pills + 1 compact overflow chip
                    const maxDisplay = events.length > 2 ? 2 : 2;
                    const visibleEvents = events.slice(0, maxDisplay);
                    const overflow = events.length - visibleEvents.length;
                    const isBlocked = calDay?.isBlocked ?? false;
                    const isWeekend = !isWorkingDay(day, workingDays);
                    const isSelected = selectedDate === dateStr;

                    return (
                        <div
                            key={dateStr}
                            className={cn(
                                "p-1 sm:p-1.5 transition-colors duration-150 relative group flex flex-col justify-between overflow-hidden",
                                !isWeekend && "cursor-pointer",
                                inMonth
                                    ? "bg-card hover:bg-muted/30"
                                    : "bg-muted/20 text-muted-foreground/50",
                                today && "bg-primary/5 hover:bg-primary/10",
                                isBlocked && "bg-destructive/5",
                                isWeekend && "bg-muted/40 cursor-not-allowed opacity-75",
                                isSelected && "ring-2 ring-primary ring-inset bg-primary/10"
                            )}
                            onClick={() => {
                                if (isWeekend) return;
                                if (calDay && calDay.slots.length > 0) {
                                    onSlotClick(calDay, calDay.slots[0]);
                                }
                            }}
                            onDoubleClick={() => onDateDoubleClick(day)}
                        >
                            {/* Day Header Row */}
                            <div className="flex items-center justify-between mb-1 px-0.5 z-10 shrink-0">
                                <span className={cn(
                                    "text-xs font-bold inline-flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full transition-all",
                                    today
                                        ? "bg-primary text-primary-foreground shadow-xs font-black"
                                        : inMonth
                                            ? "text-foreground font-semibold"
                                            : "text-muted-foreground/60"
                                )}>
                                    {format(day, 'd')}
                                </span>

                                {/* Distinct account color indicator dots */}
                                {events.length > 0 && !isBlocked && (
                                    <div className="hidden sm:flex items-center gap-1 max-w-[65px] overflow-hidden shrink-0 px-1">
                                        {Array.from(new Set(events.map(e => e.accountColorHex || '#3b82f6'))).slice(0, 5).map((color, idx) => (
                                            <span
                                                key={idx}
                                                className="w-1.5 h-1.5 rounded-full shrink-0 shadow-2xs ring-1 ring-background"
                                                style={{ backgroundColor: color }}
                                            />
                                        ))}
                                        {new Set(events.map(e => e.accountColorHex)).size > 5 && (
                                            <span className="text-[8px] font-mono text-muted-foreground font-bold leading-none">+</span>
                                        )}
                                    </div>
                                )}

                                {isBlocked && (
                                    <span className="text-[9px] sm:text-[10px] font-bold text-destructive px-1.5 py-0.2 rounded-full bg-destructive/10">
                                        Blokir
                                    </span>
                                )}

                                {!isBlocked && events.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedDate(dateStr);
                                        }}
                                        className={cn(
                                            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold transition-all cursor-pointer",
                                            isSelected
                                                ? "bg-primary text-primary-foreground shadow-2xs"
                                                : "bg-muted/80 hover:bg-primary/10 text-muted-foreground hover:text-primary border border-border/60"
                                        )}
                                        title="Klik untuk lihat semua jadwal meeting hari ini"
                                    >
                                        <span className="hidden sm:inline">{events.length} meeting{events.length > 1 ? 's' : ''}</span>
                                        <span className="inline sm:hidden">{events.length} mtg</span>
                                    </button>
                                )}
                            </div>

                            {/* Meeting Pills (Adaptive height & never clipped) */}
                            <div className="space-y-1 px-0.5 relative z-10 flex-1 min-h-0 flex flex-col justify-start">
                                {visibleEvents.map((event, eventIdx) => (
                                    <div
                                        key={`${event.bookingId ?? eventIdx}`}
                                        className={cn(
                                            "h-[22px] sm:h-[24px] px-1.5 rounded-md font-medium cursor-pointer transition-all border shadow-2xs group/pill flex items-center gap-1.5",
                                            "bg-background hover:bg-muted/80 border-border/80 text-foreground"
                                        )}
                                        style={{ borderLeftWidth: '3.5px', borderLeftColor: event.accountColorHex || '#3b82f6' }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (event.bookingId && calDay) {
                                                onBookingClick(event.bookingId, calDay);
                                            }
                                        }}
                                        title={`${event.title} (${event.startTime || ''}) - ${event.accountName || 'Zoom'}`}
                                    >
                                        {/* Account Tag Badge */}
                                        <span
                                            className="px-1 py-0.2 rounded text-[9px] font-black text-white shrink-0 shadow-2xs leading-none"
                                            style={{ backgroundColor: event.accountColorHex || '#3b82f6' }}
                                        >
                                            {event.shortAccountName}
                                        </span>

                                        {/* Start Time */}
                                        {event.startTime && (
                                            <span className="text-[10px] font-mono font-bold text-muted-foreground shrink-0 leading-none">
                                                {event.startTime}
                                            </span>
                                        )}

                                        {/* Title */}
                                        <span className="truncate text-[11px] font-semibold flex-1 min-w-0 leading-none">
                                            {event.title}
                                        </span>
                                    </div>
                                ))}

                                {/* +X More Pill Button */}
                                {overflow > 0 && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedDate(dateStr);
                                        }}
                                        className={cn(
                                            "h-[20px] sm:h-[22px] px-2 rounded-md text-[10px] sm:text-[11px] font-bold transition-all text-left flex items-center justify-between cursor-pointer border shadow-2xs",
                                            isSelected
                                                ? "bg-primary text-primary-foreground border-primary font-extrabold"
                                                : "bg-primary/5 hover:bg-primary/15 text-primary border-primary/20 hover:border-primary/40"
                                        )}
                                    >
                                        <span>+{overflow} meeting lagi</span>
                                        <span className="text-[9px] opacity-70 font-mono">Lihat &rarr;</span>
                                    </button>
                                )}
                            </div>

                            {/* Book Hover Prompt on Empty Days */}
                            {canBook && !isWeekend && !isBlocked && events.length === 0 && (
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 border-2 border-dashed border-primary/40 rounded-xl m-1 bg-primary/5 pointer-events-none z-0">
                                    <span className="text-xs font-semibold text-primary flex items-center gap-1">
                                        <Plus className="h-3.5 w-3.5" /> Book Zoom
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
