import { useState } from 'react';
import { format, startOfWeek, endOfWeek, setMonth, setYear, getYear } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CalendarDays, ListTodo, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ZoomViewSwitcher } from './ZoomViewSwitcher';
import { ModernCalendar } from '@/components/ui/ModernCalendar';
import { cn } from '@/lib/utils';
import type { CalendarView } from '../hooks/useCalendarView';
import type { ZoomAccount } from '../types';
import { motion } from 'framer-motion';

interface ZoomCalendarHeaderProps {
    view: CalendarView;
    currentDate: Date;
    selectedAccountId: string;
    accounts: ZoomAccount[];
    onViewChange: (view: CalendarView) => void;
    onPrev: () => void;
    onNext: () => void;
    onToday: () => void;
    onAccountChange: (accountId: string) => void;
    onNavigateToDate: (date: Date) => void;
    canBook?: boolean;
    onBookMeeting?: () => void;
    className?: string;
}

function getHeaderTitle(view: CalendarView, date: Date): string {
    switch (view) {
        case 'month':
            return format(date, 'MMMM yyyy', { locale: idLocale });
        case 'week': {
            const weekStart = startOfWeek(date, { weekStartsOn: 1 });
            const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
            if (weekStart.getMonth() === weekEnd.getMonth()) {
                return format(weekStart, 'd', { locale: idLocale }) +
                    ' – ' +
                    format(weekEnd, 'd MMMM yyyy', { locale: idLocale });
            }
            return format(weekStart, 'd MMM', { locale: idLocale }) +
                ' – ' +
                format(weekEnd, 'd MMM yyyy', { locale: idLocale });
        }
        case 'day':
            return format(date, 'EEEE, d MMMM yyyy', { locale: idLocale });
        case 'my-bookings':
            return 'My Bookings';
    }
}

export function ZoomCalendarHeader({
    view,
    currentDate,
    selectedAccountId,
    accounts,
    canBook,
    onViewChange,
    onPrev,
    onNext,
    onToday,
    onAccountChange,
    onNavigateToDate,
    onBookMeeting,
    className,
}: ZoomCalendarHeaderProps) {
    const title = getHeaderTitle(view, currentDate);
    const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
    const [pickerYear, setPickerYear] = useState(getYear(currentDate));

    const MONTHS = [
        'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
        'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'
    ];

    const handleMonthSelect = (monthIndex: number) => {
        let newDate = setYear(currentDate, pickerYear);
        newDate = setMonth(newDate, monthIndex);
        onNavigateToDate(newDate);
        setIsMonthPickerOpen(false);
    };

    return (
        <div className={cn(
            "flex items-center justify-between gap-3 flex-wrap",
            className
        )}>
            {/* Left: navigation — hidden for my-bookings view */}
            {view !== 'my-bookings' && (
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onToday}
                        className="h-8 px-3 text-xs font-medium"
                    >
                        Today
                    </Button>

                    <div className="flex items-center">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onPrev}
                            className="h-8 w-8"
                            aria-label="Previous"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onNext}
                            className="h-8 w-8"
                            aria-label="Next"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>

                    <Popover open={isMonthPickerOpen} onOpenChange={setIsMonthPickerOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 flex items-center gap-1.5 text-sm font-semibold text-[hsl(var(--foreground))] px-2 hover:bg-[hsl(var(--muted))]/50">
                                <CalendarDays className="h-4 w-4 text-[hsl(var(--primary))] shrink-0" />
                                <span className="capitalize">{title}</span>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-3" align="start">
                            {view === 'month' ? (
                                <div className="w-64">
                                    <div className="flex items-center justify-between mb-4">
                                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setPickerYear(y => y - 1)}>
                                            <ChevronLeft className="h-4 w-4" />
                                        </Button>
                                        <div className="font-semibold text-sm">{pickerYear}</div>
                                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setPickerYear(y => y + 1)}>
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        {MONTHS.map((month, idx) => {
                                            const isCurrentMonth = currentDate.getMonth() === idx && currentDate.getFullYear() === pickerYear;
                                            return (
                                                <Button
                                                    key={month}
                                                    variant={isCurrentMonth ? "default" : "ghost"}
                                                    size="sm"
                                                    onClick={() => handleMonthSelect(idx)}
                                                    className={cn("h-8 text-xs", isCurrentMonth && "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]")}
                                                >
                                                    {month}
                                                </Button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <ModernCalendar
                                    selected={currentDate}
                                    onSelect={(date) => {
                                        onNavigateToDate(date);
                                        setIsMonthPickerOpen(false);
                                    }}
                                />
                            )}
                        </PopoverContent>
                    </Popover>
                </div>
            )}
            {view === 'my-bookings' && (
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-[hsl(var(--primary))]/10">
                        <ListTodo className="h-4 w-4 text-[hsl(var(--primary))]" />
                    </div>
                    <span className="text-sm font-bold text-[hsl(var(--foreground))]">My Bookings</span>
                </div>
            )}

            {/* Right: account filter + view switcher */}
            <div className="flex items-center gap-2 flex-wrap">
                {accounts.length > 1 && (
                    <div className="flex items-center p-1 bg-[hsl(var(--secondary))]/50 rounded-xl overflow-x-auto custom-scrollbar shadow-inner relative ring-1 ring-[hsl(var(--border))] max-w-[400px] md:max-w-none">
                        <button
                            onClick={() => onAccountChange('all')}
                            className={cn(
                                "relative px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap z-10 outline-none",
                                selectedAccountId === 'all' || selectedAccountId === undefined
                                    ? "text-[hsl(var(--foreground))]"
                                    : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                            )}
                        >
                            {(selectedAccountId === 'all' || selectedAccountId === undefined) && (
                                <motion.div
                                    layoutId="account-indicator"
                                    className="absolute inset-0 bg-[hsl(var(--background))] rounded-lg shadow-sm"
                                    transition={{ type: "spring", duration: 0.4, bounce: 0.15 }}
                                    style={{ zIndex: -1 }}
                                />
                            )}
                            All Accounts
                        </button>
                        
                        {accounts.map((account, index) => {
                            const isSelected = selectedAccountId === account.id;
                            const shortName = `Zoom ${index + 1}`;
                            return (
                                <button
                                    key={account.id}
                                    onClick={() => onAccountChange(account.id)}
                                    className={cn(
                                        "relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap z-10 outline-none",
                                        isSelected
                                            ? "text-[hsl(var(--foreground))]"
                                            : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                                    )}
                                >
                                    {isSelected && (
                                        <motion.div
                                            layoutId="account-indicator"
                                            className="absolute inset-0 bg-[hsl(var(--background))] rounded-lg shadow-sm"
                                            transition={{ type: "spring", duration: 0.4, bounce: 0.15 }}
                                            style={{ zIndex: -1 }}
                                        />
                                    )}
                                    <div
                                        className={cn("w-2 h-2 rounded-full shrink-0", isSelected && "shadow-[0_0_8px_rgba(0,0,0,0.2)]")}
                                        style={{ backgroundColor: account.colorHex, boxShadow: isSelected ? `0 0 8px ${account.colorHex}66` : undefined }}
                                    />
                                    <span>{shortName}</span>
                                </button>
                            );
                        })}
                    </div>
                )}

                <ZoomViewSwitcher view={view} onViewChange={onViewChange} />
                
                {canBook && onBookMeeting && (
                    <Button onClick={onBookMeeting} size="sm" className="h-8 gap-1.5 font-medium ml-2 shadow-sm bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90">
                        <Plus className="h-4 w-4" />
                        <span className="hidden sm:inline">Book Meeting</span>
                        <span className="inline sm:hidden">Book</span>
                    </Button>
                )}
            </div>
        </div>
    );
}