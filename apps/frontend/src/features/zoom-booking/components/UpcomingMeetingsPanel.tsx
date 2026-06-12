import { useState } from 'react';
import { format, parseISO, isToday, isTomorrow, isThisWeek } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Video, Calendar, Clock, Copy, ExternalLink, FileText, Hash, CalendarClock, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useMyBookings, useCancelOwnBooking, useMyUpcomingBookings } from '../hooks';
import type { ZoomBooking } from '../types';
import { cn } from '@/lib/utils';
import { RescheduleModal } from './RescheduleModal';
import { CancelBookingModal } from './CancelBookingModal';
import { formatZoomAccountName } from '../utils';

// P3: Extract Meeting ID from Zoom URL
const extractMeetingId = (joinUrl: string): string => {
    const match = joinUrl.match(/\/j\/(\d+)/);
    if (match) {
        const id = match[1];
        return id.replace(/(\d{3})(\d{4})(\d{4})/, '$1 $2 $3');
    }
    return 'N/A';
};

// P1: Generate full invitation text for copy
const generateInvitationText = (booking: ZoomBooking): string => {
    const formattedDate = format(
        new Date(booking.bookingDate),
        'MMMM d, yyyy',
        { locale: idLocale }
    );
    const meetingId = booking.meeting?.joinUrl
        ? extractMeetingId(booking.meeting.joinUrl)
        : 'N/A';

    return `${booking.zoomAccount?.name || 'Zoom'} is inviting you to a scheduled Zoom meeting.

Topic: ${booking.title}
Time: ${formattedDate} ${booking.startTime} Jakarta

Join Zoom Meeting
${booking.meeting?.joinUrl || 'Link will be available soon'}

Meeting ID: ${meetingId}
${booking.meeting?.password ? `Passcode: ${booking.meeting.password}` : ''}`.trim();
};

interface UpcomingMeetingsPanelProps {
    className?: string;
    maxItems?: number;
    /** Render as a compact horizontal bottom strip */
    compact?: boolean;
}

export function UpcomingMeetingsPanel({ className, maxItems = 5, compact = false }: UpcomingMeetingsPanelProps) {
    const { data: bookings, isLoading } = useMyUpcomingBookings();
    const cancelBooking = useCancelOwnBooking();

    // Modal states
    const [rescheduleBooking, setRescheduleBooking] = useState<ZoomBooking | null>(null);
    const [cancelBookingState, setCancelBookingState] = useState<ZoomBooking | null>(null);
    const [cancelReason, setCancelReason] = useState('');

    const upcomingBookings = bookings || [];

    const handleCancelConfirm = async () => {
        if (!cancelBookingState || !cancelReason.trim()) return;

        try {
            await cancelBooking.mutateAsync({
                bookingId: cancelBookingState.id,
                dto: { cancellationReason: cancelReason },
            });
            toast.success('Booking berhasil dibatalkan');
            setCancelBookingState(null);
            setCancelReason('');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Gagal membatalkan booking');
        }
    };

    const copyToClipboard = async (text: string, label: string) => {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                const textArea = document.createElement("textarea");
                textArea.value = text;
                textArea.style.position = "fixed";
                textArea.style.left = "-999999px";
                textArea.style.top = "-999999px";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);
                if (!successful) throw new Error('Copy command failed');
            }
            toast.success(`${label} disalin ke clipboard!`);
        } catch (err) {
            console.error('Failed to copy text: ', err);
            toast.error('Gagal menyalin text. Clipboard tidak didukung.');
        }
    };

    const formatDateLabel = (dateStr: string) => {
        const date = parseISO(dateStr);
        if (isToday(date)) return 'Hari ini';
        if (isTomorrow(date)) return 'Besok';
        if (isThisWeek(date)) return format(date, 'EEEE', { locale: idLocale });
        return format(date, 'd MMM', { locale: idLocale });
    };

    if (isLoading) {
        return (
            <div className={cn("bg-card rounded-xl card-bordered p-4", className)}>
                <div className="flex items-center gap-2 mb-4">
                    <Video className="h-5 w-5 text-blue-500" />
                    <h3 className="font-bold">Upcoming Meetings</h3>
                </div>
                <div className="space-y-3 animate-pulse">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="p-3 bg-muted/50 rounded-lg">
                            <div className="h-4 w-32 bg-muted rounded mb-2" />
                            <div className="h-3 w-24 bg-muted rounded" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (upcomingBookings.length === 0) {
        if (compact) return null;
        return (
            <div className={cn("bg-card rounded-xl card-bordered p-4", className)}>
                <div className="flex items-center gap-2 mb-4">
                    <Video className="h-5 w-5 text-blue-500" />
                    <h3 className="font-bold">Upcoming Meetings</h3>
                </div>
                <div className="text-center py-6 text-muted-foreground">
                    <Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No upcoming meetings</p>
                    <p className="text-xs">Book a meeting to see it here</p>
                </div>
            </div>
        );
    }

    // Compact horizontal strip for bottom of calendar page
    if (compact) {
        const next = upcomingBookings[0];
        // Parse time limits to show pulse if within 30 min
        const showPulse = true; // Simplified for visual prominence

        return (
            <div className={cn(
                "flex items-center gap-3 px-4 py-3 bg-[hsl(var(--primary))]/10 dark:bg-[hsl(var(--primary))]/5 text-sm overflow-x-auto border-l-4 border-[hsl(var(--primary))] shadow-inner",
                className
            )}>
                <div className="flex items-center gap-1.5 shrink-0 relative">
                    <Badge variant="default" className={cn("h-6 px-2 text-[11px] uppercase font-bold tracking-wider rounded-md", showPulse && "animate-pulse bg-[hsl(var(--primary))]")}>NEXT</Badge>
                </div>
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-sm font-bold text-[hsl(var(--foreground))] truncate animate-[slideInLeft_0.3s_ease-out_forwards]">{next.title}</span>
                    <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))] shrink-0">
                        {formatDateLabel(next.bookingDate)} · {next.startTime}
                    </span>
                    {next.meeting?.joinUrl && (
                        <button
                            className="shrink-0 text-xs font-bold text-[hsl(var(--primary))] hover:underline flex items-center gap-1 bg-[hsl(var(--background))] px-2 py-1 rounded-md border border-[hsl(var(--border))]"
                            onClick={() => window.open(next.meeting!.joinUrl, '_blank')}
                        >
                            <ExternalLink className="h-3 w-3" />
                            Join
                        </button>
                    )}
                </div>
                {upcomingBookings.length > 1 && (
                    <span className="shrink-0 text-xs font-medium text-[hsl(var(--muted-foreground))]">+{upcomingBookings.length - 1} lainnya</span>
                )}
            </div>
        );
    }

    return (
        <div className={cn("bg-white dark:bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] shadow-sm", className)}>
            <div className="flex items-center justify-between p-4 border-b border-[hsl(var(--border))] sticky top-0 bg-white/95 dark:bg-[hsl(var(--card))]/95 backdrop-blur z-10">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-primary/10">
                        <Video className="h-4 w-4 text-primary" />
                    </div>
                    <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">Upcoming Meetings</h3>
                </div>
                <Badge variant="secondary" className="font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {upcomingBookings.length}
                </Badge>
            </div>

            <div className="divide-y divide-[hsl(var(--border))]">
                {upcomingBookings.map((booking) => (
                    <UpcomingMeetingItem
                        key={booking.id}
                        booking={booking}
                        dateLabel={formatDateLabel(booking.bookingDate)}
                        onCopyLink={(url) => copyToClipboard(url, 'Zoom link')}
                        onCopyInvitation={(text) => copyToClipboard(text, 'Zoom invitation')}
                        onReschedule={() => setRescheduleBooking(booking)}
                        onCancel={() => setCancelBookingState(booking)}
                    />
                ))}
            </div>

            {/* Reschedule Modal */}
            <RescheduleModal
                booking={rescheduleBooking}
                isOpen={!!rescheduleBooking}
                onClose={() => setRescheduleBooking(null)}
            />

            {/* Cancel Confirmation Modal */}
            <CancelBookingModal
                booking={cancelBookingState}
                isOpen={!!cancelBookingState}
                onClose={() => {
                    setCancelBookingState(null);
                    setCancelReason('');
                }}
                onSuccess={() => {
                    setCancelBookingState(null);
                    setCancelReason('');
                }}
                isOwner={true}
            />
        </div>
    );
}

interface UpcomingMeetingItemProps {
    booking: ZoomBooking;
    dateLabel: string;
    onCopyLink: (url: string) => void;
    onCopyInvitation: (text: string) => void;
    onReschedule: () => void;
    onCancel: () => void;
}

function UpcomingMeetingItem({
    booking,
    dateLabel,
    onCopyLink,
    onCopyInvitation,
    onReschedule,
    onCancel
}: UpcomingMeetingItemProps) {
    const hasZoomLink = !!booking.meeting?.joinUrl;

    return (
        <div className="p-4 hover:bg-muted/30 transition-colors">
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm truncate">{booking.title}</h4>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {dateLabel}
                        </span>
                        <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {booking.startTime} - {booking.endTime}
                        </span>
                    </div>
                </div>
                <Badge
                    variant="outline"
                    className="shrink-0"
                    style={{
                        borderColor: booking.zoomAccount?.colorHex,
                        color: booking.zoomAccount?.colorHex,
                    }}
                >
                    {formatZoomAccountName(booking.zoomAccount?.name)}
                </Badge>
            </div>

            {/* Zoom Link - THE KEY FEATURE */}
            {hasZoomLink ? (
                <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-[hsl(var(--border))]">
                    <div className="flex items-center gap-2 mb-2">
                        <Video className="h-4 w-4 text-primary" />
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            Zoom Meeting Link
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs bg-white dark:bg-slate-900 border border-[hsl(var(--border))] px-2 py-1.5 rounded-lg truncate font-mono text-slate-600 dark:text-slate-400">
                            {booking.meeting!.joinUrl}
                        </code>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="shrink-0 h-8 w-8 p-0"
                            onClick={() => onCopyLink(booking.meeting!.joinUrl)}
                            title="Copy link"
                        >
                            <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                            size="sm"
                            className="shrink-0 h-8 gap-1 bg-blue-500 hover:bg-blue-600"
                            onClick={() => window.open(booking.meeting!.joinUrl, '_blank')}
                        >
                            <ExternalLink className="h-3.5 w-3.5" />
                            <span className="text-xs">Join</span>
                        </Button>
                    </div>

                    {/* P3: Meeting ID display */}
                    <div className="flex items-center gap-2 mt-2 text-xs">
                        <Hash className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">Meeting ID:</span>
                        <code className="bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono text-xs">
                            {extractMeetingId(booking.meeting!.joinUrl)}
                        </code>
                    </div>

                    {booking.meeting!.password && (
                        <div className="flex items-center gap-2 mt-2 text-xs">
                            <span className="text-muted-foreground">Passcode:</span>
                            <code className="bg-white dark:bg-slate-800 px-2 py-0.5 rounded font-mono">
                                {booking.meeting!.password}
                            </code>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-5 w-5 p-0"
                                onClick={() => copyToClipboard(booking.meeting!.password!, 'Passcode')}
                                title="Copy passcode"
                            >
                                <Copy className="h-3 w-3" />
                            </Button>
                        </div>
                    )}

                    {/* P2: Copy Full Invitation Button */}
                    <Button
                        size="sm"
                        variant="outline"
                        className="w-full mt-3 text-xs"
                        onClick={() => onCopyInvitation(generateInvitationText(booking))}
                    >
                        <FileText className="h-3.5 w-3.5 mr-1.5" />
                        Copy Full Invitation
                    </Button>
                </div>
            ) : (
                <div className="mt-3 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                    <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                        <Clock className="h-4 w-4" />
                        <span>Zoom link akan tersedia setelah meeting dibuat</span>
                    </div>
                </div>
            )}

            {/* Action Buttons - Reschedule & Cancel */}
            <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: 'var(--border-width-default) solid var(--separator-color)' }}>
                <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs gap-1.5"
                    onClick={onReschedule}
                >
                    <CalendarClock className="h-3.5 w-3.5" />
                    Reschedule
                </Button>
                <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs gap-1.5 text-red-400 border-red-400/30 hover:bg-red-500/10 hover:text-red-300"
                    onClick={onCancel}
                >
                    <Trash2 className="h-3.5 w-3.5" />
                    Cancel
                </Button>
            </div>
        </div>
    );
}
