import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useBookingDetails } from '../hooks';
import { CancelBookingModal } from './CancelBookingModal';
import { RescheduleModal } from './RescheduleModal';
import { SendReminderModal } from './SendReminderModal';
import { MeetingDetailContent } from './MeetingDetailContent';

interface BookingDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    bookingId: string;
}

const DIALOG_CLASS = 'max-h-[90vh] max-w-md overflow-y-auto rounded-3xl border-0 bg-card p-0 shadow-[0_24px_60px_rgba(15,23,42,0.18)] dark:shadow-none';

export function BookingDetailsModal({ isOpen, onClose, bookingId }: BookingDetailsModalProps) {
    const { data: booking, isLoading } = useBookingDetails(bookingId);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [showRescheduleModal, setShowRescheduleModal] = useState(false);
    const [showReminderModal, setShowReminderModal] = useState(false);

    if (isLoading) {
        return (
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className={DIALOG_CLASS}>
                    <DialogTitle className="sr-only">Memuat detail meeting</DialogTitle>
                    <div className="flex h-48 items-center justify-center">
                        <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-primary dark:border-slate-700" />
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    if (!booking) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className={DIALOG_CLASS}>
                <MeetingDetailContent
                    booking={booking}
                    TitleAs={DialogTitle}
                    onReminder={() => setShowReminderModal(true)}
                    onReschedule={() => setShowRescheduleModal(true)}
                    onCancel={() => setShowCancelModal(true)}
                />
            </DialogContent>

            {showReminderModal && (
                <SendReminderModal
                    isOpen={showReminderModal}
                    onClose={() => setShowReminderModal(false)}
                    booking={booking}
                />
            )}
            {showRescheduleModal && <RescheduleModal isOpen={showRescheduleModal} onClose={() => setShowRescheduleModal(false)} booking={booking} />}
            {showCancelModal && (
                <CancelBookingModal
                    isOpen={showCancelModal}
                    onClose={() => setShowCancelModal(false)}
                    booking={booking}
                    onSuccess={() => {
                        setShowCancelModal(false);
                        onClose();
                    }}
                    isOwner
                />
            )}
        </Dialog>
    );
}
