import { useEffect, useMemo, useRef, useState } from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, getDay, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Plus, Search, X, Video, ChevronRight, CalendarCheck } from 'lucide-react';
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
    durationMinutes?: number;
    joinUrl?: string;
    isMyBooking: boolean;
    bookedByName?: string;
    department?: string;
    email?: string;
    isDoubleBooking?: boolean;
}

function computeEndTime(startTime: string, endTime?: string, durationMinutes?: number): string {
    if (endTime) return endTime.slice(0, 5);
    if (!startTime) return '';
    const dur = durationMinutes || 60;
    const [h, m] = startTime.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return '';
    const total = h * 60 + m + dur;
    const endH = Math.floor(total / 60) % 24;
    const endM = total % 60;
    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
}

function formatHumanDuration(durationMinutes?: number): string {
    if (!durationMinutes || durationMinutes <= 0) return '';
    const hours = Math.floor(durationMinutes / 60);
    const mins = durationMinutes % 60;
    if (hours > 0 && mins > 0) return `${hours} jam ${mins} mnt`;
    if (hours > 0) return `${hours} jam`;
    return `${mins} mnt`;
}

interface ZoomAccountsMatrixProps {
    currentDate: Date;
    mergedDays: MergedCalendarDay[];
    accounts: ZoomAccount[];
    onBookingClick: (bookingId: string) => void;
    onCellClick?: (accountId: string, date: string) => void;
    canBook?: boolean;
}

type MatrixFilter = 'all' | 'active' | 'mine';

const FILTER_OPTIONS: { key: MatrixFilter; label: string }[] = [
    { key: 'all', label: 'Semua' },
    { key: 'active', label: 'Ada jadwal' },
    { key: 'mine', label: 'Punya saya' },
];

const WEEKDAY_LABELS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const LABEL_WIDTH = 152;
/** Day columns stretch to fill the width; below this they scroll horizontally. */
const MIN_DAY_COL_WIDTH = 38;
/** Rows stretch to fill the visible height but never shrink below this. */
const ROW_MIN_HEIGHT = 36;
const HEADER_HEIGHT = 44;
const PILL_HEIGHT = 18;
const PILL_GAP = 2;
const CELL_PAD_Y = 2;
const OVERFLOW_LINE_HEIGHT = 10;

/** How many pills fit in a cell of the given height, reserving a "+N" line when needed. */
export function visiblePillCount(rowHeight: number, total: number): number {
    const usable = rowHeight - CELL_PAD_Y * 2 + PILL_GAP;
    const capacity = Math.max(1, Math.floor(usable / (PILL_HEIGHT + PILL_GAP)));
    if (total <= capacity) return total;
    return Math.max(1, Math.floor((usable - OVERFLOW_LINE_HEIGHT) / (PILL_HEIGHT + PILL_GAP)));
}
const FALLBACK_COLOR = '#8E8E93';

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

    const [accountSearch, setAccountSearch] = useState('');
    const [filter, setFilter] = useState<MatrixFilter>('all');
    const onlyMine = filter === 'mine';

    const [hovered, setHovered] = useState<{ accountId: string; date: string } | null>(null);
    const [selectedCell, setSelectedCell] = useState<{ accountId: string; date: string; anchor: HTMLElement } | null>(null);

    // Track the grid viewport so rows can fill it top to bottom.
    const scrollRef = useRef<HTMLDivElement>(null);
    const [viewportHeight, setViewportHeight] = useState(0);
    useEffect(() => {
        const el = scrollRef.current;
        if (!el || typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(([entry]) => setViewportHeight(entry.contentRect.height));
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    // Build matrix data: accountId -> date -> bookings[]
    const { matrix, dailyTotals, accountTotals, myAccountTotals, myTotalMeetings } = useMemo(() => {
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
            const seenInDay = new Set<string>();

            for (const slot of day.slots) {
                for (const b of slot.bookings) {
                    seenInDay.add(b.id);

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
                            durationMinutes: (b as any).durationMinutes,
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
            dTotals.set(day.date, seenInDay.size);
        }

        for (const byDate of map.values()) {
            for (const list of byDate.values()) {
                list.sort((a, b) => a.startTime.localeCompare(b.startTime));
            }
        }

        return {
            matrix: map,
            dailyTotals: dTotals,
            accountTotals: aTotals,
            myAccountTotals: myTotals,
            myTotalMeetings: myTotalCount,
        };
    }, [mergedDays, accounts]);

    const filteredAccounts = useMemo(() => {
        const q = accountSearch.trim().toLowerCase();
        return accounts.filter((acc) => {
            const matchesSearch = acc.name.toLowerCase().includes(q);
            const matchesActive = filter !== 'active' || (accountTotals.get(acc.id) ?? 0) > 0;
            return matchesSearch && matchesActive;
        });
    }, [accounts, accountSearch, filter, accountTotals]);

    const totalMonthMeetings = useMemo(() => {
        let sum = 0;
        for (const count of accountTotals.values()) sum += count;
        return sum;
    }, [accountTotals]);

    const gridTemplateColumns = `${LABEL_WIDTH}px repeat(${days.length}, minmax(${MIN_DAY_COL_WIDTH}px, 1fr))`;

    const visibleBookings = (accountId: string, dateStr: string): AccountDayBooking[] => {
        const all = matrix.get(accountId)?.get(dateStr) ?? [];
        return onlyMine ? all.filter((b) => b.isMyBooking) : all;
    };

    const activePopoverData = useMemo(() => {
        if (!selectedCell) return null;
        const account = accounts.find((a) => a.id === selectedCell.accountId);
        const all = matrix.get(selectedCell.accountId)?.get(selectedCell.date) ?? [];
        return {
            account,
            date: selectedCell.date,
            bookings: onlyMine ? all.filter((b) => b.isMyBooking) : all,
        };
    }, [selectedCell, accounts, matrix, onlyMine]);

    const rowCount = filteredAccounts.length;
    // Each row carries a 1px bottom border.
    const rowHeight = rowCount > 0
        ? Math.max(ROW_MIN_HEIGHT, Math.floor((viewportHeight - HEADER_HEIGHT - rowCount) / rowCount))
        : ROW_MIN_HEIGHT;

    const resetFilters = () => {
        setFilter('all');
        setAccountSearch('');
    };

    const toggleCell = (accountId: string, date: string, anchor: HTMLElement) => {
        setSelectedCell((prev) =>
            prev?.accountId === accountId && prev?.date === date ? null : { accountId, date, anchor },
        );
    };

    return (
        <div className="h-full flex-1 min-h-0 flex flex-col bg-background select-none overflow-hidden">
            {/* 1. Toolbar: search · segmented filter · quiet summary */}
            <div className="shrink-0 px-3 py-2 border-b border-border/60 flex flex-wrap items-center gap-2.5 text-xs">
                <div className="relative w-full sm:w-52">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <input
                        type="text"
                        value={accountSearch}
                        onChange={(e) => setAccountSearch(e.target.value)}
                        placeholder="Cari akun"
                        aria-label="Cari akun Zoom"
                        className="w-full h-7 pl-8 pr-7 text-xs bg-muted/70 rounded-full outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
                    />
                    {accountSearch && (
                        <button
                            type="button"
                            onClick={() => setAccountSearch('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                            aria-label="Hapus pencarian"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    )}
                </div>

                <div role="radiogroup" aria-label="Filter matriks" className="flex items-center bg-muted p-0.5 rounded-[10px]">
                    {FILTER_OPTIONS.map((opt) => {
                        const active = filter === opt.key;
                        return (
                            <button
                                key={opt.key}
                                type="button"
                                role="radio"
                                aria-checked={active}
                                onClick={() => setFilter(opt.key)}
                                className={cn(
                                    'h-6 px-3 rounded-lg text-xs font-medium transition-all cursor-pointer',
                                    active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                                )}
                            >
                                {opt.label}
                                {opt.key === 'mine' && myTotalMeetings > 0 && (
                                    <span className="ml-1 tabular-nums text-muted-foreground">{myTotalMeetings}</span>
                                )}
                            </button>
                        );
                    })}
                </div>

                <span className="ml-auto text-muted-foreground tabular-nums">
                    {filteredAccounts.length} dari {accounts.length} akun ·{' '}
                    {onlyMine ? `${myTotalMeetings} meeting Anda` : `${totalMonthMeetings} meeting bulan ini`}
                </span>
            </div>

            {/* 2. Grid — columns stretch to fit the month, scroll only when too narrow */}
            <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto custom-scrollbar relative">
                <div style={{ minWidth: LABEL_WIDTH + days.length * MIN_DAY_COL_WIDTH }}>
                    {/* Header row */}
                    <div className="sticky top-0 z-30 grid bg-background/95 backdrop-blur border-b border-border/60" style={{ gridTemplateColumns, height: HEADER_HEIGHT }}>
                        <div className="sticky left-0 z-40 bg-background px-3 flex items-end pb-1.5 border-r border-border/60">
                            <span className="text-[11px] font-medium text-muted-foreground">Akun</span>
                        </div>

                        {days.map((d) => {
                            const dateStr = format(d, 'yyyy-MM-dd');
                            const offDay = !isWorkingDay(d, workingDays);
                            const today = isToday(d);
                            const dailyCount = dailyTotals.get(dateStr) ?? 0;

                            return (
                                <div
                                    key={dateStr}
                                    data-testid={`matrix-day-${dateStr}`}
                                    title={`${format(d, 'EEEE, d MMMM', { locale: idLocale })} · ${dailyCount} meeting`}
                                    className={cn(
                                        'flex flex-col items-center py-1 transition-colors',
                                        offDay && 'bg-muted/50',
                                        hovered?.date === dateStr && 'bg-muted',
                                        today && 'bg-primary/[0.07] dark:bg-primary/10',
                                    )}
                                >
                                    <span className={cn('text-[9px] font-medium leading-tight', offDay ? 'text-muted-foreground/60' : 'text-muted-foreground')}>
                                        {WEEKDAY_LABELS[(getDay(d) + 6) % 7]}
                                    </span>
                                    <span
                                        className={cn(
                                            'inline-flex items-center justify-center w-5 h-5 rounded-full text-xs tabular-nums',
                                            today
                                                ? 'bg-primary text-primary-foreground font-semibold'
                                                : offDay
                                                    ? 'text-muted-foreground/60'
                                                    : 'text-foreground font-medium',
                                        )}
                                    >
                                        {format(d, 'd')}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Account rows */}
                    {filteredAccounts.map((account) => {
                        const color = account.colorHex || FALLBACK_COLOR;
                        const accountCount = onlyMine ? myAccountTotals.get(account.id) ?? 0 : accountTotals.get(account.id) ?? 0;
                        const isRowHovered = hovered?.accountId === account.id;

                        return (
                            <div
                                key={account.id}
                                data-testid={`matrix-row-${account.id}`}
                                className="grid border-b border-border/40"
                                style={{ gridTemplateColumns }}
                            >
                                <div
                                    className={cn(
                                        'sticky left-0 z-20 bg-background border-r border-border/60 px-3 flex items-center gap-2 min-w-0 transition-colors',
                                        isRowHovered && 'bg-muted',
                                    )}
                                >
                                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} aria-hidden="true" />
                                    <span className="flex-1 min-w-0 text-xs font-medium text-foreground truncate" title={account.name}>
                                        {account.name}
                                    </span>
                                    <span
                                        className={cn('text-[11px] tabular-nums', accountCount > 0 ? 'text-muted-foreground' : 'text-muted-foreground/40')}
                                        title={onlyMine ? `${accountCount} meeting Anda di akun ini` : `${accountCount} meeting bulan ini`}
                                    >
                                        {accountCount}
                                    </span>
                                </div>

                                {days.map((d) => {
                                    const dateStr = format(d, 'yyyy-MM-dd');
                                    const bookings = visibleBookings(account.id, dateStr);
                                    const offDay = !isWorkingDay(d, workingDays);
                                    const today = isToday(d);
                                    const isCellHovered = isRowHovered && hovered?.date === dateStr;
                                    const isCrosshair = isRowHovered || hovered?.date === dateStr;
                                    const isSelected = selectedCell?.accountId === account.id && selectedCell?.date === dateStr;
                                    const shownCount = visiblePillCount(rowHeight, bookings.length);
                                    const hiddenCount = bookings.length - shownCount;

                                    return (
                                        <div
                                            key={dateStr}
                                            role="button"
                                            tabIndex={0}
                                            aria-label={`${account.name}, ${format(d, 'd MMMM', { locale: idLocale })}: ${bookings.length} meeting`}
                                            className={cn(
                                                'relative flex flex-col items-center justify-center gap-0.5 px-0.5 overflow-hidden cursor-pointer outline-none transition-colors',
                                                offDay && 'bg-muted/50',
                                                isCrosshair && !isCellHovered && 'bg-muted/40',
                                                isCellHovered && 'bg-muted',
                                                today && 'bg-primary/[0.07] dark:bg-primary/10',
                                                isSelected && 'bg-primary/10 ring-2 ring-inset ring-primary/60',
                                                'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60',
                                            )}
                                            style={{ height: rowHeight, paddingBlock: CELL_PAD_Y }}
                                            onMouseEnter={() => setHovered({ accountId: account.id, date: dateStr })}
                                            onMouseLeave={() => setHovered(null)}
                                            onClick={(e) => toggleCell(account.id, dateStr, e.currentTarget)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    toggleCell(account.id, dateStr, e.currentTarget);
                                                }
                                            }}
                                        >
                                            {bookings.slice(0, shownCount).map((b) => (
                                                <MatrixPill key={b.id} booking={b} color={color} />
                                            ))}

                                            {hiddenCount > 0 && (
                                                <span
                                                    className="shrink-0 text-[9px] font-semibold tabular-nums leading-none text-muted-foreground"
                                                    style={{ height: OVERFLOW_LINE_HEIGHT }}
                                                    title={`${hiddenCount} meeting lainnya`}
                                                >
                                                    +{hiddenCount}
                                                </span>
                                            )}

                                            {canBook && !offDay && bookings.length === 0 && isCellHovered && (
                                                <Plus className="w-3.5 h-3.5 text-muted-foreground animate-in fade-in-0 duration-100" />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}

                    {filteredAccounts.length === 0 && (
                        <div className="p-16 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-2">
                            <Video className="w-8 h-8 opacity-40" />
                            <p className="font-medium text-foreground">Tidak ada akun Zoom yang cocok.</p>
                            <Button size="sm" variant="outline" onClick={resetFilters} className="mt-2 rounded-full text-xs cursor-pointer">
                                Reset filter
                            </Button>
                        </div>
                    )}

                    {onlyMine && myTotalMeetings === 0 && filteredAccounts.length > 0 && (
                        <div className="p-10 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                            <CalendarCheck className="w-7 h-7 opacity-40" />
                            <p className="font-medium text-foreground">Anda belum punya meeting di bulan ini.</p>
                            <p className="text-xs max-w-sm">Klik sel tanggal untuk membuat booking baru.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* 3. Cell detail popover */}
            {activePopoverData && selectedCell && (
                <MatrixCellPopover
                    anchor={selectedCell.anchor}
                    accountName={activePopoverData.account?.name ?? 'Akun Zoom'}
                    color={activePopoverData.account?.colorHex || FALLBACK_COLOR}
                    date={activePopoverData.date}
                    bookings={activePopoverData.bookings}
                    canBook={canBook}
                    onClose={() => setSelectedCell(null)}
                    onBookingClick={(id) => {
                        setSelectedCell(null);
                        onBookingClick(id);
                    }}
                    onSchedule={() => {
                        const accId = activePopoverData.account?.id;
                        setSelectedCell(null);
                        if (accId) onCellClick?.(accId, activePopoverData.date);
                    }}
                />
            )}
        </div>
    );
}

/** One meeting in a cell: small solid pill in the account color; the user's own gets a white dot. */
function MatrixPill({ booking, color }: { booking: AccountDayBooking; color: string }) {
    const time = booking.startTime.slice(0, 5);
    return (
        <span
            data-testid="matrix-block"
            data-mine={booking.isMyBooking ? 'true' : undefined}
            title={`${time} · ${booking.title}${booking.isMyBooking ? ' (meeting Anda)' : ''}`}
            className="max-w-full shrink-0 px-1 rounded-[5px] inline-flex items-center gap-0.5 text-[10px] font-semibold text-white tabular-nums leading-none"
            style={{ backgroundColor: color, height: PILL_HEIGHT }}
        >
            {booking.isMyBooking && <span className="w-1 h-1 rounded-full bg-white shrink-0" aria-hidden="true" />}
            <span className="truncate">{time}</span>
        </span>
    );
}

interface MatrixCellPopoverProps {
    anchor: HTMLElement;
    accountName: string;
    color: string;
    date: string;
    bookings: AccountDayBooking[];
    canBook: boolean;
    onClose: () => void;
    onBookingClick: (bookingId: string) => void;
    onSchedule: () => void;
}

/** Apple Calendar–style popover pinned to the clicked cell. */
function MatrixCellPopover({ anchor, accountName, color, date, bookings, canBook, onClose, onBookingClick, onSchedule }: MatrixCellPopoverProps) {
    return (
        <PopoverPrimitive.Root open onOpenChange={(open) => !open && onClose()}>
            <PopoverPrimitive.Anchor virtualRef={{ current: anchor }} />
            <PopoverPrimitive.Portal>
                <PopoverPrimitive.Content
                    side="right"
                    align="start"
                    sideOffset={6}
                    collisionPadding={12}
                    aria-label={`${accountName}, ${date}`}
                    // Clicking the anchor cell again toggles it closed via the cell's own handler.
                    onPointerDownOutside={(e) => {
                        if (anchor.contains(e.target as Node)) e.preventDefault();
                    }}
                    onOpenAutoFocus={(e) => e.preventDefault()}
                    className={cn(
                        'z-[110] w-72 flex flex-col overflow-hidden rounded-xl border border-black/[0.08] dark:border-white/10',
                        'bg-popover/90 backdrop-blur-2xl backdrop-saturate-150 text-popover-foreground',
                        'shadow-[0_10px_40px_rgba(0,0,0,0.14),0_2px_8px_rgba(0,0,0,0.06)] outline-none',
                        'max-h-[min(420px,var(--radix-popover-content-available-height))]',
                        'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 duration-150',
                    )}
                >
                    <div className="px-4 pt-3 pb-2">
                        <p className="text-[15px] font-semibold leading-tight text-foreground">
                            {format(parseISO(date), 'EEEE, d MMMM', { locale: idLocale })}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} aria-hidden="true" />
                            <span className="truncate">{accountName}</span>
                        </p>
                    </div>

                    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                        {bookings.length === 0 ? (
                            <p className="px-4 pb-3 text-xs text-muted-foreground">Tidak ada meeting. Akun ini kosong sepanjang hari.</p>
                        ) : (
                            <ul className="px-1.5 pb-1.5">
                                {bookings.map((booking) => {
                                    const endTimeStr = computeEndTime(booking.startTime, booking.endTime, booking.durationMinutes);
                                    const durationLabel = formatHumanDuration(booking.durationMinutes);
                                    const who = booking.isMyBooking
                                        ? 'Anda'
                                        : `${booking.bookedByName || 'Pengguna'}${booking.department ? ` · ${booking.department}` : ''}`;
                                    return (
                                        <li key={booking.id}>
                                            <button
                                                type="button"
                                                onClick={() => onBookingClick(booking.id)}
                                                className="group w-full flex items-stretch gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06] cursor-pointer"
                                            >
                                                <span className="w-[3px] shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
                                                <span className="flex-1 min-w-0">
                                                    <span className="flex items-center gap-1.5">
                                                        <span className="truncate text-[13px] font-medium text-foreground">{booking.title}</span>
                                                        {booking.isDoubleBooking && (
                                                            <span className="shrink-0 text-[10px] font-medium text-amber-600 dark:text-amber-400">Dobel</span>
                                                        )}
                                                    </span>
                                                    <span className="block text-xs tabular-nums text-muted-foreground">
                                                        {booking.startTime.slice(0, 5)}
                                                        {endTimeStr && ` – ${endTimeStr}`}
                                                        {durationLabel && ` · ${durationLabel}`}
                                                    </span>
                                                    <span className={cn('block truncate text-xs', booking.isMyBooking ? 'font-medium' : 'text-muted-foreground')} style={booking.isMyBooking ? { color } : undefined}>
                                                        {who}
                                                    </span>
                                                </span>
                                                <ChevronRight className="w-3.5 h-3.5 self-center shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>

                    {canBook && (
                        <button
                            type="button"
                            onClick={onSchedule}
                            className="shrink-0 flex items-center gap-1.5 border-t border-black/[0.06] dark:border-white/10 px-4 py-2.5 text-left text-[13px] font-medium text-primary transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.05] cursor-pointer"
                        >
                            <Plus className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">Jadwalkan di {accountName}</span>
                        </button>
                    )}
                    <PopoverPrimitive.Arrow width={14} height={7} className="fill-popover" />
                </PopoverPrimitive.Content>
            </PopoverPrimitive.Portal>
        </PopoverPrimitive.Root>
    );
}
