import React from 'react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Clock, User, Video, Calendar, Users } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';

interface BookingTooltipProps {
    children: React.ReactNode;
    booking: {
        id: string;
        title: string;
        description?: string;
        bookingDate: string;
        startTime: string;
        endTime: string;
        bookedBy?: {
            fullName: string;
            email?: string;
        };
        participants?: Array<{
            email: string;
            name?: string;
        }>;
        meeting?: {
            joinUrl?: string;
        };
    };
    isOwner?: boolean;
}

/**
 * Hoverable tooltip component for booking details
 * Shows full booking info on hover
 */
export function BookingTooltip({ children, booking, isOwner }: BookingTooltipProps) {
    const durationMinutes = calculateDuration(booking.startTime, booking.endTime);

    return (
        <Tooltip.Provider delayDuration={300}>
            <Tooltip.Root>
                <Tooltip.Trigger asChild>
                    {children}
                </Tooltip.Trigger>
                <Tooltip.Portal>
                    <Tooltip.Content
                        sideOffset={5}
                        className="z-50 w-72 rounded-xl bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700 p-4 animate-in fade-in-0 zoom-in-95"
                    >
                        {/* Header */}
                        <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-0.5">
                                <Video className="h-5 w-5 text-blue-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-slate-900 dark:text-white truncate">
                                    {booking.title}
                                </h4>
                                {booking.description && (
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                                        {booking.description}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="my-3 border-t border-slate-200 dark:border-slate-700" />

                        {/* Details */}
                        <div className="space-y-2">
                            {/* Date & Time */}
                            <div className="flex items-center gap-2 text-sm">
                                <Calendar className="h-4 w-4 text-slate-400" />
                                <span className="text-slate-600 dark:text-slate-300">
                                    {format(new Date(booking.bookingDate), 'EEEE, d MMM yyyy', { locale: idLocale })}
                                </span>
                            </div>

                            {/* Time Range */}
                            <div className="flex items-center gap-2 text-sm">
                                <Clock className="h-4 w-4 text-slate-400" />
                                <span className="text-slate-600 dark:text-slate-300">
                                    {booking.startTime} - {booking.endTime}
                                    <span className="ml-1.5 text-xs text-slate-400">
                                        ({durationMinutes} menit)
                                    </span>
                                </span>
                            </div>

                            {/* Booked By */}
                            <div className="flex items-center gap-2 text-sm">
                                <User className="h-4 w-4 text-slate-400" />
                                <span className="text-slate-600 dark:text-slate-300">
                                    {booking.bookedBy?.fullName || 'Unknown'}
                                    {isOwner && (
                                        <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                                            You
                                        </span>
                                    )}
                                </span>
                            </div>

                            {/* Participants */}
                            {booking.participants && booking.participants.length > 0 && (
                                <div className="flex items-start gap-2 text-sm">
                                    <Users className="h-4 w-4 text-slate-400 mt-0.5" />
                                    <div className="text-slate-600 dark:text-slate-300">
                                        {booking.participants.slice(0, 3).map((p, i) => (
                                            <span key={p.email}>
                                                {p.name || p.email}
                                                {i < Math.min(booking.participants!.length - 1, 2) && ', '}
                                            </span>
                                        ))}
                                        {booking.participants.length > 3 && (
                                            <span className="text-slate-400">
                                                {' '}+{booking.participants.length - 3} more
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer Actions Hint */}
                        <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-400 text-center">
                            Click for details
                        </div>

                        <Tooltip.Arrow className="fill-white dark:fill-slate-800" />
                    </Tooltip.Content>
                </Tooltip.Portal>
            </Tooltip.Root>
        </Tooltip.Provider>
    );
}

/**
 * Calculate duration in minutes between two time strings (HH:MM)
 */
function calculateDuration(startTime: string, endTime: string): number {
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    return (endH * 60 + endM) - (startH * 60 + startM);
}
