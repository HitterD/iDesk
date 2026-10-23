import React, { useState, useMemo, useCallback } from 'react';
import {
    Calendar as CalendarIcon,
    Clock,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    Check,
    Sparkles,
} from 'lucide-react';
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
    startOfDay,
    isBefore,
} from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface ModernDateTimePickerProps {
    value?: Date;
    onChange?: (date: Date) => void;
    minDate?: Date;
    maxDate?: Date;
    disabled?: boolean;
    className?: string;
    placeholder?: string;
}

const WEEKDAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

const QUICK_TIME_PRESETS = [
    { label: '08:00', hour: 8, minute: 0 },
    { label: '09:00', hour: 9, minute: 0 },
    { label: '10:00', hour: 10, minute: 0 },
    { label: '12:00', hour: 12, minute: 0 },
    { label: '14:00', hour: 14, minute: 0 },
    { label: '16:00', hour: 16, minute: 0 },
    { label: '17:00', hour: 17, minute: 0 },
    { label: '18:00', hour: 18, minute: 0 },
];

export const ModernDateTimePicker: React.FC<ModernDateTimePickerProps> = ({
    value,
    onChange,
    minDate,
    maxDate,
    disabled = false,
    className,
    placeholder = 'Pilih Tanggal & Waktu',
}) => {
    const [open, setOpen] = useState(false);
    const selectedDate = useMemo(() => value || new Date(), [value]);
    const [viewMonth, setViewMonth] = useState<Date>(selectedDate);

    // Keep viewMonth synced when value updates externally
    const handleOpenChange = (newOpen: boolean) => {
        if (newOpen) {
            setViewMonth(selectedDate);
        }
        setOpen(newOpen);
    };

    const days = useMemo(() => {
        const monthStart = startOfMonth(viewMonth);
        const monthEnd = endOfMonth(viewMonth);
        const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
        const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
        return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    }, [viewMonth]);

    const goToPrevMonth = useCallback(() => {
        setViewMonth((m) => subMonths(m, 1));
    }, []);

    const goToNextMonth = useCallback(() => {
        setViewMonth((m) => addMonths(m, 1));
    }, []);

    const currentHour = selectedDate.getHours();
    const currentMinute = selectedDate.getMinutes();

    const isDateDisabled = useCallback(
        (day: Date) => {
            if (minDate && startOfDay(day) < startOfDay(minDate)) return true;
            if (maxDate && startOfDay(day) > startOfDay(maxDate)) return true;
            return false;
        },
        [minDate, maxDate]
    );

    const handleSelectDay = (day: Date) => {
        if (isDateDisabled(day)) return;
        const newDate = new Date(day);
        newDate.setHours(currentHour, currentMinute, 0, 0);

        // If newly constructed datetime is before minDate, adjust to minDate time
        if (minDate && isBefore(newDate, minDate)) {
            newDate.setHours(minDate.getHours(), minDate.getMinutes(), 0, 0);
        }

        onChange?.(newDate);
    };

    const handleSelectTime = (hour: number, minute: number) => {
        const newDate = new Date(selectedDate);
        newDate.setHours(hour, minute, 0, 0);
        onChange?.(newDate);
    };

    const handleHourChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const hour = parseInt(e.target.value, 10);
        handleSelectTime(hour, currentMinute);
    };

    const handleMinuteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const minute = parseInt(e.target.value, 10);
        handleSelectTime(currentHour, minute);
    };

    const formattedDateText = value
        ? format(value, 'EEEE, d MMMM yyyy', { locale: idLocale })
        : placeholder;

    const formattedTimeText = value
        ? format(value, 'HH:mm') + ' WIB'
        : '--:-- WIB';

    return (
        <Popover open={open} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    disabled={disabled}
                    aria-label={value ? `${formattedDateText}, ${formattedTimeText}` : placeholder}
                    className={cn('datetime-trigger', className)}
                >
                    <CalendarIcon className="w-4 h-4 shrink-0" />
                    <span className="min-w-0 flex-1">{formattedDateText}<small className="block">{formattedTimeText}</small></span>
                    <ChevronDown className="w-4 h-4 shrink-0" />
                </button>
            </PopoverTrigger>

            <PopoverContent
                align="start"
                sideOffset={8}
                className="datetime-popover w-[min(350px,calc(100vw-24px))] p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl"
                collisionPadding={12}
                onEscapeKeyDown={event => event.stopPropagation()}
            >
                {/* 1. Month Header Navigation */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                    <button
                        type="button"
                        onClick={goToPrevMonth}
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                        title="Bulan Sebelumnya"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>

                    <div className="text-center">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight capitalize">
                            {format(viewMonth, 'MMMM yyyy', { locale: idLocale })}
                        </h4>
                    </div>

                    <button
                        type="button"
                        onClick={goToNextMonth}
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                        title="Bulan Berikutnya"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>

                {/* 2. Weekday Header */}
                <div className="grid grid-cols-7 gap-1 text-center my-2">
                    {WEEKDAYS.map((wd) => (
                        <div
                            key={wd}
                            className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 py-1"
                        >
                            {wd}
                        </div>
                    ))}
                </div>

                {/* 3. Days Grid */}
                <div className="grid grid-cols-7 gap-1">
                    {days.map((day) => {
                        const isSelected = value && isSameDay(day, value);
                        const isCurrentMonth = isSameMonth(day, viewMonth);
                        const isTodayDate = isToday(day);
                        const disabledDay = isDateDisabled(day);

                        return (
                            <button
                                aria-label={format(day, 'd MMMM yyyy', { locale: idLocale })}
                                key={day.toISOString()}
                                type="button"
                                onClick={() => handleSelectDay(day)}
                                disabled={disabledDay}
                                className={cn(
                                    'h-9 rounded-xl flex items-center justify-center text-xs font-semibold transition-all relative cursor-pointer',
                                    isSelected
                                        ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/30 scale-105 z-10'
                                        : disabledDay
                                            ? 'text-slate-300 dark:text-slate-700 opacity-40 cursor-not-allowed pointer-events-none'
                                            : !isCurrentMonth
                                                ? 'text-slate-400/60 dark:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                                                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 dark:hover:text-blue-400 active:scale-95',
                                    isTodayDate && !isSelected && 'border border-blue-400/60 dark:border-blue-500/60 font-bold text-blue-600 dark:text-blue-400'
                                )}
                            >
                                <span>{format(day, 'd')}</span>
                                {isTodayDate && isSelected && (
                                    <span className="w-1 h-1 rounded-full bg-white absolute bottom-1" />
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* 4. Time Selection Section */}
                <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                            <Clock className="w-3.5 h-3.5 text-blue-500" />
                            Pilih Waktu (WIB)
                        </span>

                        {/* Direct Select Steppers */}
                        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700">
                            <select
                                aria-label="Jam"
                                value={currentHour}
                                onChange={handleHourChange}
                                className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer px-1 py-0.5"
                            >
                                {Array.from({ length: 24 }).map((_, i) => (
                                    <option key={i} value={i} className="dark:bg-slate-900">
                                        {String(i).padStart(2, '0')}
                                    </option>
                                ))}
                            </select>
                            <span className="text-xs font-bold text-slate-400">:</span>
                            <select
                                aria-label="Menit"
                                value={currentMinute}
                                onChange={handleMinuteChange}
                                className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer px-1 py-0.5"
                            >
                                {Array.from({ length: 60 }, (_, minute) => minute).map((m) => (
                                    <option key={m} value={m} className="dark:bg-slate-900">
                                        {String(m).padStart(2, '0')}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Quick Time Preset Pills */}
                    <div className="flex flex-wrap gap-1.5">
                        {QUICK_TIME_PRESETS.map((preset) => {
                            const isTimeSelected =
                                currentHour === preset.hour && currentMinute === preset.minute;
                            return (
                                <button
                                    key={preset.label}
                                    type="button"
                                    onClick={() => handleSelectTime(preset.hour, preset.minute)}
                                    className={cn(
                                        'px-2.5 py-1 text-[11px] font-mono font-bold rounded-lg border transition-all cursor-pointer',
                                        isTimeSelected
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-2xs shadow-blue-500/20'
                                            : 'bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                                    )}
                                >
                                    {preset.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 5. Popover Footer */}
                <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <button
                        type="button"
                        onClick={() => {
                            const today = new Date();
                            setViewMonth(today);
                            handleSelectDay(today);
                        }}
                        className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer flex items-center gap-1"
                    >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Pilih Hari Ini</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className="px-3.5 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                        <Check className="w-3.5 h-3.5" />
                        <span>Selesai</span>
                    </button>
                </div>
            </PopoverContent>
        </Popover>
    );
};

export default ModernDateTimePicker;
