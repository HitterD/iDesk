import { useState } from 'react';
import { format, startOfWeek, endOfWeek, setMonth, setYear, getYear } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CalendarDays, ListTodo, Plus, Globe, Users, Search, X, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ZoomViewSwitcher } from './ZoomViewSwitcher';
import { ZoomAccountSwitcher, GABUNGAN_ID } from './ZoomAccountSwitcher';
import { ModernCalendar } from '@/components/ui/ModernCalendar';
import { cn } from '@/lib/utils';
import type { CalendarView, AccountScope } from '../hooks/useCalendarView';
import type { ZoomAccount } from '../types';

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
    accountScope?: AccountScope;
    onAccountScopeChange?: (scope: AccountScope) => void;
    searchQuery?: string;
    onSearchChange?: (q: string) => void;
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
    accountScope,
    onAccountScopeChange,
    searchQuery,
    onSearchChange,
    onBookMeeting,
    className,
}: ZoomCalendarHeaderProps) {
    const title = getHeaderTitle(view, currentDate);
    const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
    const [pickerYear, setPickerYear] = useState(getYear(currentDate));
    const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);

    const showSwitcher = Boolean(accountScope !== undefined && onAccountScopeChange);
    const showSearch = Boolean(searchQuery !== undefined && onSearchChange);

    const currentLabel =
        accountScope === undefined
            ? null
            : accountScope === GABUNGAN_ID
                ? 'Gabungan'
                : accounts.find((a) => a.id === accountScope)?.name ?? accountScope;
    const currentColor =
        accountScope && accountScope !== GABUNGAN_ID
            ? accounts.find((a) => a.id === accountScope)?.colorHex
            : undefined;

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
            "flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 p-2.5 sm:p-3 bg-card border-b border-border select-none",
            className
        )}>
            {/* LEFT: Navigation controls & Date display */}
            <div className="flex items-center justify-between sm:justify-start gap-1.5 sm:gap-2">
                <div className="flex items-center gap-1.5 sm:gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onToday}
                        className="h-8 px-2.5 sm:px-3 text-xs font-bold rounded-lg border-border/80 shadow-2xs hover:bg-muted"
                    >
                        Today
                    </Button>

                    <div className="flex items-center border border-border/80 rounded-lg overflow-hidden bg-background shadow-2xs">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onPrev}
                            className="h-8 w-7 sm:w-8 rounded-none border-r border-border/60 hover:bg-muted"
                            aria-label="Previous"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onNext}
                            className="h-8 w-7 sm:w-8 rounded-none hover:bg-muted"
                            aria-label="Next"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <Popover open={isMonthPickerOpen} onOpenChange={setIsMonthPickerOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 flex items-center gap-1.5 text-xs sm:text-sm font-bold text-foreground px-2 hover:bg-muted rounded-lg"
                        >
                            <CalendarDays className="h-4 w-4 text-primary shrink-0" />
                            <span className="capitalize truncate max-w-[140px] sm:max-w-none">{title}</span>
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-3 rounded-2xl shadow-xl border-border bg-card" align="start">
                        {view === 'month' ? (
                            <div className="w-64">
                                <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
                                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => setPickerYear(y => y - 1)}>
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <div className="font-bold text-sm text-foreground">{pickerYear}</div>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => setPickerYear(y => y + 1)}>
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                                <div className="grid grid-cols-3 gap-1.5">
                                    {MONTHS.map((month, idx) => {
                                        const isCurrentMonth = currentDate.getMonth() === idx && currentDate.getFullYear() === pickerYear;
                                        return (
                                            <Button
                                                key={month}
                                                variant={isCurrentMonth ? "default" : "ghost"}
                                                size="sm"
                                                onClick={() => handleMonthSelect(idx)}
                                                className={cn("h-8 text-xs font-semibold rounded-lg", isCurrentMonth && "bg-primary text-primary-foreground font-bold")}
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

                {/* Primary CTA on mobile (Row 1) */}
                {canBook && onBookMeeting && (
                    <Button
                        onClick={onBookMeeting}
                        size="sm"
                        className="h-8 gap-1 font-bold px-2.5 sm:hidden rounded-lg shadow-xs bg-primary text-primary-foreground hover:opacity-95 cursor-pointer ml-auto"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Book</span>
                    </Button>
                )}
            </div>

            {/* RIGHT: Search, Account Switcher, View Switcher & Action CTA */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5 sm:pb-0">
                {/* Search Bar */}
                {showSearch && (
                    <div className="relative flex-1 sm:flex-initial">
                        <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" aria-hidden="true" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => onSearchChange!(e.target.value)}
                            placeholder="Cari meeting…"
                            aria-label="Cari meeting"
                            data-testid="calendar-search-input"
                            className="h-8 w-full sm:w-[150px] lg:w-[190px] pl-8 pr-7 text-xs bg-background border border-border/80 rounded-lg outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground shadow-2xs transition-all"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => onSearchChange!('')}
                                aria-label="Clear search"
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground rounded transition-colors cursor-pointer"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                )}

                {/* Account Switcher Button */}
                {showSwitcher && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsSwitcherOpen(true)}
                        className="h-8 gap-1.5 text-xs font-bold border-border/80 rounded-lg shadow-2xs hover:bg-muted shrink-0"
                        aria-label="Switch Zoom account"
                        data-testid="open-account-switcher"
                    >
                        {accountScope === GABUNGAN_ID ? (
                            <Globe className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                        ) : currentColor ? (
                            <span
                                className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                                style={{ backgroundColor: currentColor }}
                                aria-hidden="true"
                            />
                        ) : (
                            <Users className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                        )}
                        <span className="max-w-[80px] sm:max-w-[110px] truncate">{currentLabel ?? 'Pilih akun'}</span>
                        <ChevronRight className="h-3 w-3 rotate-90 text-muted-foreground/60" aria-hidden="true" />
                    </Button>
                )}

                {/* View Switcher Tabs (Month, Week, Day, My Bookings) */}
                <div className="shrink-0">
                    <ZoomViewSwitcher view={view} onViewChange={onViewChange} />
                </div>

                {/* Primary CTA (Desktop) */}
                {canBook && onBookMeeting && (
                    <Button
                        onClick={onBookMeeting}
                        size="sm"
                        className="h-8 gap-1.5 font-bold px-3 rounded-lg shadow-sm bg-primary text-primary-foreground hover:opacity-95 cursor-pointer hidden sm:inline-flex shrink-0"
                    >
                        <Plus className="h-4 w-4" />
                        <span>Book Meeting</span>
                    </Button>
                )}
            </div>

            {/* Account switcher modal */}
            {showSwitcher && (
                <ZoomAccountSwitcher
                    open={isSwitcherOpen}
                    accounts={accounts.map((a) => ({
                        id: a.id,
                        name: a.name,
                        colorHex: a.colorHex ?? '#3b82f6',
                        meetingsAtTime: 0,
                    }))}
                    currentAccountId={accountScope!}
                    onSelect={(id) => {
                        onAccountScopeChange!(id as AccountScope);
                        setIsSwitcherOpen(false);
                    }}
                    onClose={() => setIsSwitcherOpen(false)}
                />
            )}
        </div>
    );
}