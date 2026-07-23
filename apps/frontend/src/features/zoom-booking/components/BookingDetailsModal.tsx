import { useState } from 'react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { 
    Video, Calendar, Clock, User, Link2, Copy, 
    ExternalLink, FileText, Hash, Trash2, 
    CheckCircle2, XCircle, Clock4, AlertCircle, CalendarClock
} from 'lucide-react';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useBookingDetails } from '../hooks';
import { useAuth } from '@/stores/useAuth';
import type { ZoomBooking } from '../types';
import { CancelBookingModal } from './CancelBookingModal';
import { RescheduleModal } from './RescheduleModal';
import { formatZoomAccountName, generateInvitationText, copyToClipboard } from '../utils';
import { cn } from '@/lib/utils';

interface BookingDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    bookingId: string;
}

const extractMeetingId = (joinUrl: string): string => {
    const match = joinUrl.match(/\/j\/(\d+)/);
    if (match) {
        const id = match[1];
        return id.replace(/(\d{3})(\d{4})(\d{4})/, '$1 $2 $3');
    }
    return 'N/A';
};

const STAFF_ROLES = [
    'ADMIN',
    'AGENT_OPERATIONAL_SUPPORT',
    'AGENT_ADMIN',
    'AGENT_ORACLE',
    'AGENT',
    'MANAGER',
];

export function BookingDetailsModal({ isOpen, onClose, bookingId }: BookingDetailsModalProps) {
    const { user } = useAuth();
    const { data: booking, isLoading } = useBookingDetails(bookingId);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [showRescheduleModal, setShowRescheduleModal] = useState(false);
    const [copiedInv, setCopiedInv] = useState(false);

    const copyFullInvitation = async () => {
        if (!booking) return;
        const invitation = generateInvitationText(booking);
        const ok = await copyToClipboard(invitation, 'Undangan');
        if (ok) {
            setCopiedInv(true);
            setTimeout(() => setCopiedInv(false), 2000);
        }
    };

    if (isLoading) {
        return (
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="sm:max-w-md border-none shadow-2xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl">
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    if (!booking) return null;

    const isOwner = user?.id === booking.bookedByUserId;
    const isStaff = !!(user?.role && STAFF_ROLES.includes(user.role));
    const isCancelled = booking.status === 'CANCELLED';
    const isConfirmed = booking.status === 'CONFIRMED';
    const isPending = booking.status === 'PENDING';
    const isExternal = booking.isExternal;
    const canManage = (isOwner || isStaff) && !isCancelled && !isExternal;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-lg p-0 border-none shadow-[0_20px_50px_-12px_rgba(0,0,0,0.2)] bg-white dark:bg-slate-950 overflow-hidden">
                {/* Visual Header Banner */}
                <div className={cn(
                    "h-24 w-full relative overflow-hidden",
                    isConfirmed ? "bg-gradient-to-br from-emerald-500/20 via-emerald-400/10 to-transparent" :
                    isCancelled ? "bg-gradient-to-br from-red-500/20 via-red-400/10 to-transparent" :
                    "bg-gradient-to-br from-amber-500/20 via-amber-400/10 to-transparent"
                )}>
                    {/* Abstract shapes for premium feel */}
                    <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl opacity-50 mix-blend-multiply dark:mix-blend-screen" 
                         style={{ backgroundColor: booking.zoomAccount?.colorHex || '#3b82f6' }} />
                    <div className="absolute top-4 left-6">
                        {booking.zoomAccount && (
                            <Badge 
                                className="px-3 py-1 font-semibold shadow-sm border-white/20 backdrop-blur-md"
                                style={{ backgroundColor: booking.zoomAccount.colorHex, color: '#fff' }}
                            >
                                <Video className="w-3.5 h-3.5 mr-1.5" />
                                {formatZoomAccountName(booking.zoomAccount.name)}
                            </Badge>
                        )}
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="px-7 pb-7 pt-4 flex flex-col -mt-10 relative z-10 bg-transparent">
                    {/* Status Badge Overlap */}
                    <div className="flex justify-between items-end mb-4">
                        <div className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-sm shadow-sm backdrop-blur-md border",
                            isConfirmed ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-400 dark:border-emerald-800" :
                            isCancelled ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/80 dark:text-red-400 dark:border-red-800" :
                            "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/80 dark:text-amber-400 dark:border-amber-800"
                        )}>
                            {isConfirmed ? <CheckCircle2 className="w-4 h-4" /> : 
                             isCancelled ? <XCircle className="w-4 h-4" /> : 
                             <Clock4 className="w-4 h-4" />}
                            {booking.status}
                        </div>
                    </div>

                    <DialogTitle className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
                        {booking.title}
                    </DialogTitle>
                    
                    {booking.description && (
                        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-6">
                            {booking.description}
                        </p>
                    )}

                    {/* External Meeting Alert */}
                    {isExternal && (
                        <div className="p-3.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 flex gap-3 mb-6">
                            <AlertCircle className="w-5 h-5 text-slate-500 dark:text-slate-400 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">External Zoom Meeting</h4>
                                <p className="text-slate-600 dark:text-slate-400 text-xs mt-0.5 leading-relaxed">
                                    Meeting ini dibuat secara manual di Zoom. Segala perubahan atau pembatalan harus dilakukan melalui Zoom Web Portal.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Information Grid */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="flex bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                            <div className="p-2.5 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-xl mr-3 h-fit">
                                <Calendar className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Tanggal</div>
                                <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                    {format(new Date(booking.bookingDate), 'd MMM yyyy', { locale: idLocale })}
                                </div>
                            </div>
                        </div>

                        <div className="flex bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                            <div className="p-2.5 bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 rounded-xl mr-3 h-fit">
                                <Clock className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Waktu</div>
                                <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                    {booking.startTime} - {booking.endTime}
                                </div>
                                <div className="text-xs text-slate-500 mt-0.5">{booking.durationMinutes} menit</div>
                            </div>
                        </div>
                    </div>

                    {/* User Info */}
                    <div className="flex items-center p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 mb-6">
                        <div className="p-2.5 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl mr-3">
                            <User className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Dibooking Oleh</div>
                            <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{booking.bookedByUser?.fullName}</div>
                        </div>
                    </div>

                    {/* Meeting Link Area */}
                    {booking.meeting ? (
                        <div className="bg-gradient-to-b from-blue-50/50 to-blue-50/10 dark:from-blue-950/30 dark:to-transparent border border-blue-100 dark:border-blue-900/50 rounded-2xl p-5 mb-2">
                            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold mb-4">
                                <Link2 className="w-5 h-5" />
                                <span>Informasi Join Zoom</span>
                            </div>

                            <div className="flex items-center gap-2 mb-4">
                                <Input
                                    value={booking.meeting.joinUrl}
                                    readOnly
                                    className="flex-1 bg-white dark:bg-slate-900 border-blue-200 dark:border-blue-800 text-sm h-10 rounded-xl focus-visible:ring-blue-500"
                                />
                                <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-10 w-10 shrink-0 rounded-xl border-blue-200 dark:border-blue-800 text-blue-600 hover:bg-blue-50"
                                    onClick={() => copyToClipboard(booking.meeting!.joinUrl, 'Link')}
                                    title="Copy link"
                                >
                                    <Copy className="h-4 w-4" />
                                </Button>
                                <Button
                                    size="icon"
                                    className="h-10 w-10 shrink-0 rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
                                    onClick={() => window.open(booking.meeting!.joinUrl, '_blank')}
                                    title="Join Meeting"
                                >
                                    <ExternalLink className="h-4 w-4" />
                                </Button>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <div className="flex flex-col gap-1.5 p-3 bg-white dark:bg-slate-900 rounded-xl border border-blue-100/50 dark:border-blue-900/30">
                                    <div className="flex items-center gap-1.5 text-xs text-slate-500 uppercase font-semibold">
                                        <Hash className="w-3.5 h-3.5" /> Meeting ID
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <code className="text-sm font-mono font-bold text-slate-800 dark:text-slate-200 tracking-wider">
                                            {extractMeetingId(booking.meeting.joinUrl)}
                                        </code>
                                        <button onClick={() => copyToClipboard(extractMeetingId(booking.meeting!.joinUrl), 'Meeting ID')} className="text-slate-400 hover:text-blue-600">
                                            <Copy className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                                {booking.meeting.password && (
                                    <div className="flex flex-col gap-1.5 p-3 bg-white dark:bg-slate-900 rounded-xl border border-blue-100/50 dark:border-blue-900/30">
                                        <div className="flex items-center gap-1.5 text-xs text-slate-500 uppercase font-semibold">
                                            Passcode
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <code className="text-sm font-mono font-bold text-slate-800 dark:text-slate-200 tracking-wider">
                                                {booking.meeting.password}
                                            </code>
                                            <button onClick={() => copyToClipboard(booking.meeting!.password!, 'Passcode')} className="text-slate-400 hover:text-blue-600">
                                                <Copy className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <Button
                                onClick={copyFullInvitation}
                                variant="outline"
                                className={cn(
                                    "w-full rounded-xl h-10 font-bold transition-all",
                                    copiedInv 
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800" 
                                        : "bg-white dark:bg-slate-900 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50"
                                )}
                            >
                                {copiedInv ? <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-600 dark:text-emerald-400" /> : <FileText className="h-4 w-4 mr-2" />}
                                {copiedInv ? 'Undangan Disalin ke Clipboard!' : 'Salin Full Invitation'}
                            </Button>
                        </div>
                    ) : (
                        <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-900/50 flex gap-3 mb-2">
                            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="font-bold text-amber-800 dark:text-amber-300 text-sm">Zoom Link Belum Tersedia</h4>
                                <p className="text-amber-700/80 dark:text-amber-400/80 text-xs mt-1 leading-relaxed">
                                    {isPending 
                                        ? 'Sistem sedang memproses pembuatan link Zoom Anda. Harap tunggu sesaat.' 
                                        : `Slot ruangan ini dibooking oleh ${booking.bookedByUser?.fullName || 'pengguna lain'}.`}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Cancellation Alert */}
                    {isCancelled && booking.cancellationReason && (
                        <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-2xl border border-red-200 dark:border-red-900/50 flex gap-3 mt-4">
                            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="font-bold text-red-800 dark:text-red-300 text-sm">Dibatalkan</h4>
                                <p className="text-red-700/80 dark:text-red-400/80 text-sm mt-1">
                                    Alasan: {booking.cancellationReason}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="pt-6 flex justify-between items-center gap-3">
                        {canManage ? (
                            <div className="flex items-center gap-2">
                                <Button 
                                    variant="outline" 
                                    className="rounded-xl font-bold h-11 px-4 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                    onClick={() => setShowRescheduleModal(true)}
                                >
                                    <CalendarClock className="w-4 h-4 mr-2" />
                                    Reschedule
                                </Button>
                                <Button 
                                    variant="ghost" 
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl font-bold h-11 px-4 transition-colors"
                                    onClick={() => setShowCancelModal(true)}
                                >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Batalkan
                                </Button>
                            </div>
                        ) : <div />}
                        
                        <Button 
                            variant="secondary" 
                            className="rounded-xl font-bold h-11 px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 transition-colors" 
                            onClick={onClose}
                        >
                            Tutup
                        </Button>
                    </div>
                </div>
            </DialogContent>

            {/* Direct Reschedule Modal integration */}
            {showRescheduleModal && (
                <RescheduleModal
                    isOpen={showRescheduleModal}
                    onClose={() => setShowRescheduleModal(false)}
                    booking={booking}
                />
            )}

            {/* Direct Cancel Modal integration */}
            {showCancelModal && (
                <CancelBookingModal
                    isOpen={showCancelModal}
                    onClose={() => setShowCancelModal(false)}
                    booking={booking}
                    onSuccess={() => {
                        setShowCancelModal(false);
                        onClose(); // auto close detail when successfully cancelled
                    }}
                    isOwner={true}
                />
            )}
        </Dialog>
    );
}
