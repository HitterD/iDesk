import { ChevronRight, X, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
} from '@/components/ui/popover';

export interface OverflowBooking {
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    accountId: string;
    accountName: string;
    accountColorHex: string;
    isMine: boolean;
}

export interface ZoomOverflowPopoverProps {
    open: boolean;
    onClose: () => void;
    onSelectBooking: (bookingId: string) => void;
    onBookSlot: () => void;
    bookings: OverflowBooking[];
    timeRange: string;
    date: string;
}

export function ZoomOverflowPopover({
    open,
    onClose,
    onSelectBooking,
    onBookSlot,
    bookings,
    timeRange,
    date,
}: ZoomOverflowPopoverProps) {
    return (
        <Popover open={open} onOpenChange={(o) => !o && onClose()}>
            <PopoverContent
                className="w-[380px] p-0"
                align="start"
                side="top"
            >
                <div className="p-3 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 flex items-center justify-between">
                    <div>
                        <strong className="text-[13px] text-slate-800 dark:text-slate-200">
                            {bookings.length} Meeting · {timeRange}
                        </strong>
                        <div className="text-xs text-slate-500 mt-0.5">{date}</div>
                    </div>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        <X className="h-3.5 w-3.5" />
                    </Button>
                </div>

                <div className="max-h-[340px] overflow-y-auto">
                    {bookings.map((b) => (
                        <button
                            type="button"
                            key={b.id}
                            data-testid={`overflow-booking-${b.id}`}
                            onClick={() => onSelectBooking(b.id)}
                            className="w-full px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        >
                            <div
                                className="w-1 self-stretch rounded-full shrink-0"
                                style={{ backgroundColor: b.accountColorHex }}
                                aria-hidden="true"
                            />
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                                    {b.title}
                                </div>
                                <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                                    <span>
                                        {b.startTime} – {b.endTime}
                                    </span>
                                    <span className="text-slate-300" aria-hidden="true">·</span>
                                    <span className="flex items-center gap-1">
                                        <span
                                            className="w-1.5 h-1.5 rounded-full"
                                            style={{ backgroundColor: b.accountColorHex }}
                                            aria-hidden="true"
                                        />
                                        {b.accountName}
                                    </span>
                                </div>
                            </div>
                            {b.isMine && (
                                <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs font-semibold px-1.5 py-0.5 rounded">
                                    SAYA
                                </span>
                            )}
                            <ChevronRight className="h-3.5 w-3.5 text-slate-300 shrink-0" aria-hidden="true" />
                        </button>
                    ))}
                </div>

                <div className="p-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                    <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs text-blue-600 font-semibold gap-1 h-7"
                        onClick={onBookSlot}
                    >
                        <Zap className="h-3 w-3" aria-hidden="true" /> Book slot kosong
                    </Button>
                    <span className="text-xs text-slate-400">
                        klik meeting untuk detail
                    </span>
                </div>
            </PopoverContent>
        </Popover>
    );
}
