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
        // Sort dates ascending for upcoming, descending for past/all
        const entries = [...map.entries()];
        entries.sort(([a], [b]) => (tab === 'upcoming' ? a.localeCompare(b) : b.localeCompare(a)));
        return entries;
    }, [filtered, tab]);

    if (isLoading) {
        return (
            <div className="flex-1 p-6 space-y-3 animate-pulse">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-24 rounded-2xl bg-slate-100 dark:bg-slate-800" />
                ))}
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full min-h-0">
            {/* Sticky toolbar */}
            <div className="shrink-0 px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 backdrop-blur space-y-3">
                {/* Tabs */}
                <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
                    {(['all', 'upcoming', 'past'] as BookingTab[]).map((t) => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={cn(
                                "px-4 py-1.5 rounded-lg text-xs font-semibold transition-all",
                                tab === t
                                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
                                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
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
                        className="pl-8 h-8 text-xs"
                    />
                </div>
            </div>

            {/* Booking list */}
            <div className="flex-1 overflow-auto custom-scrollbar px-4 py-3 space-y-4">
                {grouped.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <Calendar className="h-12 w-12 text-slate-300 dark:text-slate-600 mb-3" />
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
                                    "text-xs font-bold px-2 py-0.5 rounded-full",
                                    isDateToday
                                        ? "bg-blue-600 text-white"
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
    const [copiedLink, setCopiedLink] = useState(false);
    const [copiedInv, setCopiedInv] = useState(false);

    const status = booking.status ?? 'confirmed';
    const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.confirmed;
    const StatusIcon = cfg.icon;
    const isPastBooking = isPast(parseISO(booking.bookingDate)) && !isToday(parseISO(booking.bookingDate));
    const hasLink = !!booking.meeting?.joinUrl;

    return (
        <div
            className={cn(
                "group relative rounded-2xl border bg-white dark:bg-slate-900 p-4",
                "shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer",
                "border-slate-200 dark:border-slate-700",
                isPastBooking && "opacity-70"
            )}
            onClick={(e) => {
                // If user didn't click inside an action button, open detail modal
                const target = e.target as HTMLElement;
                if (!target.closest('button')) {
                    onView();
                }
            }}
        >
            {/* Color accent */}
            <div
                className="absolute left-0 top-3 bottom-3 w-1 rounded-full"
                style={{ backgroundColor: booking.zoomAccount?.colorHex ?? '#3b82f6' }}
            />

            <div className="pl-3 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 mb-1">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                            {booking.title}
                        </h4>
                        <span className={cn(
                            "shrink-0 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border font-medium",
                            cfg.color
                        )}>
                            <StatusIcon className="h-2.5 w-2.5" />
                            {cfg.label}
                        </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {booking.startTime} – {booking.endTime}
                        </span>
                        <span className="flex items-center gap-1">
                            <Video className="h-3 w-3" />
                            {formatZoomAccountName(booking.zoomAccount?.name)}
                        </span>
                    </div>
                </div>

                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onView();
                    }}
                    className="shrink-0 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Lihat detail info card"
                >
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                </button>
            </div>

            {/* Actions for upcoming bookings */}
            {!isPastBooking && status !== 'CANCELLED' && (
                <div className="pl-3 mt-3 flex items-center gap-2">
                    {hasLink && (
                        <Button
                            size="sm"
                            className="h-7 text-xs gap-1 bg-blue-600 hover:bg-blue-700"
                            onClick={(e) => {
                                e.stopPropagation();
                                window.open(booking.meeting!.joinUrl, '_blank');
                            }}
                        >
                            <ExternalLink className="h-3 w-3" />
                            Join
                        </Button>
                    )}
                    {hasLink && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1"
                            onClick={async (e) => {
                                e.stopPropagation();
                                const ok = await copyToClipboard(booking.meeting!.joinUrl, 'Link Zoom');
                                if (ok) {
                                    setCopiedLink(true);
                                    setTimeout(() => setCopiedLink(false), 2000);
                                }
                            }}
                        >
                            {copiedLink ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                            {copiedLink ? 'Tersalin' : 'Copy Link'}
                        </Button>
                    )}
                    {hasLink && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1"
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
                            {copiedInv ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <FileText className="h-3 w-3" />}
                            {copiedInv ? 'Undangan Tersalin' : 'Salin Undangan'}
                        </Button>
                    )}
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1 ml-auto"
                        onClick={(e) => {
                            e.stopPropagation();
                            onReschedule();
                        }}
                    >
                        <CalendarClock className="h-3 w-3" />
                        Reschedule
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1 text-red-500 border-red-200 hover:bg-red-50"
                        onClick={(e) => {
                            e.stopPropagation();
                            onCancel();
                        }}
                    >
                        <Trash2 className="h-3 w-3" />
                        Batal
                    </Button>
                </div>
            )}
        </div>
    );
}
