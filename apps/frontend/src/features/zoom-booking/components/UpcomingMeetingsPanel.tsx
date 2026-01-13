import { useState } from 'react';
import { format, parseISO, isToday, isTomorrow, isThisWeek } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Video, Calendar, Clock, Copy, ExternalLink, FileText, Hash, CalendarClock, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useMyBookings, useCancelOwnBooking } from '../hooks';
import type { ZoomBooking } from '../types';
import { cn } from '@/lib/utils';
import { RescheduleModal } from './RescheduleModal';
import { CancelBookingModal } from './CancelBookingModal';

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
}

export function UpcomingMeetingsPanel({ className, maxItems = 5 }: UpcomingMeetingsPanelProps) {
    const { data: bookings, isLoading } = useMyBookings();
    const cancelBooking = useCancelOwnBooking();

    // Modal states
    const [rescheduleBooking, setRescheduleBooking] = useState<ZoomBooking | null>(null);
    const [cancelBookingState, setCancelBookingState] = useState<ZoomBooking | null>(null);
    const [cancelReason, setCancelReason] = useState('');

    // Filter to upcoming confirmed bookings only
    const upcomingBookings = bookings
        ?.filter(b => b.status === 'CONFIRMED')
        .filter(b => new Date(`${b.bookingDate}T${b.endTime}`) > new Date())
        .sort((a, b) => {
            const dateA = new Date(`${a.bookingDate}T${a.startTime}`);
            const dateB = new Date(`${b.bookingDate}T${b.startTime}`);
            return dateA.getTime() - dateB.getTime();
        })
        .slice(0, maxItems) || [];

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
        await navigator.clipboard.writeText(text);
        toast.success(`${label} copied to clipboard`);
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

    return (
        <div className={cn("bg-card/80 backdrop-blur-sm rounded-2xl border border-white/10 shadow-xl", className)}>
            <div className="flex items-center justify-between p-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-blue-500/20">
                        <Video className="h-4 w-4 text-blue-400" />
                    </div>
                    <h3 className="font-bold text-sm">Upcoming Meetings</h3>
                </div>
                <Badge variant="secondary" className="font-mono bg-blue-500/20 text-blue-400 border-blue-500/30">
                    {upcomingBookings.length}
                </Badge>
            </div>

            <div className="divide-y divide-white/5">
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
                    {booking.zoomAccount?.name}
                </Badge>
            </div>

            {/* Zoom Link - THE KEY FEATURE */}
            {hasZoomLink ? (
                <div className="mt-3 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                    <div className="flex items-center gap-2 mb-2">
                        <Video className="h-4 w-4 text-blue-500" />
                        <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                            Zoom Meeting Link
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs bg-white dark:bg-slate-800 px-2 py-1.5 rounded truncate font-mono">
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
                                onClick={() => navigator.clipboard.writeText(booking.meeting!.password!)}
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
