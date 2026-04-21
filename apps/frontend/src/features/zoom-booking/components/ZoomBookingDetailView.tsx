/**
 * ZoomBookingDetailView — panel-based detail view.
 * Extracted from BookingDetailsModal (no Dialog wrapper).
 */
import { useState } from 'react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import {
    Video, Calendar, Clock, User, Link2, Copy,
    ExternalLink, FileText, Hash, Trash2,
    CheckCircle2, XCircle, Clock4, AlertCircle, CalendarClock, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useBookingDetails } from '../hooks';
import { useAuth } from '@/stores/useAuth';
import { CancelBookingModal } from './CancelBookingModal';
import { formatZoomAccountName } from '../utils';
import { cn } from '@/lib/utils';

const extractMeetingId = (joinUrl: string): string => {
    const match = joinUrl.match(/\/j\/(\d+)/);
    if (match) {
        const id = match[1];
        return id.replace(/(\d{3})(\d{4})(\d{4})/, '$1 $2 $3');
    }
    return 'N/A';
};

const generateInvitationText = (booking: any): string => {
    const formattedDate = format(new Date(booking.bookingDate), 'd MMMM yyyy', { locale: idLocale });
    const meetingId = booking.meeting?.joinUrl ? extractMeetingId(booking.meeting.joinUrl) : 'N/A';
    const accountName = formatZoomAccountName(booking.zoomAccount?.name);
    return `${accountName} is inviting you to a scheduled Zoom meeting.\n\nTopic: ${booking.title}\nTime: ${formattedDate} ${booking.startTime} Jakarta\n\nJoin Zoom Meeting\n${booking.meeting?.joinUrl || 'Link will be available soon'}\n\nMeeting ID: ${meetingId}${booking.meeting?.password ? `\nPasscode: ${booking.meeting.password}` : ''}`.trim();
};

interface ZoomBookingDetailViewProps {
    bookingId: string;
    onClose: () => void;
    onReschedule?: (booking: any) => void;
}

export function ZoomBookingDetailView({ bookingId, onClose, onReschedule }: ZoomBookingDetailViewProps) {
    const { user } = useAuth();
    const { data: booking, isLoading } = useBookingDetails(bookingId);
    const [showCancelModal, setShowCancelModal] = useState(false);

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        toast.success(`${label} disalin ke clipboard!`);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-48">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!booking) return null;

    const isOwner = user?.id === booking.bookedByUserId;
    const isCancelled = booking.status === 'CANCELLED';
    const isConfirmed = booking.status === 'CONFIRMED';
    const isPending = booking.status === 'PENDING';
    const isExternal = booking.isExternal;
    const canCancel = isOwner && !isCancelled && !isExternal;
    const canReschedule = isOwner && !isCancelled && !isExternal;

    return (
        <div className="flex flex-col">
            {/* Status banner */}
            <div className={cn(
                "h-20 w-full relative overflow-hidden",
                isConfirmed ? "bg-gradient-to-br from-emerald-500/20 via-emerald-400/10 to-transparent" :
                isCancelled ? "bg-gradient-to-br from-red-500/20 via-red-400/10 to-transparent" :
                "bg-gradient-to-br from-amber-500/20 via-amber-400/10 to-transparent"
            )}>
                <div
                    className="absolute -top-8 -right-8 w-32 h-32 rounded-full blur-3xl opacity-40"
                    style={{ backgroundColor: booking.zoomAccount?.colorHex || '#3b82f6' }}
                />
                <div className="absolute top-3 left-5">
                    {booking.zoomAccount && (
                        <Badge
                            className="px-3 py-1 font-semibold shadow-sm border-white/20"
                            style={{ backgroundColor: booking.zoomAccount.colorHex, color: '#fff' }}
                        >
                            <Video className="w-3.5 h-3.5 mr-1.5" />
                            {formatZoomAccountName(booking.zoomAccount.name)}
                        </Badge>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="px-5 pb-5 pt-3 -mt-8 relative z-10">
                {/* Status badge */}
                <div className="flex items-center gap-1.5 mb-3">
                    <div className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-sm shadow-sm border",
                        isConfirmed ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-400 dark:border-emerald-800" :
                        isCancelled ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/80 dark:text-red-400 dark:border-red-800" :
                        "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/80 dark:text-amber-400 dark:border-amber-800"
                    )}>
                        {isConfirmed ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                         isCancelled ? <XCircle className="w-3.5 h-3.5" /> :
                         <Clock4 className="w-3.5 h-3.5" />}
                        {booking.status}
                    </div>
                </div>

                <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight mb-1">
                    {booking.title}
                </h2>
                {booking.description && (
                    <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-4">
                        {booking.description}
                    </p>
                )}

                {/* External alert */}
                {isExternal && (
                    <div className="p-3 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 flex gap-2 mb-4">
                        <AlertCircle className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                            Meeting ini dibuat secara manual di Zoom. Perubahan harus dilakukan melalui Zoom Web Portal.
                        </p>
                    </div>
                )}

                {/* Info grid */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="flex bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-lg mr-2.5 h-fit">
                            <Calendar className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Tanggal</div>
                            <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                {format(new Date(booking.bookingDate), 'd MMM yyyy', { locale: idLocale })}
                            </div>
                        </div>
                    </div>
                    <div className="flex bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                        <div className="p-2 bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 rounded-lg mr-2.5 h-fit">
                            <Clock className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Waktu</div>
                            <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                {booking.startTime} - {booking.endTime}
                            </div>
                            <div className="text-[10px] text-slate-500">{booking.durationMinutes} menit</div>
                        </div>
                    </div>
                </div>

                {/* Booked by */}
                <div className="flex items-center p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800 mb-4">
                    <div className="p-2 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg mr-2.5">
                        <User className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Dibooking Oleh</div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">{booking.bookedByUser?.fullName}</div>
                    </div>
                </div>

                {/* Zoom link */}
                {booking.meeting ? (
                    <div className="bg-[hsl(var(--primary))]/5 border border-[hsl(var(--border))] rounded-xl p-4 mb-3">
                        <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold text-sm mb-3">
                            <Link2 className="w-4 h-4" />
                            <span>Informasi Join Zoom</span>
                        </div>
                        <div className="flex items-center gap-2 mb-3">
                            <Input
                                value={booking.meeting.joinUrl}
                                readOnly
                                className="flex-1 text-xs h-9 rounded-lg bg-white dark:bg-slate-900"
                            />
                            <Button size="icon" variant="outline" className="h-9 w-9 shrink-0 rounded-lg"
                                onClick={() => copyToClipboard(booking.meeting!.joinUrl, 'Link')}>
                                <Copy className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" className="h-9 w-9 shrink-0 rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
                                onClick={() => window.open(booking.meeting!.joinUrl, '_blank')}>
                                <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mb-3">
                            <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-blue-100/50">
                                <div className="flex items-center gap-1 text-[10px] text-slate-500 uppercase font-semibold mb-1">
                                    <Hash className="w-3 h-3" /> Meeting ID
                                </div>
                                <div className="flex justify-between items-center">
                                    <code className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                                        {extractMeetingId(booking.meeting.joinUrl)}
                                    </code>
                                    <button onClick={() => copyToClipboard(extractMeetingId(booking.meeting!.joinUrl), 'Meeting ID')}
                                        className="text-slate-400 hover:text-blue-600">
                                        <Copy className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                            {booking.meeting.password && (
                                <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-blue-100/50">
                                    <div className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Passcode</div>
                                    <div className="flex justify-between items-center">
                                        <code className="text-xs font-mono font-bold">{booking.meeting.password}</code>
                                        <button onClick={() => copyToClipboard(booking.meeting!.password!, 'Passcode')}
                                            className="text-slate-400 hover:text-blue-600">
                                            <Copy className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <Button variant="outline" className="w-full text-xs h-9 rounded-lg"
                            onClick={() => { navigator.clipboard.writeText(generateInvitationText(booking)); toast.success('Undangan disalin!'); }}>
                            <FileText className="h-3.5 w-3.5 mr-1.5" />
                            Salin Full Invitation
                        </Button>
                    </div>
                ) : (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-900/50 flex gap-2 mb-3">
                        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                            <h4 className="font-bold text-amber-800 dark:text-amber-300 text-xs">Zoom Link Belum Tersedia</h4>
                            <p className="text-amber-700/80 text-xs mt-0.5">
                                {isPending ? 'Sistem sedang memproses pembuatan link.' : `Dibooking oleh ${booking.bookedByUser?.fullName || 'pengguna lain'}.`}
                            </p>
                        </div>
                    </div>
                )}

                {/* Cancellation reason */}
                {isCancelled && booking.cancellationReason && (
                    <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-200 dark:border-red-900/50 flex gap-2 mb-3">
                        <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                        <div>
                            <h4 className="font-bold text-red-800 dark:text-red-300 text-xs">Dibatalkan</h4>
                            <p className="text-red-700/80 text-xs mt-0.5">Alasan: {booking.cancellationReason}</p>
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                    {canReschedule && onReschedule && (
                        <Button
                            variant="outline"
                            className="flex-1 text-xs gap-1.5 h-9"
                            onClick={() => onReschedule(booking)}
                        >
                            <CalendarClock className="h-3.5 w-3.5" />
                            Reschedule
                        </Button>
                    )}
                    {canCancel ? (
                        <Button
                            variant="outline"
                            className="flex-1 text-xs gap-1.5 h-9 text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => setShowCancelModal(true)}
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                            Batalkan
                        </Button>
                    ) : (
                        <Button variant="secondary" className="flex-1 text-xs h-9" onClick={onClose}>
                            Tutup
                        </Button>
                    )}
                </div>
            </div>

            {showCancelModal && (
                <CancelBookingModal
                    isOpen={showCancelModal}
                    onClose={() => setShowCancelModal(false)}
                    booking={booking}
                    onSuccess={() => {
                        setShowCancelModal(false);
                        onClose();
                    }}
                    isOwner={true}
                />
            )}
        </div>
    );
}
