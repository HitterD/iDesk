import { useState } from 'react';
import { AlertTriangle, X, Calendar, Clock, Video, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { useCancelBooking, useCancelOwnBooking } from '../hooks';
import type { ZoomBooking } from '../types';
import { toast } from 'sonner';

interface CancelBookingModalProps {
    isOpen: boolean;
    onClose: () => void;
    booking: ZoomBooking | null;
    onSuccess?: () => void;
    isOwner?: boolean;  // If true, use user endpoint (cancel own booking)
}

export function CancelBookingModal({
    isOpen,
    onClose,
    booking,
    onSuccess,
    isOwner = false,
}: CancelBookingModalProps) {
    const [reason, setReason] = useState('');
    const cancelBookingAdmin = useCancelBooking();
    const cancelBookingOwner = useCancelOwnBooking();

    // Use the appropriate mutation based on who is cancelling
    const cancelBooking = isOwner ? cancelBookingOwner : cancelBookingAdmin;

    if (!booking) return null;

    const handleCancel = async () => {
        if (!reason.trim()) {
            toast.error('Alasan pembatalan wajib diisi');
            return;
        }

        if (reason.trim().length < 10) {
            toast.error('Alasan pembatalan minimal 10 karakter');
            return;
        }

        try {
            await cancelBooking.mutateAsync({
                bookingId: booking.id,
                dto: { cancellationReason: reason.trim() },
            });
            toast.success('Booking berhasil dibatalkan');
            setReason('');
            onSuccess?.();
            onClose();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Gagal membatalkan booking');
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-red-600">
                        <AlertTriangle className="h-5 w-5" />
                        Cancel Booking
                    </DialogTitle>
                    <DialogDescription>
                        Tindakan ini tidak dapat dibatalkan. Peserta akan diberitahu via email.
                    </DialogDescription>
                </DialogHeader>

                {/* Booking Details Summary */}
                <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                        <Video className="h-4 w-4 text-blue-500" />
                        <span className="font-medium">{booking.title}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>{booking.bookingDate}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>{booking.startTime} - {booking.endTime}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="h-4 w-4" />
                        <span>Booked by: {booking.bookedBy?.fullName || booking.bookedByUser?.fullName || '-'}</span>
                    </div>
                </div>

                {/* Cancellation Reason */}
                <div className="space-y-2">
                    <Label htmlFor="cancel-reason" className="text-red-600">
                        Alasan Pembatalan *
                    </Label>
                    <Textarea
                        id="cancel-reason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Contoh: Jadwal bentrok, meeting dipindahkan, dll..."
                        rows={3}
                        className="border-red-200 focus:border-red-500"
                    />
                    <p className="text-xs text-muted-foreground">
                        Alasan ini akan dikirim ke peserta meeting
                    </p>
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={onClose}>
                        Batal
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleCancel}
                        disabled={cancelBooking.isPending || !reason.trim()}
                    >
                        {cancelBooking.isPending ? 'Membatalkan...' : 'Ya, Batalkan Booking'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
