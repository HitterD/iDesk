/**
 * ZoomMyBookingsView — shows all of the current user's bookings
 * (upcoming and past) without needing to navigate the calendar.
 */
import { useState, useMemo } from 'react';
import { format, parseISO, isPast, isFuture, isToday } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import {
    Video, Calendar, Clock, ExternalLink, Copy, FileText,
    CalendarClock, Trash2, Search, ChevronRight,
    CheckCircle2, XCircle, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAuth } from '@/stores/useAuth';
import { useMyBookings, useCancelOwnBooking } from '../hooks';
import { CancelBookingModal } from './CancelBookingModal';
import { RescheduleModal } from './RescheduleModal';
import { BookingDetailsModal } from './BookingDetailsModal';
import type { ZoomBooking } from '../types';
import { formatZoomAccountName, generateInvitationText, copyToClipboard } from '../utils';

type BookingTab = 'upcoming' | 'past' | 'all';

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

export function ZoomMyBookingsView({ onBookingClick }: { onBookingClick?: (id: string) => void }) {
    const { data: bookings, isLoading } = useMyBookings();
    const cancelOwnBooking = useCancelOwnBooking();

    const [tab, setTab] = useState<BookingTab>('all');
    const [search, setSearch] = useState('');
    const [cancelTarget, setCancelTarget] = useState<ZoomBooking | null>(null);
    const [rescheduleTarget, setRescheduleTarget] = useState<ZoomBooking | null>(null);
    const [detailBookingId, setDetailBookingId] = useState<string | null>(null);

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
        // Sort dates ascending for all & upcoming (closest first), descending for past
        const entries = [...map.entries()];
        entries.sort(([a], [b]) => (tab === 'past' ? b.localeCompare(a) : a.localeCompare(b)));
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
            <div className="shrink-0 space-y-3 px-5 py-4">
                <div className="flex w-fit gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
                    {(['all', 'upcoming', 'past'] as BookingTab[]).map((t) => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={cn(
                                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-200 [transition-timing-function:var(--ease-out)]",
                                tab === t
                                    ? "bg-white text-slate-950 shadow-sm dark:bg-slate-700 dark:text-slate-50"
                                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                            )}
                        >
                            {t === 'all' ? 'Semua' : t === 'upcoming' ? 'Mendatang' : 'Selesai'}
                        </button>
                    ))}
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <Input
                        placeholder="Cari booking..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="h-9 rounded-lg bg-slate-50 pl-8 text-xs dark:bg-slate-800/60"
                    />
                </div>
            </div>

            {/* Booking list */}
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
                            <div className="flex items-center gap-2 mb-2">
                                <span className={cn(
                                    "text-xs font-semibold",
                                    isDateToday
                                        ? "text-blue-700 dark:text-blue-300"
                                        : "text-slate-500 dark:text-slate-400"
                                )}>
                                    {isDateToday
                                        ? 'Hari ini'
                                        : format(parsedDate, 'EEEE, d MMMM yyyy', { locale: idLocale })
                                    }
                                </span>
                                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                            </div>

                            {/* Bookings for this date */}
                            <div className="space-y-2">
                                {dayBookings.map((booking) => (
                                    <BookingCard
                                        key={booking.id}
                                        booking={booking}
                                        onView={() => {
                                            if (onBookingClick) onBookingClick(booking.id);
                                            else setDetailBookingId(booking.id);
                                        }}
                                        onReschedule={() => setRescheduleTarget(booking)}
                                        onCancel={() => setCancelTarget(booking)}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

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
        </div>
    );
}

interface BookingCardProps {
    booking: ZoomBooking;
    onView: () => void;
    onReschedule: () => void;
    onCancel: () => void;
}

function BookingCard({ booking, onView, onReschedule, onCancel }: BookingCardProps) {
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
                "group relative cursor-pointer rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-4 transition-all duration-200 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700",
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
                    className="shrink-0 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
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
                            className="h-8 text-xs font-semibold gap-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm"
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
                            className="h-8 text-xs font-medium gap-1.5 rounded-lg border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
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
                    {canManageCard && (
                        <div className="ml-auto flex items-center gap-1.5">
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 text-xs font-medium gap-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
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
                                className="h-8 text-xs font-medium gap-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg"
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
