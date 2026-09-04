/**
 * ZoomMyBookingsView — shows all of the current user's bookings
 * (upcoming and past) without needing to navigate the calendar.
 */
import { useState, useMemo } from 'react';
import { format, parseISO, isPast, isFuture, isToday, addMonths, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import {
    Video, Calendar, Clock, ExternalLink, Copy, FileText,
    CalendarClock, Trash2, Search, ChevronRight, ChevronLeft,
    CheckCircle2, XCircle, AlertCircle, List, Mail, Download,
    LayoutGrid, Maximize2, Minimize2
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAuth } from '@/stores/useAuth';
import { useMyBookings, useCancelOwnBooking, useZoomAccounts, useZoomMergedCalendar } from '../hooks';
import { CancelBookingModal } from './CancelBookingModal';
import { RescheduleModal } from './RescheduleModal';
import { BookingDetailsModal } from './BookingDetailsModal';
import { SendReminderModal } from './SendReminderModal';
import { ZoomClientMonthCalendar } from './ZoomClientMonthCalendar';
import { ZoomAccountsMatrix } from './ZoomAccountsMatrix';
import type { ZoomBooking } from '../types';
import { formatZoomAccountName, generateInvitationText, copyToClipboard } from '../utils';
import { openOutlookWeb, downloadIcsFile } from '../utils/calendarExport';

type BookingTab = 'upcoming' | 'past' | 'all';
type ViewMode = 'calendar' | 'matrix' | 'list';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    confirmed: { label: 'Confirmed', color: 'text-emerald-600 bg-emerald-50 border-emerald-200', icon: CheckCircle2 },
    cancelled: { label: 'Dibatalkan', color: 'text-red-500 bg-red-50 border-red-200', icon: XCircle },
    pending:   { label: 'Pending',    color: 'text-amber-600 bg-amber-50 border-amber-200', icon: AlertCircle },
};

function normalizeDateStr(rawDate: string | Date | undefined): string {
    if (!rawDate) return format(new Date(), 'yyyy-MM-dd');
    if (typeof rawDate === 'string') {
        return rawDate.split('T')[0];
    }
    return format(new Date(rawDate), 'yyyy-MM-dd');
}

export interface ZoomMyBookingsViewProps {
    onBookingClick?: (id: string) => void;
    selectedDate?: string;
    onDateSelect?: (dateStr: string) => void;
    defaultViewMode?: ViewMode;
}

export function ZoomMyBookingsView({
    onBookingClick,
    selectedDate,
    onDateSelect,
    defaultViewMode,
}: ZoomMyBookingsViewProps = {}) {
    const { data: bookings, isLoading } = useMyBookings();
    const cancelOwnBooking = useCancelOwnBooking();

    const [viewMode, setViewMode] = useState<ViewMode>(() => {
        if (defaultViewMode) return defaultViewMode;
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('idesk_client_zoom_view_mode');
            if (saved === 'calendar' || saved === 'matrix' || saved === 'list') return saved;
        }
        return 'calendar';
    });

    const [matrixDate, setMatrixDate] = useState<Date>(() => new Date());
    const [isMatrixFullscreen, setIsMatrixFullscreen] = useState(false);
    const { data: accounts = [] } = useZoomAccounts();
    const mergedStart = useMemo(() => format(startOfMonth(matrixDate), 'yyyy-MM-dd'), [matrixDate]);
    const mergedEnd = useMemo(() => format(endOfMonth(matrixDate), 'yyyy-MM-dd'), [matrixDate]);
    const mergedCalendar = useZoomMergedCalendar(mergedStart, mergedEnd);

    const [tab, setTab] = useState<BookingTab>('upcoming');
    const [search, setSearch] = useState('');
    const [cancelTarget, setCancelTarget] = useState<ZoomBooking | null>(null);
    const [rescheduleTarget, setRescheduleTarget] = useState<ZoomBooking | null>(null);
    const [detailBookingId, setDetailBookingId] = useState<string | null>(null);
    const [reminderTarget, setReminderTarget] = useState<ZoomBooking | null>(null);

    const handleViewModeChange = (mode: ViewMode) => {
        setViewMode(mode);
        try {
            localStorage.setItem('idesk_client_zoom_view_mode', mode);
        } catch {
            // ignore
        }
    };

    const counts = useMemo(() => {
        const all = bookings ?? [];
        let upcoming = 0;
        let past = 0;
        for (const b of all) {
            const date = parseISO(normalizeDateStr(b.bookingDate));
            if (isFuture(date) || isToday(date)) upcoming++;
            else past++;
        }
        return { all: all.length, upcoming, past };
    }, [bookings]);

    const filtered = useMemo(() => {
        const all = bookings ?? [];
        const byTab = all.filter((b) => {
            const dateStr = normalizeDateStr(b.bookingDate);
            const date = parseISO(dateStr);
            if (tab === 'upcoming') return isFuture(date) || isToday(date);
            if (tab === 'past')     return isPast(date) && !isToday(date);
            return true;
        });
        if (!search.trim()) return byTab;
        const q = search.toLowerCase();
        return byTab.filter((b) => {
            const titleMatch = b.title ? b.title.toLowerCase().includes(q) : false;
            const accountMatch = b.zoomAccount?.name ? b.zoomAccount.name.toLowerCase().includes(q) : false;
            const userMatch = b.bookedByUser?.fullName ? b.bookedByUser.fullName.toLowerCase().includes(q) : false;
            return titleMatch || accountMatch || userMatch;
        });
    }, [bookings, tab, search]);

    const grouped = useMemo(() => {
        const map = new Map<string, ZoomBooking[]>();
        for (const b of filtered) {
            const key = normalizeDateStr(b.bookingDate);
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(b);
        }
        // Sort within each day by startTime ASC
        for (const list of map.values()) {
            list.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
        }
        const entries = [...map.entries()];
        // For upcoming: chronological ASC (closest date first: Hari Ini -> Besok)
        // For past & all: newest dates first DESC (so latest/today is at top, oldest at bottom)
        entries.sort(([a], [b]) => (tab === 'upcoming' ? a.localeCompare(b) : b.localeCompare(a)));
        return entries;
    }, [filtered, tab]);

    if (isLoading) {
        return (
            <div className="flex-1 space-y-3 p-6 animate-pulse">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-20 rounded-xl bg-slate-100 dark:bg-slate-800" />
                ))}
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full min-h-0">
            {/* Header Toolbar */}
            <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-border/40 bg-muted/15">
                {/* Left: View Mode Toggle */}
                <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/90 border border-border/40 shadow-2xs">
                    <button
                        type="button"
                        onClick={() => handleViewModeChange('calendar')}
                        className={cn(
                            "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all duration-150 cursor-pointer",
                            viewMode === 'calendar'
                                ? "bg-white text-blue-600 shadow-xs dark:bg-slate-700 dark:text-blue-400 font-bold"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <Calendar className="h-3.5 w-3.5" />
                        <span>Kalender</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => handleViewModeChange('matrix')}
                        className={cn(
                            "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all duration-150 cursor-pointer",
                            viewMode === 'matrix'
                                ? "bg-white text-blue-600 shadow-xs dark:bg-slate-700 dark:text-blue-400 font-bold"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <LayoutGrid className="h-3.5 w-3.5" />
                        <span>Matrix Semua Akun</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => handleViewModeChange('list')}
                        className={cn(
                            "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all duration-150 cursor-pointer",
                            viewMode === 'list'
                                ? "bg-white text-blue-600 shadow-xs dark:bg-slate-700 dark:text-blue-400 font-bold"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <List className="h-3.5 w-3.5" />
                        <span>Bookingan Saya</span>
                        <span
                            className={cn(
                                "inline-flex items-center justify-center px-1.5 py-0.2 rounded-full text-[10px] tabular-nums font-bold",
                                viewMode === 'list'
                                    ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                                    : "bg-slate-200/70 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                            )}
                        >
                            {counts.all}
                        </span>
                    </button>
                </div>

                {/* Right: Mode specific toolbar */}
                {viewMode === 'matrix' ? (
                    <div className="flex items-center gap-1.5">
                        <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 rounded-lg"
                            onClick={() => setMatrixDate(subMonths(matrixDate, 1))}
                            title="Bulan sebelumnya"
                        >
                            <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>
                        <span className="text-xs font-bold text-foreground px-1 select-none">
                            {format(matrixDate, 'MMMM yyyy', { locale: idLocale })}
                        </span>
                        <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 rounded-lg"
                            onClick={() => setMatrixDate(addMonths(matrixDate, 1))}
                            title="Bulan berikutnya"
                        >
                            <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[11px] font-medium"
                            onClick={() => setMatrixDate(new Date())}
                        >
                            Hari Ini
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[11px] font-medium flex items-center gap-1"
                            onClick={() => setIsMatrixFullscreen(!isMatrixFullscreen)}
                            title={isMatrixFullscreen ? "Perkecil tampilan" : "Perbesar layar penuh"}
                        >
                            {isMatrixFullscreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                            <span className="hidden sm:inline">{isMatrixFullscreen ? 'Kecilkan' : 'Layar Penuh'}</span>
                        </Button>
                    </div>
                ) : viewMode === 'list' ? (
                    <div className="flex w-fit gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/90 border border-border/40">
                        {(
                            [
                                { key: 'upcoming', label: 'Mendatang', count: counts.upcoming },
                                { key: 'all', label: 'Semua', count: counts.all },
                                { key: 'past', label: 'Selesai', count: counts.past },
                            ] as const
                        ).map((t) => (
                            <button
                                key={t.key}
                                onClick={() => setTab(t.key)}
                                className={cn(
                                    "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all duration-150 cursor-pointer",
                                    tab === t.key
                                        ? "bg-white text-blue-600 shadow-xs dark:bg-slate-700 dark:text-blue-400 font-bold"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <span>{t.label}</span>
                                <span
                                    className={cn(
                                        "inline-flex items-center justify-center px-1.5 py-0.2 rounded-full text-[10px] tabular-nums font-bold",
                                        tab === t.key
                                            ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                                            : "bg-slate-200/70 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                    )}
                                >
                                    {t.count}
                                </span>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                        <span><strong>{counts.upcoming}</strong> meeting mendatang</span>
                    </div>
                )}
            </div>

            {/* Main Content Area: Calendar View, Matrix View, or List View */}
            {viewMode === 'calendar' ? (
                <div className="flex-1 overflow-hidden flex flex-col">
                    <ZoomClientMonthCalendar
                        bookings={bookings || []}
                        selectedDate={selectedDate}
                        onDateSelect={onDateSelect}
                        onBookingClick={(id) => {
                            if (onBookingClick) onBookingClick(id);
                            else setDetailBookingId(id);
                        }}
                    />
                </div>
            ) : viewMode === 'matrix' ? (
                <div className={cn(
                    "flex-1 overflow-hidden flex flex-col min-h-0 bg-background",
                    isMatrixFullscreen && "fixed inset-0 z-50 p-4 shadow-2xl flex flex-col"
                )}>
                    {isMatrixFullscreen && (
                        <div className="flex items-center justify-between pb-3 mb-2 border-b border-border/40 shrink-0">
                            <div className="flex items-center gap-2">
                                <LayoutGrid className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                <h2 className="text-sm font-bold text-foreground">
                                    Matriks 10 Akun Zoom — {format(matrixDate, 'MMMM yyyy', { locale: idLocale })}
                                </h2>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setMatrixDate(subMonths(matrixDate, 1))}>
                                    <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Bulan Lalu
                                </Button>
                                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setMatrixDate(new Date())}>
                                    Hari Ini
                                </Button>
                                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setMatrixDate(addMonths(matrixDate, 1))}>
                                    Bulan Depan <ChevronRight className="h-3.5 w-3.5 ml-1" />
                                </Button>
                                <Button size="sm" variant="secondary" className="h-8 text-xs" onClick={() => setIsMatrixFullscreen(false)}>
                                    <Minimize2 className="h-3.5 w-3.5 mr-1" /> Tutup Layar Penuh
                                </Button>
                            </div>
                        </div>
                    )}
                    <div className="flex-1 min-h-0 overflow-auto">
                        {mergedCalendar.isLoading ? (
                            <div className="h-64 flex items-center justify-center gap-2 text-xs text-muted-foreground animate-pulse">
                                <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                <span>Memuat matriks seluruh akun Zoom...</span>
                            </div>
                        ) : (
                            <ZoomAccountsMatrix
                                currentDate={matrixDate}
                                mergedDays={(mergedCalendar.data as any) || []}
                                accounts={accounts || []}
                                canBook={true}
                                onBookingClick={(id) => {
                                    if (onBookingClick) onBookingClick(id);
                                    else setDetailBookingId(id);
                                }}
                                onCellClick={(_accountId, date) => {
                                    onDateSelect?.(date);
                                    if (isMatrixFullscreen) setIsMatrixFullscreen(false);
                                }}
                            />
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Search */}
                    <div className="p-3 border-b border-border/40">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                            <Input
                                placeholder="Cari judul, akun Zoom, atau nama peserta..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="h-9 rounded-xl bg-slate-50 pl-8 pr-8 text-xs dark:bg-slate-800/60"
                            />
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => setSearch('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                                    title="Hapus pencarian"
                                >
                                    <XCircle className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Booking list cards */}
                    <div className="flex-1 overflow-auto custom-scrollbar px-4 py-3 space-y-4">
                        {grouped.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <Calendar className="mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" aria-hidden="true" />
                                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                                    Tidak ada booking
                                </p>
                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                                    {tab === 'upcoming' ? 'Belum ada meeting yang akan datang' : 'Belum ada riwayat booking'}
                                </p>
                            </div>
                        )}

                        {grouped.map(([date, dayBookings]) => {
                            const parsedDate = parseISO(date);
                            const isDateToday = isToday(parsedDate);
                            return (
                                <div key={date}>
                                    {/* Date header */}
                                    <div className="flex items-center gap-2 mb-2.5">
                                        {isDateToday ? (
                                            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 text-white dark:bg-blue-500 px-3 py-0.5 text-xs font-bold shadow-xs">
                                                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                                                Hari Ini &bull; {format(parsedDate, 'd MMMM yyyy', { locale: idLocale })}
                                            </span>
                                        ) : (
                                            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                                                {format(parsedDate, 'EEEE, d MMMM yyyy', { locale: idLocale })}
                                            </span>
                                        )}
                                        <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700/80" />
                                    </div>

                                    {/* Bookings for this date */}
                                    <div className="space-y-2">
                                        {dayBookings.map((booking) => (
                                            <BookingCard
                                                key={booking.id}
                                                booking={booking}
                                                isTodayItem={isDateToday}
                                                onView={() => {
                                                    if (onBookingClick) onBookingClick(booking.id);
                                                    else setDetailBookingId(booking.id);
                                                }}
                                                onReminder={() => setReminderTarget(booking)}
                                                onReschedule={() => setRescheduleTarget(booking)}
                                                onCancel={() => setCancelTarget(booking)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}


            {/* Modals */}
            {detailBookingId && (
                <BookingDetailsModal
                    bookingId={detailBookingId}
                    isOpen={!!detailBookingId}
                    onClose={() => setDetailBookingId(null)}
                />
            )}
            <RescheduleModal
                booking={rescheduleTarget}
                isOpen={!!rescheduleTarget}
                onClose={() => setRescheduleTarget(null)}
            />
            <CancelBookingModal
                booking={cancelTarget}
                isOpen={!!cancelTarget}
                onClose={() => setCancelTarget(null)}
                onSuccess={() => setCancelTarget(null)}
                isOwner
            />
            {reminderTarget && (
                <SendReminderModal
                    booking={reminderTarget}
                    isOpen={!!reminderTarget}
                    onClose={() => setReminderTarget(null)}
                />
            )}
        </div>
    );
}

interface BookingCardProps {
    booking: ZoomBooking;
    isTodayItem?: boolean;
    onView: () => void;
    onReminder: () => void;
    onReschedule: () => void;
    onCancel: () => void;
}

function BookingCard({ booking, isTodayItem, onView, onReminder, onReschedule, onCancel }: BookingCardProps) {
    const { user } = useAuth();
    const [copiedInv, setCopiedInv] = useState(false);

    const STAFF_ROLES = [
        'ADMIN',
        'AGENT_OPERATIONAL_SUPPORT',
        'AGENT_ADMIN',
        'AGENT_ORACLE',
        'AGENT',
        'MANAGER',
    ];

    const status = booking.status ?? 'confirmed';
    const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.confirmed;
    const StatusIcon = cfg.icon;
    const isPastBooking = isPast(parseISO(booking.bookingDate)) && !isToday(parseISO(booking.bookingDate));
    const hasLink = !!booking.meeting?.joinUrl;
    const accountColor = booking.zoomAccount?.colorHex ?? '#3b82f6';

    const isOwner = user?.id === booking.bookedByUserId;
    const isStaff = !!(user?.role && STAFF_ROLES.includes(user.role));
    const canManageCard = (isOwner || isStaff) && !isPastBooking && status !== 'CANCELLED';

    return (
        <div
            className={cn(
                "group relative cursor-pointer rounded-2xl bg-white dark:bg-slate-900 border p-4 transition-all duration-200 hover:shadow-md",
                isTodayItem && !isPastBooking
                    ? "border-blue-300/80 dark:border-blue-700/60 bg-blue-50/20 dark:bg-blue-950/10 shadow-xs"
                    : "border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700",
                isPastBooking && "opacity-60 bg-slate-50/50 dark:bg-slate-900/40"
            )}
            onClick={(e) => {
                const target = e.target as HTMLElement;
                if (!target.closest('button')) {
                    onView();
                }
            }}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                            {booking.title}
                        </h4>
                        <span className={cn(
                            "shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tracking-wide border",
                            cfg.color
                        )}>
                            <StatusIcon className="h-3 w-3" />
                            {cfg.label}
                        </span>
                        {isTodayItem && !isPastBooking && (
                            <span className="shrink-0 inline-flex items-center px-1.5 py-0.2 rounded-md bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[10px] font-bold">
                                Hari Ini
                            </span>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
                        <span className="inline-flex items-center gap-1.5 font-medium bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md text-slate-700 dark:text-slate-300">
                            <Clock className="h-3.5 w-3.5 text-blue-500" />
                            {booking.startTime} – {booking.endTime}
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: accountColor }} />
                            {formatZoomAccountName(booking.zoomAccount?.name)}
                        </span>
                    </div>
                </div>

                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onView();
                    }}
                    className="shrink-0 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
                    title="Lihat detail info card"
                >
                    <ChevronRight className="h-4 w-4" />
                </button>
            </div>

            {/* Actions for upcoming bookings */}
            {!isPastBooking && status !== 'CANCELLED' && (
                <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center gap-2">
                    {hasLink && (
                        <Button
                            size="sm"
                            className="h-8 text-xs font-semibold gap-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm cursor-pointer"
                            onClick={(e) => {
                                e.stopPropagation();
                                window.open(booking.meeting!.joinUrl, '_blank');
                            }}
                        >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Join
                        </Button>
                    )}
                    {hasLink && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs font-medium gap-1.5 rounded-lg border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
                            onClick={async (e) => {
                                e.stopPropagation();
                                const fullInvitation = generateInvitationText(booking);
                                const ok = await copyToClipboard(fullInvitation, 'Undangan Zoom');
                                if (ok) {
                                    setCopiedInv(true);
                                    setTimeout(() => setCopiedInv(false), 2000);
                                }
                            }}
                        >
                            {copiedInv ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <FileText className="h-3.5 w-3.5 text-slate-400" />}
                            {copiedInv ? 'Undangan Tersalin' : 'Salin Undangan'}
                        </Button>
                    )}
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs font-semibold gap-1.5 rounded-lg border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer"
                        onClick={(e) => {
                            e.stopPropagation();
                            onReminder();
                        }}
                        title="Kirim pengingat ke email & tambahkan ke Outlook Calendar"
                    >
                        <Mail className="h-3.5 w-3.5" />
                        Email / Outlook
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs font-medium gap-1 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                        onClick={(e) => {
                            e.stopPropagation();
                            openOutlookWeb(booking);
                        }}
                        title="Buka langsung di Outlook Web Office 365"
                    >
                        <ExternalLink className="h-3 w-3 text-blue-600" />
                        Outlook
                    </Button>
                    {canManageCard && (
                        <div className="ml-auto flex items-center gap-1.5">
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 text-xs font-medium gap-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onReschedule();
                                }}
                            >
                                <CalendarClock className="h-3.5 w-3.5" />
                                Reschedule
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 text-xs font-medium gap-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg cursor-pointer"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onCancel();
                                }}
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                                Batal
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
