import { useMemo, useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isSameMonth, getDay } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ZoomAccount } from '../types';
import type { MergedCalendarDay } from '../hooks/useZoomBooking';
import { useZoomSettings, isWorkingDay } from '../hooks/useZoomSettings';

/**
 * All-accounts month matrix: one row per Zoom account, one column per day.
 * Answers "which of Zoom 1–10 is busy when" at a single glance — the merged
 * single-row month view can't, because its pills carry no account identity.
 */

interface AccountDayBooking {
    id: string;
    title: string;
    startTime: string;
    isMyBooking: boolean;
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

    // accountId -> date -> bookings[]
    const matrix = useMemo(() => {
        const map = new Map<string, Map<string, AccountDayBooking[]>>();
        for (const day of mergedDays) {
            for (const slot of day.slots) {
                for (const b of slot.bookings) {
                    if (!map.has(b.zoomAccountId)) map.set(b.zoomAccountId, new Map());
                    const byDate = map.get(b.zoomAccountId)!;
                    if (!byDate.has(day.date)) byDate.set(day.date, []);
                    const list = byDate.get(day.date)!;
                    if (!list.some((x) => x.id === b.id)) {
                        list.push({
                            id: b.id,
                            title: b.title,
                            startTime: b.startTime || slot.time,
                            isMyBooking: slot.isMyBooking,
                        });
                    }
                }
            }
        }
        // Sort each day's bookings by start time
        for (const byDate of map.values()) {
            for (const list of byDate.values()) {
                list.sort((a, b) => a.startTime.localeCompare(b.startTime));
            }
        }
        return map;
    }, [mergedDays]);

    const [hovered, setHovered] = useState<{ accountId: string; date: string } | null>(null);

    const DAY_COL_WIDTH = 36; // px, fixed so 31 columns stay uniform
    const LABEL_WIDTH = 150;

    return (
        <div className="h-full overflow-auto custom-scrollbar bg-white dark:bg-slate-900">
            <div style={{ minWidth: LABEL_WIDTH + days.length * DAY_COL_WIDTH }}>
                {/* Day-number header */}
                <div className="sticky top-0 z-20 flex bg-white dark:bg-slate-900 border-b border-border">
                    <div
                        className="shrink-0 sticky left-0 z-10 bg-white dark:bg-slate-900 border-r border-border px-3 py-2"
                        style={{ width: LABEL_WIDTH }}
                    >
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            {format(currentDate, 'MMMM yyyy', { locale: idLocale })}
                        </span>
                    </div>
                    {days.map((d) => {
                        const weekend = !isWorkingDay(d, workingDays);
                        const today = isToday(d);
                        return (
                            <div
                                key={d.toISOString()}
                                className={cn(
                                    'shrink-0 flex flex-col items-center justify-center py-1 border-r border-border/50',
                                    weekend && 'bg-muted/40',
                                )}
                                style={{ width: DAY_COL_WIDTH }}
                            >
                                <span className={cn(
                                    'text-xs leading-none',
                                    weekend ? 'text-muted-foreground/60' : 'text-muted-foreground',
                                )}>
                                    {WEEKDAY_LABELS[(getDay(d) + 6) % 7]}
                                </span>
                                <span className={cn(
                                    'text-xs font-semibold leading-tight mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full',
                                    today ? 'bg-primary text-primary-foreground' : weekend ? 'text-muted-foreground/60' : 'text-foreground',
                                )}>
                                    {format(d, 'd')}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* One row per account */}
                {accounts.map((account) => {
                    const byDate = matrix.get(account.id);
                    return (
                        <div key={account.id} className="flex border-b border-border/60 group/row">
                            {/* Account label — sticky left */}
                            <div
                                className="shrink-0 sticky left-0 z-10 bg-white dark:bg-slate-900 border-r border-border px-3 py-2 flex items-center gap-2"
                                style={{ width: LABEL_WIDTH }}
                            >
                                <span
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: account.colorHex }}
                                    aria-hidden="true"
                                />
                                <span className="text-xs font-semibold text-foreground truncate">
                                    {account.name}
                                </span>
                            </div>

                            {days.map((d) => {
                                const dateStr = format(d, 'yyyy-MM-dd');
                                const bookings = byDate?.get(dateStr) ?? [];
                                const weekend = !isWorkingDay(d, workingDays);
                                const isHovered = hovered?.accountId === account.id && hovered?.date === dateStr;
                                return (
                                    <div
                                        key={dateStr}
                                        className={cn(
                                            'shrink-0 relative border-r border-border/50 p-0.5 flex flex-col gap-0.5 min-h-[52px]',
                                            weekend && 'bg-muted/40',
                                            canBook && !weekend && 'cursor-pointer hover:bg-primary/5',
                                        )}
                                        style={{ width: DAY_COL_WIDTH }}
                                        onMouseEnter={() => setHovered({ accountId: account.id, date: dateStr })}
                                        onMouseLeave={() => setHovered(null)}
                                        onClick={() => {
                                            if (!canBook || weekend) return;
                                            onCellClick?.(account.id, dateStr);
                                        }}
                                    >
                                        {bookings.slice(0, 3).map((b) => (
                                            <button
                                                key={b.id}
                                                type="button"
                                                title={`${b.startTime} · ${b.title}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onBookingClick(b.id);
                                                }}
                                                className={cn(
                                                    'w-full h-3.5 rounded-sm transition-opacity hover:opacity-70',
                                                    b.isMyBooking && 'ring-1 ring-inset ring-primary/60',
                                                )}
                                                style={{ backgroundColor: account.colorHex }}
                                            />
                                        ))}
                                        {bookings.length > 3 && (
                                            <span className="text-xs font-bold text-muted-foreground leading-none px-0.5">
                                                +{bookings.length - 3}
                                            </span>
                                        )}
                                        {canBook && !weekend && bookings.length === 0 && isHovered && (
                                            <span className="absolute inset-0 flex items-center justify-center">
                                                <Plus className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}

                {accounts.length === 0 && (
                    <div className="p-12 text-center text-sm text-muted-foreground">
                        No Zoom accounts configured
                    </div>
                )}
            </div>
        </div>
    );
}
