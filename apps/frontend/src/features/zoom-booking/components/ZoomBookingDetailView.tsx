import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useBookingDetails } from '../hooks';
import { CancelBookingModal } from './CancelBookingModal';
import { SendReminderModal } from './SendReminderModal';
import { MeetingDetailContent } from './MeetingDetailContent';
import type { ZoomBooking } from '../types';

interface ZoomBookingDetailViewProps {
    bookingId: string;
    onClose: () => void;
    onReschedule?: (booking: ZoomBooking) => void;
}

export function ZoomBookingDetailView({ bookingId, onClose, onReschedule }: ZoomBookingDetailViewProps) {
    const { data: booking, isLoading } = useBookingDetails(bookingId);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [showReminderModal, setShowReminderModal] = useState(false);

    if (isLoading) {
        return (
            <div className="flex h-40 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Memuat detail meeting" />
            </div>
        );
    }

    if (!booking) return null;

    return (
        <>
            <MeetingDetailContent
                booking={booking}
                onReminder={() => setShowReminderModal(true)}
                onReschedule={onReschedule ? () => onReschedule(booking) : undefined}
                onCancel={() => setShowCancelModal(true)}
            />

            {showReminderModal && (
                <SendReminderModal
                    isOpen={showReminderModal}
                    onClose={() => setShowReminderModal(false)}
                    booking={booking}
                />
            )}
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
        </>
    );
}
