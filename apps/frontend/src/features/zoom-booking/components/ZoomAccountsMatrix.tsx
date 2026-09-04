import { useMemo, useState, useRef } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, getDay, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Plus, Search, Filter, Calendar, Clock, X, Video, ExternalLink, Sparkles, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ZoomAccount } from '../types';
import type { MergedCalendarDay } from '../hooks/useZoomBooking';
import { useZoomSettings, isWorkingDay } from '../hooks/useZoomSettings';

interface AccountDayBooking {
    id: string;
    title: string;
    startTime: string;
    endTime?: string;
    joinUrl?: string;
    isMyBooking: boolean;
    bookedByName?: string;
    department?: string;
    email?: string;
    isDoubleBooking?: boolean;
}

interface ZoomAccountsMatrixProps {
    currentDate: Date;
    mergedDays: MergedCalendarDay[];
    accounts: ZoomAccount[];
    onBookingClick: (bookingId: string) => void;
    onCellClick?: (accountId: string, date: string) => void;
    canBook?: boolean;
}

const WEEKDAY_LABELS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

export function ZoomAccountsMatrix({
    currentDate,
    mergedDays,
    accounts,
    onBookingClick,
    onCellClick,
    canBook = true,
}: ZoomAccountsMatrixProps) {
    const days = useMemo(
        () => eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) }),
        [currentDate],
    );
    const { data: zoomSettings } = useZoomSettings();
    const workingDays = zoomSettings?.workingDays ?? [1, 2, 3, 4, 5];

    // Search and filter states
    const [accountSearch, setAccountSearch] = useState('');
    const [filterOnlyActive, setFilterOnlyActive] = useState(false);
    const [filterOnlyMyBookings, setFilterOnlyMyBookings] = useState(false);

    // Crosshair hover & active cell popover
    const [hovered, setHovered] = useState<{ accountId: string; date: string } | null>(null);
    const [selectedCell, setSelectedCell] = useState<{ accountId: string; date: string; alignRight?: boolean; alignTop?: boolean } | null>(null);

    // Build matrix data: accountId -> date -> bookings[]
    const { matrix, dailyTotals, accountTotals, myAccountTotals, myTotalMeetings, maxAccountMeetings } = useMemo(() => {
        const map = new Map<string, Map<string, AccountDayBooking[]>>();
        const dTotals = new Map<string, number>();
        const aTotals = new Map<string, number>();
        const myTotals = new Map<string, number>();
        let myTotalCount = 0;

        for (const a of accounts) {
            map.set(a.id, new Map());
            aTotals.set(a.id, 0);
            myTotals.set(a.id, 0);
        }

        for (const day of mergedDays) {
            let dayCount = 0;
            const seenInDay = new Set<string>();

            for (const slot of day.slots) {
                for (const b of slot.bookings) {
                    if (!seenInDay.has(b.id)) {
                        seenInDay.add(b.id);
                        dayCount++;
                    }

                    if (!map.has(b.zoomAccountId)) {
                        map.set(b.zoomAccountId, new Map());
                    }
                    const byDate = map.get(b.zoomAccountId)!;
                    if (!byDate.has(day.date)) {
                        byDate.set(day.date, []);
                    }
                    const list = byDate.get(day.date)!;
                    if (!list.some((x) => x.id === b.id)) {
                        const isMy = b.bookedBy === 'Saya' || slot.isMyBooking || (b as any).isMyBooking === true;
                        list.push({
                            id: b.id,
                            title: b.title,
                            startTime: b.startTime || slot.time,
                            endTime: (b as any).endTime,
                            joinUrl: isMy ? (b as any).joinUrl : undefined,
                            isMyBooking: isMy,
                            bookedByName: b.bookedBy === 'Saya' ? 'Saya' : b.bookedBy || (b as any).bookedByUser?.fullName,
                            department: (b as any).department,
                            email: (b as any).email,
                            isDoubleBooking: (b as any).isDoubleBooking,
                        });
                        aTotals.set(b.zoomAccountId, (aTotals.get(b.zoomAccountId) ?? 0) + 1);
                        if (isMy) {
                            myTotals.set(b.zoomAccountId, (myTotals.get(b.zoomAccountId) ?? 0) + 1);
                            myTotalCount++;
                        }
                    }
                }
            }
            dTotals.set(day.date, dayCount);
        }

        // Sort bookings by start time
        for (const byDate of map.values()) {
            for (const list of byDate.values()) {
                list.sort((a, b) => a.startTime.localeCompare(b.startTime));
            }
        }

        let maxMtgs = 1;
        for (const count of aTotals.values()) {
            if (count > maxMtgs) maxMtgs = count;
        }

        return {
            matrix: map,
            dailyTotals: dTotals,
            accountTotals: aTotals,
            myAccountTotals: myTotals,
            myTotalMeetings: myTotalCount,
            maxAccountMeetings: maxMtgs,
        };
    }, [mergedDays, accounts]);

    // Filter accounts based on search and active toggle (all accounts remain visible during personal bookings filter)
    const filteredAccounts = useMemo(() => {
        return accounts.filter((acc) => {
            const matchesSearch = acc.name.toLowerCase().includes(accountSearch.trim().toLowerCase());
            const total = accountTotals.get(acc.id) ?? 0;
            const matchesActive = !filterOnlyActive || total > 0;
            return matchesSearch && matchesActive;
        });
    }, [accounts, accountSearch, filterOnlyActive, accountTotals]);

    const totalMonthMeetings = useMemo(() => {
        let sum = 0;
        for (const count of accountTotals.values()) {
            sum += count;
        }
        return sum;
    }, [accountTotals]);

    const DAY_COL_WIDTH = 38; // px, optimized for dense readability & fitting month on desktop
    const LABEL_WIDTH = 155;  // px, accommodates account dot, name & monthly badges

    // Active selected cell details for popover
    const activePopoverData = useMemo(() => {
        if (!selectedCell) return null;
        const account = accounts.find((a) => a.id === selectedCell.accountId);
        const byDate = matrix.get(selectedCell.accountId);
        const rawBookings = byDate?.get(selectedCell.date) ?? [];
        const bookings: AccountDayBooking[] = filterOnlyMyBookings
            ? rawBookings.filter((b: AccountDayBooking) => b.isMyBooking)
            : rawBookings;
        return {
            account,
            date: selectedCell.date,
            bookings,
            alignRight: selectedCell.alignRight,
            alignTop: selectedCell.alignTop,
        };
    }, [selectedCell, accounts, matrix, filterOnlyMyBookings]);

    return (
        <div className="h-full flex flex-col bg-background select-none overflow-hidden">
            {/* 1. Control & Filter Toolbar */}
            <div className="shrink-0 px-4 py-2.5 border-b border-border bg-card/70 backdrop-blur-sm flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 flex-1 sm:flex-initial min-w-[200px]">
                    <div className="relative w-full sm:w-56">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        <input
                            type="text"
                            value={accountSearch}
                            onChange={(e) => setAccountSearch(e.target.value)}
                            placeholder="Cari akun Zoom..."
                            className="w-full h-7 pl-8 pr-7 text-xs bg-background border border-border/80 rounded-lg outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground shadow-2xs"
                        />
                        {accountSearch && (
                            <button
                                type="button"
                                onClick={() => setAccountSearch('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        )}
                    </div>

                    <Button
                        type="button"
                        variant={filterOnlyActive ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFilterOnlyActive(!filterOnlyActive)}
                        className={cn(
                            "h-7 px-2.5 text-xs font-bold rounded-lg gap-1.5 transition-all shadow-2xs cursor-pointer",
                            filterOnlyActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground border-border/80"
                        )}
                    >
                        <Filter className="w-3 h-3" />
                        <span>Hanya Ada Jadwal</span>
                    </Button>

                    <Button
                        type="button"
                        variant={filterOnlyMyBookings ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFilterOnlyMyBookings(!filterOnlyMyBookings)}
                        className={cn(
                            "h-7 px-2.5 text-xs font-bold rounded-lg gap-1.5 transition-all shadow-2xs cursor-pointer",
                            filterOnlyMyBookings
                                ? "bg-blue-600 text-white hover:bg-blue-700 ring-2 ring-blue-400/30"
                                : "text-muted-foreground hover:text-foreground border-border/80"
                        )}
                        title="Hanya tampilkan jadwal meeting milik Anda (seluruh 10 akun tetap ditampilkan)"
                    >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Hanya Meeting Saya</span>
                        {myTotalMeetings > 0 && (
                            <span
                                className={cn(
                                    "ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold",
                                    filterOnlyMyBookings ? "bg-white/20 text-white" : "bg-primary/10 text-primary"
                                )}
                            >
                                {myTotalMeetings}
                            </span>
                        )}
                    </Button>
                </div>

                <div className="flex items-center gap-3 text-xs">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/50 border border-border/70 text-muted-foreground font-medium">
                        <span>Menampilkan:</span>
                        <strong className="text-foreground font-bold">{filteredAccounts.length}/{accounts.length} Akun</strong>
                        <span>·</span>
                        <strong className={cn("font-bold", filterOnlyMyBookings ? "text-blue-600 dark:text-blue-400" : "text-primary")}>
                            {filterOnlyMyBookings
                                ? `${myTotalMeetings} Meeting Saya (dari ${totalMonthMeetings} Total)`
                                : `${totalMonthMeetings} Meeting Bulan Ini`}
                        </strong>
                    </div>

                    <div className="hidden md:flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-xs bg-primary" />
                            <span>Meeting</span>
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-xs bg-primary ring-2 ring-primary/40 ring-offset-1" />
                            <span>Meeting Saya</span>
                        </span>
                    </div>
                </div>
            </div>

            {/* 2. Scrollable Matrix Grid */}
            <div className="flex-1 min-h-0 overflow-auto custom-scrollbar relative">
                <div style={{ minWidth: LABEL_WIDTH + days.length * DAY_COL_WIDTH }}>
                    {/* Header Row: Month / Account & Day Columns */}
                    <div className="sticky top-0 z-30 flex bg-card border-b border-border shadow-xs">
                        {/* Top Left Header Cell */}
                        <div
                            className="shrink-0 sticky left-0 z-40 bg-card border-r border-border px-2.5 py-2 flex flex-col justify-center shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)] dark:shadow-none"
                            style={{ width: LABEL_WIDTH }}
                        >
                            <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                                Akun Zoom
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                                {format(currentDate, 'MMMM yyyy', { locale: idLocale })}
                            </span>
                        </div>

                        {/* Day Column Headers */}
                        {days.map((d, dayIdx) => {
                            const dateStr = format(d, 'yyyy-MM-dd');
                            const weekend = !isWorkingDay(d, workingDays);
                            const today = isToday(d);
                            const isColHovered = hovered?.date === dateStr;
                            const dailyCount = dailyTotals.get(dateStr) ?? 0;

                            return (
                                <div
                                    key={d.toISOString()}
                                    className={cn(
                                        'shrink-0 flex flex-col items-center justify-between py-1.5 border-r border-border/60 transition-colors',
                                        weekend ? 'bg-muted/40' : 'bg-card',
                                        isColHovered && 'bg-primary/10',
                                        today && 'border-primary/40'
                                    )}
                                    style={{ width: DAY_COL_WIDTH }}
                                >
                                    <span className={cn(
                                        'text-[10px] uppercase font-bold leading-none',
                                        weekend ? 'text-muted-foreground/50' : 'text-muted-foreground',
                                        isColHovered && 'text-primary'
                                    )}>
                                        {WEEKDAY_LABELS[(getDay(d) + 6) % 7]}
                                    </span>

                                    <span className={cn(
                                        'text-xs font-extrabold leading-tight my-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full transition-all',
                                        today
                                            ? 'bg-primary text-primary-foreground shadow-xs'
                                            : isColHovered
                                                ? 'bg-primary/20 text-primary font-black'
                                                : weekend
                                                    ? 'text-muted-foreground/60'
                                                    : 'text-foreground'
                                    )}>
                                        {format(d, 'd')}
                                    </span>

                                    {/* Daily Load Count Badge */}
                                    <span className={cn(
                                        'text-[9px] font-mono font-bold px-1 rounded-sm transition-all',
                                        dailyCount > 0
                                            ? 'bg-primary/15 text-primary border border-primary/20'
                                            : 'text-muted-foreground/30'
                                    )}>
                                        {dailyCount > 0 ? dailyCount : '-'}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Account Rows */}
                    {filteredAccounts.map((account, accIdx) => {
                        const byDate = matrix.get(account.id);
                        const totalAccountMeetings = accountTotals.get(account.id) ?? 0;
                        const myAccountMeetings = myAccountTotals.get(account.id) ?? 0;
                        const isRowHovered = hovered?.accountId === account.id;

                        return (
                            <div
                                key={account.id}
                                className={cn(
                                    'flex border-b border-border/60 transition-colors group/row',
                                    isRowHovered ? 'bg-primary/5' : 'hover:bg-muted/30',
                                    filterOnlyMyBookings && myAccountMeetings > 0 && 'bg-blue-50/20 dark:bg-blue-950/15'
                                )}
                            >
                                {/* Sticky Account Label Column */}
                                <div
                                    className={cn(
                                        'shrink-0 sticky left-0 z-20 bg-card border-r border-border px-2.5 py-2 flex items-center justify-between gap-1.5 transition-colors shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)] dark:shadow-none',
                                        isRowHovered && 'bg-primary/10',
                                        filterOnlyMyBookings && myAccountMeetings > 0 && 'border-l-3 border-l-blue-600 bg-blue-50/30 dark:bg-blue-950/25'
                                    )}
                                    style={{ width: LABEL_WIDTH }}
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span
                                            className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs ring-2 ring-background"
                                            style={{ backgroundColor: account.colorHex }}
                                            aria-hidden="true"
                                        />
                                        <span className="text-xs font-bold text-foreground truncate" title={account.name}>
                                            {account.name}
                                        </span>
                                    </div>

                                    {/* Total monthly count for this account */}
                                    {filterOnlyMyBookings ? (
                                        <span
                                            className={cn(
                                                "text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md shrink-0 transition-all",
                                                myAccountMeetings > 0
                                                    ? "bg-blue-600 text-white shadow-2xs"
                                                    : "bg-muted text-muted-foreground/40"
                                            )}
                                            title={`${myAccountMeetings} meeting Anda di akun ini`}
                                        >
                                            {myAccountMeetings} Saya
                                        </span>
                                    ) : (
                                        <span
                                            className={cn(
                                                "text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md shrink-0 transition-all",
                                                totalAccountMeetings > 0
                                                    ? "bg-muted text-foreground border border-border/80"
                                                    : "text-muted-foreground/40"
                                            )}
                                            title={`${totalAccountMeetings} meeting bulan ini`}
                                        >
                                            {totalAccountMeetings}
                                        </span>
                                    )}
                                </div>

                                {/* Day Cells for Account */}
                                {days.map((d, dayIdx) => {
                                    const dateStr = format(d, 'yyyy-MM-dd');
                                    const allCellBookings = byDate?.get(dateStr) ?? [];
                                    const bookings = filterOnlyMyBookings
                                        ? allCellBookings.filter((b) => b.isMyBooking)
                                        : allCellBookings;
                                    const weekend = !isWorkingDay(d, workingDays);
                                    const isCellHovered = hovered?.accountId === account.id && hovered?.date === dateStr;
                                    const isCrosshair = hovered?.accountId === account.id || hovered?.date === dateStr;
                                    const isSelected = selectedCell?.accountId === account.id && selectedCell?.date === dateStr;

                                    const colIndex = dayIdx;
                                    const alignRight = colIndex >= (days.length - 6);
                                    const alignTop = accIdx >= (filteredAccounts.length - 3);

                                    return (
                                        <div
                                            key={dateStr}
                                            className={cn(
                                                'shrink-0 relative border-r border-border/50 px-0.5 py-1 flex flex-col justify-center gap-1 min-h-[58px] transition-all cursor-pointer select-none',
                                                weekend && 'bg-muted/30',
                                                isCrosshair && !isCellHovered && 'bg-primary/[0.03]',
                                                isCellHovered && 'bg-primary/15 ring-1 ring-inset ring-primary/40 z-10',
                                                isSelected && 'bg-primary/20 ring-2 ring-primary z-20'
                                            )}
                                            style={{ width: DAY_COL_WIDTH }}
                                            onMouseEnter={() => setHovered({ accountId: account.id, date: dateStr })}
                                            onMouseLeave={() => setHovered(null)}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedCell(isSelected ? null : {
                                                    accountId: account.id,
                                                    date: dateStr,
                                                    alignRight,
                                                    alignTop,
                                                });
                                            }}
                                        >
                                            {/* Meeting Items in Cell */}
                                            {bookings.slice(0, 2).map((b) => (
                                                <button
                                                    key={b.id}
                                                    type="button"
                                                    title={`${b.startTime} · ${b.title}${b.isMyBooking ? ' (Bookingan Anda)' : ''}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onBookingClick(b.id);
                                                    }}
                                                    className={cn(
                                                        'w-full h-4.5 px-0.5 rounded-sm transition-all text-[9px] font-mono font-bold text-white flex items-center justify-center shadow-2xs hover:scale-105 hover:opacity-90',
                                                        b.isMyBooking && 'ring-2 ring-offset-0.5 ring-blue-500 font-black'
                                                    )}
                                                    style={{ backgroundColor: account.colorHex || '#3b82f6' }}
                                                >
                                                    <span className="truncate leading-none">
                                                        {b.startTime}
                                                    </span>
                                                </button>
                                            ))}

                                            {/* Overflow Indicator */}
                                            {bookings.length > 2 && (
                                                <span className="text-[9px] font-mono font-black text-primary leading-none text-center bg-primary/10 rounded py-0.2">
                                                    +{bookings.length - 2}
                                                </span>
                                            )}

                                            {/* Hover Prompt on Empty Cell */}
                                            {canBook && !weekend && bookings.length === 0 && isCellHovered && (
                                                <span className="absolute inset-0 flex items-center justify-center text-primary animate-in fade-in-0 zoom-in-75 duration-100">
                                                    <Plus className="w-4 h-4" />
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}

                    {filteredAccounts.length === 0 && (
                        <div className="p-16 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-2">
                            {filterOnlyMyBookings ? (
                                <>
                                    <UserCheck className="w-8 h-8 opacity-40 text-blue-500" />
                                    <p className="font-semibold text-foreground">
                                        Anda belum memiliki jadwal booking meeting di bulan ini.
                                    </p>
                                    <p className="text-xs text-muted-foreground max-w-sm">
                                        Klik pada sel tanggal yang diinginkan untuk membuat booking baru, atau matikan filter untuk melihat seluruh jadwal akun.
                                    </p>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                            setFilterOnlyMyBookings(false);
                                            setFilterOnlyActive(false);
                                            setAccountSearch('');
                                        }}
                                        className="mt-2 text-xs cursor-pointer"
                                    >
                                        Tampilkan Semua Jadwal
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <Video className="w-8 h-8 opacity-40" />
                                    <p className="font-semibold">Tidak ada akun Zoom yang cocok dengan filter.</p>
                                    {(accountSearch || filterOnlyActive) && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                                setAccountSearch('');
                                                setFilterOnlyActive(false);
                                            }}
                                            className="mt-2 text-xs cursor-pointer"
                                        >
                                            Reset Filter
                                        </Button>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* 3. Interactive Cell Popover Modal */}
            {activePopoverData && (
                <>
                    <div
                        className="fixed inset-0 z-40 bg-black/10 dark:bg-black/30 backdrop-blur-[0.5px]"
                        onClick={() => setSelectedCell(null)}
                    />
                    <div
                        className={cn(
                            "fixed z-50 w-80 sm:w-88 rounded-2xl shadow-2xl border",
                            "bg-card/95 backdrop-blur-md border-border select-none",
                            "animate-in fade-in-0 zoom-in-95 duration-150 flex flex-col max-h-[400px]",
                            "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                        )}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Popover Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-border/80 bg-muted/40 rounded-t-2xl shrink-0">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <span
                                    className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs ring-2 ring-background"
                                    style={{ backgroundColor: activePopoverData.account?.colorHex || '#3b82f6' }}
                                />
                                <div className="min-w-0">
                                    <div className="text-xs font-bold text-foreground truncate">
                                        {activePopoverData.account?.name || 'Zoom Account'}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground font-mono">
                                        {format(parseISO(activePopoverData.date), 'EEEE, d MMMM yyyy', { locale: idLocale })}
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedCell(null)}
                                className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Meetings List */}
                        <div className="p-3 space-y-2 overflow-y-auto custom-scrollbar flex-1 min-h-0">
                            {activePopoverData.bookings.length === 0 ? (
                                <div className="py-8 text-center text-xs text-muted-foreground space-y-2">
                                    <Calendar className="w-7 h-7 mx-auto opacity-30 text-primary" />
                                    <p className="font-semibold text-foreground">Tidak ada jadwal meeting</p>
                                    <p className="text-[11px]">Akun ini bebas sepanjang hari pada tanggal ini.</p>
                                </div>
                            ) : (
                                activePopoverData.bookings.map((booking: AccountDayBooking) => (
                                    <div
                                        key={booking.id}
                                        onClick={() => {
                                            setSelectedCell(null);
                                            onBookingClick(booking.id);
                                        }}
                                        className={cn(
                                            "w-full text-left p-2.5 rounded-xl text-xs font-medium cursor-pointer",
                                            "border border-border/80 bg-background hover:bg-muted/70 hover:border-primary/40 transition-all shadow-2xs group flex flex-col gap-1.5"
                                        )}
                                        style={{ borderLeftWidth: '3.5px', borderLeftColor: activePopoverData.account?.colorHex || '#3b82f6' }}
                                    >
                                        <div className="flex items-center justify-between gap-1.5">
                                            <span className="text-[11px] font-mono font-bold text-primary flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                <span>{booking.startTime}</span>
                                                {booking.endTime && <span className="text-muted-foreground/70">– {booking.endTime}</span>}
                                            </span>
                                            <div className="flex items-center gap-1">
                                                {booking.isDoubleBooking && (
                                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                                                        DOBEL
                                                    </span>
                                                )}
                                                {booking.isMyBooking ? (
                                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-primary/10 text-primary border border-primary/20">
                                                        SAYA
                                                    </span>
                                                ) : (
                                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-medium bg-muted text-muted-foreground truncate max-w-[120px]">
                                                        {booking.bookedByName || 'User Lain'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-xs font-bold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                                            {booking.title}
                                        </div>
                                        {!booking.isMyBooking && (
                                            <div className="text-[10px] text-muted-foreground flex items-center gap-1 pt-0.5">
                                                <span>Pem-booking:</span>
                                                <strong className="text-foreground">{booking.bookedByName || 'Pengguna Lain'}</strong>
                                                {booking.department && <span>({booking.department})</span>}
                                            </div>
                                        )}
                                        {booking.joinUrl && booking.isMyBooking && (
                                            <div className="flex items-center gap-1 text-[10px] text-primary/80 font-medium pt-0.5">
                                                <ExternalLink className="w-2.5 h-2.5" />
                                                <span>Link Zoom tersedia</span>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Popover Action Button */}
                        {canBook && (
                            <div className="p-3 border-t border-border/80 bg-muted/20 rounded-b-2xl shrink-0 flex items-center gap-2">
                                <Button
                                    size="sm"
                                    onClick={() => {
                                        const accId = activePopoverData.account?.id;
                                        const dt = activePopoverData.date;
                                        setSelectedCell(null);
                                        if (accId && dt) {
                                            onCellClick?.(accId, dt);
                                        }
                                    }}
                                    className="w-full h-8 text-xs font-bold gap-1.5 rounded-lg bg-primary text-primary-foreground shadow-xs cursor-pointer hover:opacity-95"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>+ Book di {activePopoverData.account?.name ?? 'Akun Ini'}</span>
                                </Button>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
