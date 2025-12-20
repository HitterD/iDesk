import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Video, Calendar, Clock, User, Link2, Copy, ExternalLink, FileText, Hash } from 'lucide-react';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useBookingDetails } from '../hooks';
import { useAuth } from '@/stores/useAuth';
import type { ZoomBooking } from '../types';

interface BookingDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    bookingId: string;
}

const STATUS_COLORS = {
    PENDING: 'bg-yellow-500/20 text-yellow-700 border-yellow-500/40',
    CONFIRMED: 'bg-green-500/20 text-green-700 border-green-500/40',
    CANCELLED: 'bg-red-500/20 text-red-700 border-red-500/40',
};

// P3: Extract Meeting ID from Zoom URL
const extractMeetingId = (joinUrl: string): string => {
    const match = joinUrl.match(/\/j\/(\d+)/);
    if (match) {
        // Format with spaces for readability: 876 0676 0091
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

export function BookingDetailsModal({ isOpen, onClose, bookingId }: BookingDetailsModalProps) {
    const { user } = useAuth();
    const { data: booking, isLoading } = useBookingDetails(bookingId);

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        toast.success(`${label} copied!`);
    };

    const copyFullInvitation = () => {
        if (!booking) return;
        const invitation = generateInvitationText(booking);
        navigator.clipboard.writeText(invitation);
        toast.success('Zoom invitation copied to clipboard!');
    };

    if (isLoading) {
        return (
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent>
                    <div className="flex items-center justify-center h-48">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    if (!booking) {
        return null;
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Video className="h-5 w-5 text-blue-500" />
                        Detail Booking
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Status Badge */}
                    <div className="flex items-center justify-between">
                        <Badge className={STATUS_COLORS[booking.status as keyof typeof STATUS_COLORS]}>
                            {booking.status}
                        </Badge>
                        {booking.zoomAccount && (
                            <Badge
                                style={{ backgroundColor: booking.zoomAccount.colorHex }}
                                className="text-white"
                            >
                                {booking.zoomAccount.name}
                            </Badge>
                        )}
                    </div>

                    {/* Title */}
                    <div>
                        <h3 className="text-xl font-semibold">{booking.title}</h3>
                        {booking.description && (
                            <p className="text-muted-foreground mt-1">{booking.description}</p>
                        )}
                    </div>

                    {/* Date & Time */}
                    <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-muted-foreground" />
                            <div>
                                <div className="text-sm text-muted-foreground">Tanggal</div>
                                <div className="font-medium">
                                    {format(new Date(booking.bookingDate), 'EEEE, d MMMM yyyy', { locale: idLocale })}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Clock className="h-5 w-5 text-muted-foreground" />
                            <div>
                                <div className="text-sm text-muted-foreground">Waktu</div>
                                <div className="font-medium">
                                    {booking.startTime} - {booking.endTime} ({booking.durationMinutes} menit)
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Booked By */}
                    <div className="flex items-center gap-2">
                        <User className="h-5 w-5 text-muted-foreground" />
                        <div>
                            <div className="text-sm text-muted-foreground">Dibooking oleh</div>
                            <div className="font-medium">{booking.bookedByUser?.fullName}</div>
                        </div>
                    </div>

                    {/* Meeting Link - Only shown if backend returns meeting data (owner or admin) */}
                    {booking.meeting ? (
                        <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/30 space-y-3">
                            <div className="flex items-center gap-2 text-blue-600 font-medium">
                                <Link2 className="h-5 w-5" />
                                Zoom Meeting Link
                            </div>

                            <div className="flex items-center gap-2">
                                <Input
                                    value={booking.meeting.joinUrl}
                                    readOnly
                                    className="flex-1 text-sm bg-white dark:bg-slate-800"
                                />
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => copyToClipboard(booking.meeting!.joinUrl, 'Link')}
                                    title="Copy link"
                                >
                                    <Copy className="h-4 w-4" />
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={() => window.open(booking.meeting!.joinUrl, '_blank')}
                                    title="Open in new tab"
                                >
                                    <ExternalLink className="h-4 w-4" />
                                </Button>
                            </div>

                            {/* P3: Meeting ID display */}
                            <div className="flex items-center gap-2 text-sm">
                                <Hash className="h-4 w-4 text-muted-foreground" />
                                <span className="text-muted-foreground">Meeting ID:</span>
                                <code className="bg-white dark:bg-slate-800 px-2 py-0.5 rounded font-mono">
                                    {extractMeetingId(booking.meeting.joinUrl)}
                                </code>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0"
                                    onClick={() => copyToClipboard(extractMeetingId(booking.meeting!.joinUrl), 'Meeting ID')}
                                >
                                    <Copy className="h-3 w-3" />
                                </Button>
                            </div>

                            {booking.meeting.password && (
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="text-muted-foreground">Passcode:</span>
                                    <code className="bg-white dark:bg-slate-800 px-2 py-1 rounded font-mono">{booking.meeting.password}</code>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 w-6 p-0"
                                        onClick={() => copyToClipboard(booking.meeting!.password!, 'Passcode')}
                                    >
                                        <Copy className="h-3 w-3" />
                                    </Button>
                                </div>
                            )}

                            {/* P1: Copy Full Invitation Button */}
                            <Button
                                onClick={copyFullInvitation}
                                className="w-full mt-2 bg-blue-600 hover:bg-blue-700"
                            >
                                <FileText className="h-4 w-4 mr-2" />
                                Copy Full Invitation
                            </Button>
                        </div>
                    ) : (
                        /* Role-based: Show blocking info for non-owners without meeting access */
                        <div className="p-4 bg-amber-500/10 rounded-lg border border-amber-500/30">
                            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                                <Clock className="h-5 w-5" />
                                <span className="font-medium">Slot sudah dibooking</span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-2">
                                {booking.status === 'PENDING'
                                    ? 'Zoom link akan tersedia setelah meeting dikonfirmasi.'
                                    : `Slot ini sudah dibooking oleh ${booking.bookedByUser?.fullName || 'pengguna lain'}.`
                                }
                            </p>
                        </div>
                    )}

                    {/* Cancellation Info */}
                    {booking.status === 'CANCELLED' && booking.cancellationReason && (
                        <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/30">
                            <div className="text-red-600 font-medium">Alasan Pembatalan:</div>
                            <p className="text-sm mt-1">{booking.cancellationReason}</p>
                        </div>
                    )}

                    {/* Close Button */}
                    <div className="flex justify-end pt-2">
                        <Button variant="outline" onClick={onClose}>
                            Tutup
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
