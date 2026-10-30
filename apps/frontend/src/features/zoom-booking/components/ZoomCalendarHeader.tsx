import { useState } from 'react';
import { format, startOfWeek, endOfWeek, setMonth, setYear, getYear } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, ChevronDown, CalendarDays, CalendarRange, Grid3x3, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ModernCalendar } from '@/components/ui/ModernCalendar';
import { SegmentedControl, type SegmentedOption } from '@/components/ui/segmented-control';
import { ResSearch } from '@/components/resources/ResourceParts';
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
    /** @deprecated the side panel is always shown (mockup zoom.html). */
    isSidebarOpen?: boolean;
    /** @deprecated */
    onToggleSidebar?: () => void;
    /** Extra filter controls (Akun pop, Hanya Meeting Saya) rendered after the search field. */
    filters?: React.ReactNode;
    className?: string;
}

/** Segments: mockup Minggu | Matriks Semua Akun | Bookingan Saya, plus production month view. */
type Segment = 'day' | 'week' | 'month' | 'matrix' | 'my-bookings';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];

function getHeaderTitle(view: CalendarView, date: Date): string {
    switch (view) {
        case 'month':
            return format(date, 'MMMM yyyy', { locale: idLocale });
        case 'week': {
            const weekStart = startOfWeek(date, { weekStartsOn: 1 });
            const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
            if (weekStart.getMonth() === weekEnd.getMonth()) {
                return `${format(weekStart, 'd', { locale: idLocale })} – ${format(weekEnd, 'd MMMM yyyy', { locale: idLocale })}`;
            }
            return `${format(weekStart, 'd MMM', { locale: idLocale })} – ${format(weekEnd, 'd MMM yyyy', { locale: idLocale })}`;
        }
        case 'day':
            return format(date, 'EEEE, d MMMM yyyy', { locale: idLocale });
        case 'my-bookings':
            return 'Bookingan Saya';
    }
}

const segmentOf = (view: CalendarView, mode?: ZoomCalendarDisplayMode): Segment => {
    if (mode === 'my-bookings' || view === 'my-bookings') return 'my-bookings';
    if (mode === 'matrix') return 'matrix';
    if (view === 'day') return 'day';
    return view === 'month' ? 'month' : 'week';
};

/** Mockup zoom.html `.filters`: week nav, date title (picker), mode segments, search and filters. */
export function ZoomCalendarHeader({
    view, currentDate, activeMode, onModeChange, onViewChange, onPrev, onNext, onToday,
    onNavigateToDate, searchQuery, onSearchChange, filters, className,
}: ZoomCalendarHeaderProps) {
    const title = getHeaderTitle(view, currentDate);
    const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
    const [pickerYear, setPickerYear] = useState(getYear(currentDate));
    const showSearch = Boolean(searchQuery !== undefined && onSearchChange);
    const navigable = view !== 'my-bookings';

    const handleMonthSelect = (monthIndex: number) => {
        onNavigateToDate(setMonth(setYear(currentDate, pickerYear), monthIndex));
        setIsMonthPickerOpen(false);
    };

    const options: SegmentedOption<Segment>[] = [
        // Day view (reached by double-clicking a month day) gets its own segment so it is never shown as "Minggu".
        ...(view === 'day' ? [{ value: 'day' as const, label: 'Hari', icon: CalendarDays }] : []),
        { value: 'week', label: 'Minggu', icon: CalendarDays },
        { value: 'month', label: 'Bulan', icon: CalendarRange },
        { value: 'matrix', label: 'Matriks Semua Akun', icon: Grid3x3 },
        { value: 'my-bookings', label: 'Bookingan Saya', icon: UserRound },
    ];
    const select = (segment: Segment) => {
        if (segment === 'matrix') return onModeChange ? onModeChange('matrix') : onViewChange('month');
        if (segment === 'my-bookings') return onModeChange ? onModeChange('my-bookings') : onViewChange('my-bookings');
        onModeChange?.('calendar');
        onViewChange(segment);
    };

    return (
        <div className={cn('res-filters', className)}>
            {navigable && (
                <>
                    <button type="button" className="res-back" onClick={onPrev} aria-label="Sebelumnya"><ChevronLeft aria-hidden="true" /></button>
                    <Button variant="soft" onClick={onToday}>Today</Button>
                    <button type="button" className="res-back" onClick={onNext} aria-label="Berikutnya"><ChevronRight aria-hidden="true" /></button>
                </>
            )}
            <Popover open={isMonthPickerOpen} onOpenChange={setIsMonthPickerOpen}>
                <PopoverTrigger asChild>
                    <button type="button" className="zm-title" disabled={!navigable} aria-label={`Pilih tanggal: ${title}`}>
                        <span className="capitalize truncate">{title}</span>
                        {navigable && <ChevronDown aria-hidden="true" />}
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-3 rounded-2xl" align="start">
                    {view === 'month' ? (
                        <div className="w-64">
                            <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
                                <button type="button" className="res-icon-btn" onClick={() => setPickerYear((y) => y - 1)} aria-label="Tahun sebelumnya"><ChevronLeft aria-hidden="true" /></button>
                                <div className="font-semibold text-sm">{pickerYear}</div>
                                <button type="button" className="res-icon-btn" onClick={() => setPickerYear((y) => y + 1)} aria-label="Tahun berikutnya"><ChevronRight aria-hidden="true" /></button>
                            </div>
                            <div className="grid grid-cols-3 gap-1.5">
                                {MONTHS.map((month, idx) => {
                                    const current = currentDate.getMonth() === idx && currentDate.getFullYear() === pickerYear;
                                    return <Button key={month} variant={current ? 'primary' : 'subtle'} onClick={() => handleMonthSelect(idx)}>{month}</Button>;
                                })}
                            </div>
                        </div>
                    ) : (
                        <ModernCalendar selected={currentDate} onSelect={(date) => { onNavigateToDate(date); setIsMonthPickerOpen(false); }} />
                    )}
                </PopoverContent>
            </Popover>
            <SegmentedControl aria-label="Mode tampilan" className="dash-seg" options={options} value={segmentOf(view, activeMode)} onValueChange={select} />
            {showSearch && (
                <ResSearch id="zoom-search" className="max-w-[260px]" value={searchQuery ?? ''} onChange={(q) => onSearchChange?.(q)} placeholder="Cari meeting…" label="Cari meeting" />
            )}
            {filters}
        </div>
    );
}
