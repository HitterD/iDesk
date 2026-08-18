/**
 * ZoomMonthDayPopover — floating card showing all events for a day cell.
 * Appears when user clicks "+N more" in month view.
 */
import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { X, Video } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DayEvent {
    bookingId: string;
    status: string;
    title: string;
    startTime?: string;
    endTime?: string;
    joinUrl?: string;
}

const PILL_BG: Record<string, string> = {
    available:  'bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400',
    booked:     'bg-gradient-to-r from-amber-400 to-amber-500 text-white shadow-sm shadow-amber-200',
    my_booking: 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-sm shadow-blue-200',
    blocked:    'bg-gradient-to-r from-red-400 to-red-500 text-white shadow-sm',
    external:   'bg-slate-300 dark:bg-slate-600 text-slate-700 dark:text-slate-300',
};

interface ZoomMonthDayPopoverProps {
    date: string;
    events: DayEvent[];
    onClose: () => void;
    onEventClick: (bookingId: string) => void;
    anchorRef: React.RefObject<HTMLElement>;
}

export function ZoomMonthDayPopover({
    date,
    events,
    onClose,
    onEventClick,
    anchorRef,
}: ZoomMonthDayPopoverProps) {
    const parsedDate = parseISO(date);

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-40"
                onClick={onClose}
            />

            {/* Popover card */}
            <div
                className={cn(
                    "absolute z-50 w-56 rounded-2xl shadow-xl border",
                    "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700",
                    "animate-in fade-in-0 zoom-in-95 duration-150"
                )}
                style={{ top: '110%', left: 0 }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {format(parsedDate, 'd MMMM', { locale: idLocale })}
                    </span>
                    <button
                        onClick={onClose}
                        className="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <X className="h-3.5 w-3.5 text-slate-400" />
                    </button>
                </div>

                {/* Events list */}
                <div className="p-2 space-y-1 max-h-48 overflow-y-auto">
                    {events.map((event) => (
                        <div
                            key={event.bookingId}
                            className={cn(
                                "w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium",
                                "flex items-center gap-2 group",
                                PILL_BG[event.status] ?? 'bg-slate-200 text-slate-800'
                            )}
                        >
                            <button
                                className="flex-1 flex items-center gap-2 truncate text-left transition-opacity hover:opacity-80 outline-none"
                                onClick={() => {
                                    onEventClick(event.bookingId);
                                    onClose();
                                }}
                            >
                                <Video className="h-3 w-3 shrink-0" />
                                <span className="truncate">{event.title}</span>
                                {event.startTime && (
                                    <span className="ml-auto text-xs opacity-80 shrink-0 mr-1">
                                        {event.startTime}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onEventClick(event.bookingId);
                                    onClose();
                                }}
                                className={cn(
                                    "shrink-0 px-2 py-0.5 rounded text-xs font-bold transition-colors ml-auto shadow-sm",
                                    "bg-white/20 hover:bg-white/30 text-current"
                                )}
                            >
                                Detail
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
}
