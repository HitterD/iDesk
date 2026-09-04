import { useState, useMemo } from 'react';
import {
    format,
    addMonths,
    subMonths,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isSameMonth,
    isToday,
    isPast,
    isSameDay,
    parseISO,
} from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import {
    ChevronLeft,
    ChevronRight,
    Calendar as CalendarIcon,
    Clock,
    Plus,
    Video,
    CheckCircle2,
    CalendarCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ZoomBooking } from '../types';

interface ZoomClientMonthCalendarProps {
    bookings: ZoomBooking[];
    selectedDate?: string;
    onDateSelect?: (dateStr: string) => void;
    onBookingClick?: (bookingId: string) => void;
}

const WEEK_DAYS = [
    { label: 'Senin', short: 'Sen' },
    { label: 'Selasa', short: 'Sel' },
    { label: 'Rabu', short: 'Rab' },
    { label: 'Kamis', short: 'Kam' },
    { label: 'Jumat', short: 'Jum' },
    { label: 'Sabtu', short: 'Sab' },
    { label: 'Minggu', short: 'Min' },
];

function normalizeDateStr(rawDate: string | Date | undefined): string {
    if (!rawDate) return '';
    if (typeof rawDate === 'string') {
        return rawDate.split('T')[0];
    }
    return format(new Date(rawDate), 'yyyy-MM-dd');
}

export function ZoomClientMonthCalendar({
    bookings,
    selectedDate,
    onDateSelect,
    onBookingClick,
}: ZoomClientMonthCalendarProps) {
    const [currentMonth, setCurrentMonth] = useState<Date>(() => new Date());

    // Map bookings by date string YYYY-MM-DD
    const bookingsByDate = useMemo(() => {
        const map = new Map<string, ZoomBooking[]>();
        for (const b of bookings) {
            const dateStr = normalizeDateStr(b.bookingDate);
            if (!dateStr) continue;
            if (!map.has(dateStr)) {
                map.set(dateStr, []);
            }
            map.get(dateStr)!.push(b);
        }
        // Sort bookings by startTime ascending
        for (const list of map.values()) {
            list.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
        }
        return map;
    }, [bookings]);

    // Generate days grid for the current month
    const calendarDays = useMemo(() => {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(currentMonth);
        const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
        const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
        return eachDayOfInterval({ start: gridStart, end: gridEnd });
    }, [currentMonth]);

    // Calculate total bookings in this month
    const thisMonthBookingsCount = useMemo(() => {
        let count = 0;
        for (const day of calendarDays) {
            if (isSameMonth(day, currentMonth)) {
                const dateStr = format(day, 'yyyy-MM-dd');
                count += (bookingsByDate.get(dateStr) || []).length;
            }
        }
        return count;
    }, [calendarDays, currentMonth, bookingsByDate]);

    const handlePrevMonth = () => setCurrentMonth((prev) => subMonths(prev, 1));
    const handleNextMonth = () => setCurrentMonth((prev) => addMonths(prev, 1));
    const handleToday = () => setCurrentMonth(new Date());

    return (
        <div className="flex flex-col h-full select-none">
            {/* Header: Month Navigation and Summary */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-4 border-b border-border/40 bg-muted/20">
                <div className="flex items-center gap-2.5">
                    <h3 className="text-base font-bold text-foreground capitalize tracking-tight flex items-center gap-2">
                        <span>{format(currentMonth, 'MMMM yyyy', { locale: idLocale })}</span>
                    </h3>
                    <Badge
                        variant="secondary"
                        className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200/60 dark:border-blue-800/60"
                    >
                        {thisMonthBookingsCount} meeting
                    </Badge>
                </div>

                <div className="flex items-center gap-1">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleToday}
                        className="h-8 px-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-background/80 shadow-2xs border-border/60"
                    >
                        Hari Ini
                    </Button>
                    <div className="flex items-center rounded-lg border border-border/60 bg-background p-0.5 shadow-2xs">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handlePrevMonth}
                            className="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground"
                            aria-label="Bulan Sebelumnya"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleNextMonth}
                            className="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground"
                            aria-label="Bulan Berikutnya"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Days of Week Row */}
            <div className="grid grid-cols-7 border-b border-border/40 bg-muted/30 text-center text-xs font-bold text-muted-foreground">
                {WEEK_DAYS.map((d, i) => (
                    <div
                        key={d.short}
                        className={cn(
                            "py-2 uppercase tracking-wider text-[11px]",
                            i >= 5 ? "text-amber-600 dark:text-amber-500 font-semibold" : ""
                        )}
                    >
                        <span className="hidden sm:inline">{d.label}</span>
                        <span className="sm:hidden">{d.short}</span>
                    </div>
                ))}
            </div>

            {/* Calendar Days Matrix */}
            <div className="grid grid-cols-7 flex-1 auto-rows-fr gap-px bg-border/40 overflow-y-auto">
                {calendarDays.map((day) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const dayBookings = bookingsByDate.get(dateStr) || [];
                    const isCurrentMonth = isSameMonth(day, currentMonth);
                    const isCurrentDay = isToday(day);
                    const isPastDay = isPast(day) && !isToday(day);
                    const isSelected = selectedDate === dateStr;

                    return (
                        <div
                            key={dateStr}
                            onClick={() => {
                                if (isPastDay) {
                                    toast.info('Tanggal ini sudah lewat. Pilih hari ini atau tanggal mendatang.');
                                    return;
                                }
                                onDateSelect?.(dateStr);
                            }}
                            className={cn(
                                "group relative flex flex-col p-1.5 sm:p-2 transition-all duration-150 min-h-[85px] sm:min-h-[105px]",
                                isPastDay ? "cursor-default opacity-60 bg-slate-50/40 dark:bg-slate-900/30" : "cursor-pointer",
                                isCurrentMonth ? "bg-card hover:bg-muted/30" : "bg-muted/20 text-muted-foreground/40",
                                isSelected && "ring-2 ring-blue-500 ring-inset bg-blue-50/20 dark:bg-blue-950/20",
                                isCurrentDay && !isSelected && "bg-blue-50/15 dark:bg-blue-950/10"
                            )}
                        >
                            {/* Day Number Header */}
                            <div className="flex items-center justify-between mb-1">
                                <span
                                    className={cn(
                                        "inline-flex items-center justify-center text-xs font-semibold rounded-full w-6 h-6 transition-all",
                                        isCurrentDay
                                            ? "bg-blue-600 text-white font-bold shadow-xs"
                                            : isSelected
                                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 font-bold"
                                            : isCurrentMonth
                                            ? "text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400"
                                            : "text-muted-foreground/50"
                                    )}
                                >
                                    {format(day, 'd')}
                                </span>

                                {dayBookings.length > 0 && (
                                    <span className="text-[10px] font-bold text-muted-foreground/80 sm:hidden">
                                        {dayBookings.length}m
                                    </span>
                                )}
                            </div>

                            {/* Booking Badges / Chips */}
                            <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                                {dayBookings.slice(0, 3).map((b) => {
                                    const accColor = b.zoomAccount?.colorHex || '#3b82f6';
                                    const timeDisplay = b.startTime ? b.startTime.slice(0, 5) : '';

                                    return (
                                        <div
                                            key={b.id}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onBookingClick?.(b.id);
                                            }}
                                            className={cn(
                                                "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border border-border/50 shadow-2xs hover:shadow-xs transition-all duration-150 cursor-pointer overflow-hidden text-foreground bg-background hover:border-blue-400/80 group/chip",
                                                b.status === 'CANCELLED' && "opacity-60 line-through bg-muted/40"
                                            )}
                                            style={{
                                                borderLeftWidth: '3px',
                                                borderLeftColor: accColor,
                                            }}
                                            title={`${timeDisplay} ${b.title || 'Zoom Meeting'} (${b.zoomAccount?.name || 'Zoom'})`}
                                        >
                                            {timeDisplay && (
                                                <span className="font-mono text-[9.5px] font-semibold text-muted-foreground shrink-0 group-hover/chip:text-blue-600 dark:group-hover/chip:text-blue-400">
                                                    {timeDisplay}
                                                </span>
                                            )}
                                            <span className="truncate text-[10px] font-medium">
                                                {b.title || 'Zoom Meeting'}
                                            </span>
                                        </div>
                                    );
                                })}

                                {dayBookings.length > 3 && (
                                    <div
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (!isPastDay) onDateSelect?.(dateStr);
                                        }}
                                        className="text-[9.5px] font-bold text-blue-600 dark:text-blue-400 hover:underline px-1 py-0.5 rounded hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer transition-colors"
                                    >
                                        +{dayBookings.length - 3} meeting lagi
                                    </div>
                                )}
                            </div>

                            {/* Hover Quick Add button for future/today dates */}
                            {isCurrentMonth && !isPastDay && dayBookings.length === 0 && (
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto">
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDateSelect?.(dateStr);
                                        }}
                                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xs px-2.5 py-1 rounded-full shadow-sm border border-blue-300/80 dark:border-blue-700/80 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 dark:hover:text-white transition-all cursor-pointer transform hover:scale-105 active:scale-95"
                                        title={`Buat jadwal meeting pada ${format(day, 'd MMMM yyyy', { locale: idLocale })}`}
                                    >
                                        <Plus className="w-3 h-3" /> Buat di sini
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Bottom Context Info Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-t border-border/40 bg-muted/10 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                    <CalendarCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Klik meeting untuk melihat detail atau klik tanggal untuk membuat booking baru.</span>
                </div>
                {selectedDate && (
                    <div className="flex items-center gap-1.5 font-medium text-foreground text-[11px] bg-background border border-border px-2 py-0.5 rounded-md shadow-2xs">
                        <span className="text-muted-foreground">Tanggal dipilih:</span>
                        <strong className="text-blue-600 dark:text-blue-400">
                            {format(parseISO(selectedDate), 'EEEE, d MMMM yyyy', { locale: idLocale })}
                        </strong>
                    </div>
                )}
            </div>
        </div>
    );
}
