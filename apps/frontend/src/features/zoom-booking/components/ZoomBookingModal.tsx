import { X } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import type { ZoomAccount } from '../types';
import { ZoomBookingForm } from './ZoomBookingForm';
import { ZoomBookingDetailView } from './ZoomBookingDetailView';
import { ZoomRescheduleView } from './ZoomRescheduleView';

export interface ZoomBookingModalProps {
    open: boolean;
    onClose: () => void;
    mode: 'booking' | 'detail' | 'reschedule';
    /** Booking form fields */
    zoomAccountId?: string;
    preselectedDate?: string;
    preselectedTime?: string;
    /** Detail / Reschedule fields */
    bookingId?: string;
    booking?: any; // ZoomBooking — kept loose to avoid circular imports
    /** Shared */
    accounts: ZoomAccount[];
    onReschedule?: (booking: any) => void;
    onRescheduleSuccess?: () => void;
}

/**
 * Centered modal variant of the legacy slide-in `ZoomBookingPanel`.
 * Internally delegates content to ZoomBookingForm / DetailView / RescheduleView,
 * so all form logic stays in one place.
 */
export function ZoomBookingModal({
    open,
    onClose,
    mode,
    zoomAccountId,
    preselectedDate,
    preselectedTime,
    bookingId,
    booking,
    accounts,
    onReschedule,
    onRescheduleSuccess,
}: ZoomBookingModalProps) {
    const isMobile = useMediaQuery('(max-width: 767px)');

    const TITLES: Record<typeof mode, string> = {
        booking: 'Book Meeting',
        detail: 'Detail Meeting',
        reschedule: 'Reschedule Meeting',
    };

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent
                className={
                    isMobile
                        ? 'max-w-full max-h-[90vh] overflow-hidden p-0 gap-0'
                        : 'max-w-[640px] max-h-[90vh] overflow-hidden p-0 gap-0'
                }
            >
                <DialogTitle className="sr-only">{TITLES[mode]}</DialogTitle>

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-700 shrink-0">
                    <h2 className="font-semibold text-base">{TITLES[mode]}</h2>
                    <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close" className="h-8 w-8">
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {/* Body — calendar stays 100% visible in background */}
                <div className="overflow-y-auto flex-1 custom-scrollbar">
                    {mode === 'booking' && zoomAccountId && (
                        <ZoomBookingForm
                            zoomAccountId={zoomAccountId}
                            preselectedDate={preselectedDate}
                            preselectedTime={preselectedTime}
                            accounts={accounts}
                            onClose={onClose}
                        />
                    )}

                    {mode === 'detail' && bookingId && (
                        <ZoomBookingDetailView
                            bookingId={bookingId}
                            onClose={onClose}
                            onReschedule={onReschedule ?? (() => {})}
                        />
                    )}

                    {mode === 'reschedule' && booking && (
                        <ZoomRescheduleView
                            booking={booking}
                            onClose={onClose}
                            onSuccess={onRescheduleSuccess ?? onClose}
                        />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
