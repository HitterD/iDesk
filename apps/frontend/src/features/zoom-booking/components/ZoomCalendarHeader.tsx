import { useState } from 'react';
import { format, startOfWeek, endOfWeek, setMonth, setYear, getYear } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, ChevronDown, CalendarDays, Plus, Search, X, LayoutGrid, UserCheck, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ModernCalendar } from '@/components/ui/ModernCalendar';
import { cn } from '@/lib/utils';
import type { CalendarView, AccountScope } from '../hooks/useCalendarView';
import type { ZoomAccount } from '../types';

export type ZoomCalendarDisplayMode = 'calendar' | 'matrix' | 'my-bookings';

interface ZoomCalendarHeaderProps {
    view: CalendarView;
    currentDate: Date;
    selectedAccountId: string;
    accounts: ZoomAccount[];
    meetingsPerAccount?: Map<string, number>;
    onViewChange: (view: CalendarView) => void;
    activeMode?: ZoomCalendarDisplayMode;
    onModeChange?: (mode: ZoomCalendarDisplayMode) => void;
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
    isSidebarOpen?: boolean;
    onToggleSidebar?: () => void;
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
    meetingsPerAccount,
    canBook,
    onViewChange,
    activeMode,
    onModeChange,
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
    isSidebarOpen = true,
    onToggleSidebar,
    className,
}: ZoomCalendarHeaderProps) {
    const title = getHeaderTitle(view, currentDate);
    const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
    const [pickerYear, setPickerYear] = useState(getYear(currentDate));

    const showSearch = Boolean(searchQuery !== undefined && onSearchChange);

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
            "flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 px-1 py-0.5 bg-transparent select-none",
            className
        )}>
            {/* LEFT: Navigation controls & Date display */}
            <div className="flex items-center justify-between sm:justify-start gap-1.5 sm:gap-2">
                <div className="flex items-center gap-1.5 sm:gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onToday}
                        className="h-8 px-3.5 text-xs font-medium rounded-full border-border/80 hover:bg-muted"
                    >
                        Today
                    </Button>

                    <div className="flex items-center gap-0.5">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onPrev}
                            className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
                            aria-label="Previous"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onNext}
                            className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
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
                            className="h-9 flex items-center gap-1.5 text-lg sm:text-xl font-semibold tracking-tight text-foreground px-2 hover:bg-muted rounded-xl"
                        >
                                                        <span className="capitalize truncate max-w-[180px] sm:max-w-none">{title}</span>
                            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
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
                        className="h-8 gap-1 font-medium px-3 sm:hidden rounded-full bg-primary text-primary-foreground hover:opacity-95 cursor-pointer ml-auto"
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
                            className="h-8 w-full sm:w-[150px] lg:w-[200px] pl-8 pr-7 text-xs bg-muted border border-transparent rounded-full outline-none focus:bg-background focus:border-primary/40 focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground transition-all"
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

                {/* Unified Mode Switcher Tabs (Kalender Bulanan, Matriks Semua Akun, Bookingan Saya) */}
                <div className="shrink-0 flex items-center gap-0.5 bg-muted p-0.5 rounded-[10px]">
                    <button
                        type="button"
                        onClick={() => onModeChange ? onModeChange('calendar') : onViewChange('month')}
                        className={cn(
                            "flex items-center gap-1.5 px-2.5 sm:px-3 h-7 text-xs font-medium rounded-lg transition-all cursor-pointer outline-none",
                            (activeMode === 'calendar' || (!activeMode && view === 'month'))
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                        data-testid="mode-calendar"
                    >
                        <CalendarDays className="h-3.5 w-3.5" />
                        <span className="hidden md:inline">Kalender Bulanan</span>
                        <span className="md:hidden">Bulan</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => onModeChange ? onModeChange('matrix') : onViewChange('month')}
                        className={cn(
                            "flex items-center gap-1.5 px-2.5 sm:px-3 h-7 text-xs font-medium rounded-lg transition-all cursor-pointer outline-none",
                            activeMode === 'matrix'
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                        data-testid="mode-matrix"
                    >
                        <LayoutGrid className="h-3.5 w-3.5" />
                        <span className="hidden md:inline">Matriks Semua Akun</span>
                        <span className="md:hidden">Matriks</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => onModeChange ? onModeChange('my-bookings') : onViewChange('my-bookings')}
                        className={cn(
                            "flex items-center gap-1.5 px-2.5 sm:px-3 h-7 text-xs font-medium rounded-lg transition-all cursor-pointer outline-none",
                            (activeMode === 'my-bookings' || (!activeMode && view === 'my-bookings'))
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                        data-testid="mode-my-bookings"
                    >
                        <UserCheck className="h-3.5 w-3.5" />
                        <span className="hidden md:inline">Bookingan Saya</span>
                        <span className="md:hidden">Saya</span>
                    </button>
                </div>

                {/* Sidebar Toggle Button */}
                {onToggleSidebar && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onToggleSidebar}
                        className={cn(
                            "h-8 px-2.5 text-xs font-medium border-transparent rounded-full gap-1.5 transition-colors cursor-pointer shrink-0",
                            isSidebarOpen ? "bg-muted text-foreground" : "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                        title={isSidebarOpen ? "Sembunyikan Panel Samping" : "Tampilkan Panel Samping"}
                        aria-label="Toggle sidebar"
                        data-testid="sidebar-toggle"
                    >
                        {isSidebarOpen ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
                        <span className="hidden xl:inline">{isSidebarOpen ? 'Tutup Panel' : 'Buka Panel'}</span>
                    </Button>
                )}

                {/* Primary CTA (Desktop) */}
                {canBook && onBookMeeting && (
                    <Button
                        onClick={onBookMeeting}
                        size="sm"
                        className="h-8 gap-1.5 font-medium px-4 rounded-full bg-primary text-primary-foreground hover:opacity-95 cursor-pointer hidden sm:inline-flex shrink-0"
                    >
                        <Plus className="h-4 w-4" />
                        <span>Book Meeting</span>
                    </Button>
                )}
            </div>
        </div>
    );
}