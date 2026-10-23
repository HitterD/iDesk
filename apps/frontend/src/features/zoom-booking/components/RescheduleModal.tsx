import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import type { ZoomBooking } from '../types';
import { ZoomRescheduleView } from './ZoomRescheduleView';

interface RescheduleModalProps {
    booking: ZoomBooking | null;
    isOpen: boolean;
    onClose: () => void;
}

/** Reschedule from "My bookings" / upcoming meetings: the same view the calendar modal uses, in its own dialog. */
export function RescheduleModal({ booking, isOpen, onClose }: RescheduleModalProps) {
    return (
        <Dialog open={isOpen && Boolean(booking)} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="flex flex-col max-w-[600px] max-h-[90vh] min-h-0 overflow-hidden p-0 gap-0">
                <div className="flex items-center px-5 py-3.5 border-b border-[hsl(var(--idesk-border))] shrink-0">
                    <DialogTitle className="font-semibold text-base">Jadwalkan ulang meeting</DialogTitle>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto">
                    {booking && <ZoomRescheduleView booking={booking} onClose={onClose} />}
                </div>
            </DialogContent>
        </Dialog>
    );
}
