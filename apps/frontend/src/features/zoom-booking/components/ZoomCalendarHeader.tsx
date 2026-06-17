import { useState } from 'react';
import { format, startOfWeek, endOfWeek, setMonth, setYear, getYear } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CalendarDays, ListTodo, Plus, Globe, Users, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ZoomViewSwitcher } from './ZoomViewSwitcher';
import { ZoomAccountSwitcher, GABUNGAN_ID } from './ZoomAccountSwitcher';
import { ModernCalendar } from '@/components/ui/ModernCalendar';
import { cn } from '@/lib/utils';
import type { CalendarView, AccountScope } from '../hooks/useCalendarView';
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
    /** Optional: when provided, header also renders the Gabungan + 10-account switcher modal */
    accountScope?: AccountScope;
    onAccountScopeChange?: (scope: AccountScope) => void;
    /** Optional: live search filter value + onChange */
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
                {/* Live search filter */}
                {showSearch && (
                    <div className="relative">
                        <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden="true" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => onSearchChange!(e.target.value)}
                            placeholder="Cari meeting…"
                            aria-label="Cari meeting"
                            data-testid="calendar-search-input"
                            className="h-8 w-[200px] pl-8 pr-7 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md outline-none focus:ring-2 focus:ring-blue-400/30"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => onSearchChange!('')}
                                aria-label="Clear search"
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                <X className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                        )}
                    </div>
                )}

                {/* Switcher trigger (Gabungan + 10 accounts) */}
                {showSwitcher && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsSwitcherOpen(true)}
                        className="h-8 gap-1.5 text-xs font-semibold"
                        aria-label="Switch Zoom account"
                        data-testid="open-account-switcher"
                    >
                        {accountScope === GABUNGAN_ID ? (
                            <Globe className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                        ) : currentColor ? (
                            <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: currentColor }}
                                aria-hidden="true"
                            />
                        ) : (
                            <Users className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        <span className="max-w-[120px] truncate">{currentLabel ?? 'Pilih akun'}</span>
                        <ChevronRight className="h-3 w-3 rotate-90 opacity-50" aria-hidden="true" />
                    </Button>
                )}

                {accounts.length > 1 && !showSwitcher && (
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