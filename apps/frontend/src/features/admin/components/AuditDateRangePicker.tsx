import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface AuditDateRangePickerProps {
    startDate: string;
    endDate: string;
    onStartDateChange: (date: string) => void;
    onEndDateChange: (date: string) => void;
}

export function AuditDateRangePicker({
    startDate,
    endDate,
    onStartDateChange,
    onEndDateChange,
}: AuditDateRangePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [viewMonth, setViewMonth] = useState(new Date());
    const [selectingEnd, setSelectingEnd] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const formatDisplayDate = (dateStr: string) => {
        if (!dateStr) return '--';
        const date = new Date(dateStr);
        return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const days: Date[] = [];

        // Add padding for days before first day of month
        const startPadding = firstDay.getDay();
        for (let i = startPadding - 1; i >= 0; i--) {
            days.push(new Date(year, month, -i));
        }

        // Add days of month
        for (let i = 1; i <= lastDay.getDate(); i++) {
            days.push(new Date(year, month, i));
        }

        // Add padding for days after last day of month
        const endPadding = 6 - lastDay.getDay();
        for (let i = 1; i <= endPadding; i++) {
            days.push(new Date(year, month + 1, i));
        }

        return days;
    };

    const handleDateClick = (date: Date) => {
        const dateStr = date.toISOString().split('T')[0];
        if (!selectingEnd) {
            onStartDateChange(dateStr);
            setSelectingEnd(true);
        } else {
            if (new Date(dateStr) >= new Date(startDate)) {
                onEndDateChange(dateStr);
            } else {
                onStartDateChange(dateStr);
                onEndDateChange('');
            }
            setSelectingEnd(false);
            setIsOpen(false);
        }
    };

    const isInRange = (date: Date) => {
        if (!startDate || !endDate) return false;
        const d = date.getTime();
        return d >= new Date(startDate).getTime() && d <= new Date(endDate).getTime();
    };

    const isStartDate = (date: Date) => startDate && date.toISOString().split('T')[0] === startDate;
    const isEndDate = (date: Date) => endDate && date.toISOString().split('T')[0] === endDate;

    const days = getDaysInMonth(viewMonth);
    const monthName = viewMonth.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

    const prevMonth = () => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1));
    const nextMonth = () => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1));

    const hasValue = startDate || endDate;

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onStartDateChange('');
        onEndDateChange('');
    };

    return (
        <div ref={containerRef} className="relative">
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    flex items-center gap-2 px-3 py-2 min-w-[220px]
                    bg-white dark:bg-[hsl(var(--card))]
                    border border-[hsl(var(--border))]
                    rounded-lg text-xs font-medium
                    hover:border-primary/40 transition-colors
                    ${isOpen ? 'ring-2 ring-primary/20 border-primary/40' : ''}
                `}
            >
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span className={`flex-1 text-left ${hasValue ? 'text-slate-800 dark:text-white' : 'text-slate-500 font-medium'}`}>
                    {hasValue ? (
                        <>
                            {formatDisplayDate(startDate)}
                            <span className="text-slate-400 mx-1">→</span>
                            {formatDisplayDate(endDate)}
                        </>
                    ) : (
                        'Select date range'
                    )}
                </span>
                {hasValue && (
                    <button
                        onClick={handleClear}
                        className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700/50 rounded transition-colors"
                    >
                        <X className="w-3 h-3 text-slate-400" />
                    </button>
                )}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-full left-0 mt-2 w-72 overflow-hidden rounded-xl bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-lg z-[100]"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--border))]">
                            <button onClick={prevMonth} className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg transition-colors">
                                <ChevronLeft className="w-4 h-4 text-slate-500" />
                            </button>
                            <span className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">{monthName}</span>
                            <button onClick={nextMonth} className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg transition-colors">
                                <ChevronRight className="w-4 h-4 text-slate-500" />
                            </button>
                        </div>

                        {/* Selection hint */}
                        <div className="px-4 py-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 text-center uppercase tracking-wider border-b border-[hsl(var(--border))] bg-slate-50/50 dark:bg-slate-800/20">
                            {selectingEnd ? 'Select end date' : 'Select start date'}
                        </div>

                        {/* Day headers */}
                        <div className="grid grid-cols-7 gap-1 px-2 py-2">
                            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                                <div key={day} className="text-center text-[10px] font-bold text-slate-400 uppercase">
                                    {day}
                                </div>
                            ))}
                        </div>

                        {/* Days */}
                        <div className="grid grid-cols-7 gap-1 px-2 pb-3">
                            {days.map((date, i) => {
                                const isCurrentMonth = date.getMonth() === viewMonth.getMonth();
                                const isToday = date.toDateString() === new Date().toDateString();
                                const isStart = isStartDate(date);
                                const isEnd = isEndDate(date);
                                const inRange = isInRange(date);

                                return (
                                    <button
                                        key={i}
                                        onClick={() => handleDateClick(date)}
                                        className={`
                                            w-8 h-8 text-[11px] font-medium rounded-lg flex items-center justify-center
                                            transition-[opacity,transform,colors] duration-200 ease-out
                                            ${!isCurrentMonth ? 'text-slate-300 dark:text-slate-600' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'}
                                            ${isToday && !isStart && !isEnd ? 'ring-1 ring-primary/50 text-primary' : ''}
                                            ${isStart || isEnd ? 'bg-primary text-primary-foreground font-bold shadow-sm' : ''}
                                            ${inRange && !isStart && !isEnd ? 'bg-[hsl(var(--primary))]/10 text-primary' : ''}
                                        `}
                                    >
                                        {date.getDate()}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Quick actions */}
                        <div className="flex items-center gap-2 px-3 py-2 border-t border-[hsl(var(--border))] bg-slate-50/50 dark:bg-slate-800/20">
                            <button
                                onClick={() => {
                                    const today = new Date().toISOString().split('T')[0];
                                    onStartDateChange(today);
                                    onEndDateChange(today);
                                    setIsOpen(false);
                                }}
                                className="flex-1 px-2 py-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-white dark:hover:text-white dark:hover:bg-[hsl(var(--card))] border border-transparent hover:border-[hsl(var(--border))] rounded-lg transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out shadow-sm shadow-transparent hover:shadow-[hsl(var(--border))]"
                            >
                                Today
                            </button>
                            <button
                                onClick={() => {
                                    const today = new Date();
                                    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                                    onStartDateChange(weekAgo.toISOString().split('T')[0]);
                                    onEndDateChange(today.toISOString().split('T')[0]);
                                    setIsOpen(false);
                                }}
                                className="flex-1 px-2 py-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-white dark:hover:text-white dark:hover:bg-[hsl(var(--card))] border border-transparent hover:border-[hsl(var(--border))] rounded-lg transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out shadow-sm shadow-transparent hover:shadow-[hsl(var(--border))]"
                            >
                                Last 7 Days
                            </button>
                            <button
                                onClick={() => {
                                    const today = new Date();
                                    const monthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
                                    onStartDateChange(monthAgo.toISOString().split('T')[0]);
                                    onEndDateChange(today.toISOString().split('T')[0]);
                                    setIsOpen(false);
                                }}
                                className="flex-1 px-2 py-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-white dark:hover:text-white dark:hover:bg-[hsl(var(--card))] border border-transparent hover:border-[hsl(var(--border))] rounded-lg transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out shadow-sm shadow-transparent hover:shadow-[hsl(var(--border))]"
                            >
                                Last 30 Days
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
