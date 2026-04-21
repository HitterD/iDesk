import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isBefore, startOfToday, addMonths, subMonths } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, X, CalendarX, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface BlockedDatesPickerProps {
    blockedDates: string[];
    onChange: (dates: string[]) => void;
    disabled?: boolean;
}

export function BlockedDatesPicker({
    blockedDates,
    onChange,
    disabled = false,
}: BlockedDatesPickerProps) {
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const today = startOfToday();

    // Generate days for the calendar grid
    const days = useMemo(() => {
        const start = startOfMonth(currentMonth);
        const end = endOfMonth(currentMonth);
        return eachDayOfInterval({ start, end });
    }, [currentMonth]);

    // Get first day offset (for grid alignment)
    const firstDayOffset = useMemo(() => {
        const start = startOfMonth(currentMonth);
        return start.getDay(); // 0 = Sunday
    }, [currentMonth]);

    // Check if a date is blocked
    const isBlocked = (date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        return blockedDates.includes(dateStr);
    };

    // Toggle blocked date
    const toggleDate = (date: Date) => {
        if (disabled) return;
        if (isBefore(date, today)) return; // Can't block past dates

        const dateStr = format(date, 'yyyy-MM-dd');
        if (blockedDates.includes(dateStr)) {
            onChange(blockedDates.filter(d => d !== dateStr));
        } else {
            onChange([...blockedDates, dateStr].sort());
        }
    };

    // Navigation
    const goToPrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
    const goToNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

    // Remove a blocked date from list
    const removeBlockedDate = (dateStr: string) => {
        if (disabled) return;
        onChange(blockedDates.filter(d => d !== dateStr));
    };

    // Blocked dates sorted and filtered for display
    const sortedBlockedDates = useMemo(() => {
        return [...blockedDates]
            .filter(d => !isBefore(new Date(d), today))
            .sort();
    }, [blockedDates, today]);

    return (
        <div className="space-y-4">
            {/* Calendar Header */}
            <div className="flex items-center justify-between">
                <h4 className="font-medium flex items-center gap-2">
                    <CalendarX className="h-4 w-4 text-red-500" />
                    Blocked Dates (Holidays/Off Days)
                </h4>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Calendar Grid */}
                <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4">
                    {/* Month Navigation */}
                    <div className="flex items-center justify-between mb-4">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={goToPrevMonth}
                            disabled={disabled}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="font-semibold">
                            {format(currentMonth, 'MMMM yyyy', { locale: idLocale })}
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={goToNextMonth}
                            disabled={disabled}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Day Headers */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                        {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((day) => (
                            <div
                                key={day}
                                className="text-center text-xs font-medium text-muted-foreground py-1"
                            >
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Days Grid */}
                    <div className="grid grid-cols-7 gap-1">
                        {/* Empty cells for offset */}
                        {Array.from({ length: firstDayOffset }).map((_, i) => (
                            <div key={`empty-${i}`} className="aspect-square" />
                        ))}

                        {/* Calendar Days */}
                        {days.map((day) => {
                            const isPast = isBefore(day, today);
                            const blocked = isBlocked(day);
                            const isCurrentDay = isToday(day);
                            const isWeekend = day.getDay() === 0 || day.getDay() === 6;

                            return (
                                <button
                                    key={day.toISOString()}
                                    onClick={() => toggleDate(day)}
                                    disabled={disabled || isPast}
                                    className={cn(
                                        "aspect-square rounded-lg text-sm font-medium transition-colors duration-150 flex items-center justify-center",
                                        // Base styles
                                        !blocked && !isPast && "hover:bg-slate-200 dark:hover:bg-slate-700",
                                        // Blocked state
                                        blocked && "bg-red-500 text-white hover:bg-red-600",
                                        // Current day
                                        isCurrentDay && !blocked && "ring-2 ring-blue-500",
                                        // Past dates
                                        isPast && "text-slate-300 dark:text-slate-600 cursor-not-allowed",
                                        // Weekend
                                        isWeekend && !blocked && !isPast && "text-slate-400",
                                        // Disabled
                                        disabled && "cursor-not-allowed opacity-50"
                                    )}
                                >
                                    {format(day, 'd')}
                                </button>
                            );
                        })}
                    </div>

                    {/* Legend */}
                    <div className="flex items-center gap-4 mt-4 pt-4 border-t text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                            <div className="w-4 h-4 bg-red-500 rounded" />
                            <span>Blocked</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-4 h-4 border-2 border-blue-500 rounded" />
                            <span>Today</span>
                        </div>
                    </div>
                </div>

                {/* Blocked Dates List */}
                <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                        {sortedBlockedDates.length === 0
                            ? 'Klik tanggal di kalender untuk menandai sebagai libur'
                            : `${sortedBlockedDates.length} tanggal diblokir:`
                        }
                    </p>

                    <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 min-h-[200px] max-h-[300px] overflow-y-auto">
                        {sortedBlockedDates.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                                <CalendarX className="h-8 w-8 mb-2 opacity-50" />
                                <p className="text-sm">Tidak ada tanggal diblokir</p>
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {sortedBlockedDates.map((dateStr) => (
                                    <Badge
                                        key={dateStr}
                                        variant="destructive"
                                        className="flex items-center gap-1 pl-3"
                                    >
                                        {format(new Date(dateStr), 'dd MMM yyyy', { locale: idLocale })}
                                        <button
                                            onClick={() => removeBlockedDate(dateStr)}
                                            disabled={disabled}
                                            className="ml-1 hover:bg-red-600 rounded-full p-0.5"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </div>

                    <p className="text-xs text-muted-foreground">
                        Tanggal yang diblokir tidak akan tersedia untuk booking
                    </p>
                </div>
            </div>
        </div>
    );
}
