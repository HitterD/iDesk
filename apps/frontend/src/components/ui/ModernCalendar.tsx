import React, { useState, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    format,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isSameMonth,
    isSameDay,
    isToday,
    addMonths,
    subMonths,
} from 'date-fns';

interface ModernCalendarProps {
    selected?: Date;
    onSelect?: (date: Date) => void;
    rangeStart?: Date;
    rangeEnd?: Date;
    onRangeSelect?: (start: Date, end: Date) => void;
    hasEvents?: (date: Date) => boolean;
    hasUrgent?: (date: Date) => boolean;
    minDate?: Date;
    maxDate?: Date;
    showPresets?: boolean;
    presets?: { label: string; getValue: () => { start: Date; end: Date } }[];
    className?: string;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const DEFAULT_PRESETS = [
    {
        label: 'Today',
        getValue: () => {
            const today = new Date();
            return { start: today, end: today };
        },
    },
    {
        label: 'This Week',
        getValue: () => {
            const today = new Date();
            const start = startOfWeek(today);
            const end = endOfWeek(today);
            return { start, end };
        },
    },
    {
        label: 'This Month',
        getValue: () => {
            const today = new Date();
            const start = startOfMonth(today);
            const end = endOfMonth(today);
            return { start, end };
        },
    },
];

export const ModernCalendar: React.FC<ModernCalendarProps> = ({
    selected,
    onSelect,
    rangeStart,
    rangeEnd,
    onRangeSelect,
    hasEvents,
    hasUrgent,
    minDate,
    maxDate,
    showPresets = false,
    presets = DEFAULT_PRESETS,
    className,
}) => {
    const [currentMonth, setCurrentMonth] = useState(selected || new Date());
    const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);
    const [animationKey, setAnimationKey] = useState(0);

    const days = useMemo(() => {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(currentMonth);
        const calendarStart = startOfWeek(monthStart);
        const calendarEnd = endOfWeek(monthEnd);
        return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    }, [currentMonth]);

    const goToPrevMonth = useCallback(() => {
        setSlideDirection('left');
        setAnimationKey((k) => k + 1);
        setCurrentMonth((m) => subMonths(m, 1));
    }, []);

    const goToNextMonth = useCallback(() => {
        setSlideDirection('right');
        setAnimationKey((k) => k + 1);
        setCurrentMonth((m) => addMonths(m, 1));
    }, []);

    const handleDayClick = useCallback(
        (day: Date) => {
            if (minDate && day < minDate) return;
            if (maxDate && day > maxDate) return;
            onSelect?.(day);
        },
        [onSelect, minDate, maxDate]
    );

    const handlePresetClick = useCallback(
        (preset: typeof presets[0]) => {
            const { start, end } = preset.getValue();
            if (onRangeSelect) {
                onRangeSelect(start, end);
            } else if (onSelect) {
                onSelect(start);
            }
            setCurrentMonth(start);
        },
        [onSelect, onRangeSelect]
    );

    const isInRange = useCallback(
        (day: Date) => {
            if (!rangeStart || !rangeEnd) return false;
            return day >= rangeStart && day <= rangeEnd;
        },
        [rangeStart, rangeEnd]
    );

    const isRangeStart = useCallback(
        (day: Date) => rangeStart && isSameDay(day, rangeStart),
        [rangeStart]
    );

    const isRangeEnd = useCallback(
        (day: Date) => rangeEnd && isSameDay(day, rangeEnd),
        [rangeEnd]
    );

    const isDisabled = useCallback(
        (day: Date) => {
            if (minDate && day < minDate) return true;
            if (maxDate && day > maxDate) return true;
            return false;
        },
        [minDate, maxDate]
    );

    return (
        <div className={cn('calendar-modern', className)}>
            {/* Presets */}
            {showPresets && presets.length > 0 && (
                <div className="calendar-presets">
                    {presets.map((preset) => (
                        <button
                            key={preset.label}
                            onClick={() => handlePresetClick(preset)}
                            className="calendar-preset"
                        >
                            {preset.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Header */}
            <div className="calendar-header">
                <button
                    onClick={goToPrevMonth}
                    className="calendar-nav-btn"
                    aria-label="Previous month"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="calendar-title">
                    {format(currentMonth, 'MMMM yyyy')}
                </span>
                <button
                    onClick={goToNextMonth}
                    className="calendar-nav-btn"
                    aria-label="Next month"
                >
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>

            {/* Weekdays */}
            <div className="calendar-weekdays">
                {WEEKDAYS.map((day) => (
                    <div key={day} className="calendar-weekday">
                        {day}
                    </div>
                ))}
            </div>

            {/* Days Grid */}
            <div
                key={animationKey}
                className={cn(
                    'calendar-grid',
                    slideDirection === 'right' && 'calendar-slide-right',
                    slideDirection === 'left' && 'calendar-slide-left'
                )}
                onAnimationEnd={() => setSlideDirection(null)}
            >
                {days.map((day, index) => {
                    const isSelected = selected && isSameDay(day, selected);
                    const isCurrentMonth = isSameMonth(day, currentMonth);
                    const isTodayDate = isToday(day);
                    const disabled = isDisabled(day);
                    const hasEvent = hasEvents?.(day);
                    const isUrgent = hasUrgent?.(day);
                    const inRange = isInRange(day);
                    const rangeStartDay = isRangeStart(day);
                    const rangeEndDay = isRangeEnd(day);

                    return (
                        <button
                            key={day.toISOString()}
                            onClick={() => !disabled && handleDayClick(day)}
                            disabled={disabled}
                            style={{ animationDelay: `${index * 0.01}s` }}
                            className={cn(
                                'calendar-day calendar-day-animate',
                                isSelected && 'selected',
                                isTodayDate && 'today',
                                !isCurrentMonth && 'outside-month',
                                disabled && 'disabled',
                                hasEvent && 'has-events',
                                isUrgent && 'has-urgent',
                                inRange && !rangeStartDay && !rangeEndDay && 'in-range',
                                rangeStartDay && 'range-start',
                                rangeEndDay && 'range-end'
                            )}
                        >
                            {format(day, 'd')}
                        </button>
                    );
                })}
            </div>

            {/* Footer with Today button */}
            <div className="calendar-footer">
                <button
                    onClick={() => {
                        const today = new Date();
                        setCurrentMonth(today);
                        onSelect?.(today);
                    }}
                    className="calendar-preset"
                >
                    Today
                </button>
                {selected && (
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                        {format(selected, 'MMM d, yyyy')}
                    </span>
                )}
            </div>
        </div>
    );
};

export default ModernCalendar;
