import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle, CheckCircle2, Calendar, Wrench, Target, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface TargetDateCellProps {
    slaTarget?: string;
    scheduledDate?: string;
    isHardwareInstallation?: boolean;
    status: string;
}

/**
 * Format remaining time as countdown string
 */
function formatCountdown(remainingMs: number): string {
    if (remainingMs <= 0) return 'Overdue';

    const hours = Math.floor(remainingMs / (1000 * 60 * 60));
    const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
        const days = Math.floor(hours / 24);
        return `${days}d ${hours % 24}h`;
    }
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}

/**
 * Format overdue time as string
 */
function formatOverdue(overdueMs: number): string {
    const hours = Math.floor(Math.abs(overdueMs) / (1000 * 60 * 60));
    const minutes = Math.floor((Math.abs(overdueMs) % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
        const days = Math.floor(hours / 24);
        return `${days}d late`;
    }
    if (hours > 0) {
        return `${hours}h late`;
    }
    return `${minutes}m late`;
}

export const TargetDateCell: React.FC<TargetDateCellProps> = ({
    slaTarget,
    scheduledDate,
    isHardwareInstallation,
    status
}) => {
    const [countdown, setCountdown] = useState<string>('');
    const [isOverdue, setIsOverdue] = useState(false);
    const [isApproaching, setIsApproaching] = useState(false);

    // For hardware installation, show scheduledDate (user's chosen date)
    // For regular tickets, show slaTarget
    const targetDate = isHardwareInstallation ? scheduledDate : slaTarget;
    const dateType = isHardwareInstallation ? 'scheduled' : 'sla';

    // Live countdown effect - updates every 60 seconds
    useEffect(() => {
        if (!targetDate || status === 'RESOLVED' || status === 'CANCELLED') {
            return;
        }

        const updateCountdown = () => {
            const target = new Date(targetDate).getTime();
            const now = Date.now();
            const remaining = target - now;

            setIsOverdue(remaining < 0);
            setIsApproaching(remaining > 0 && remaining <= 4 * 60 * 60 * 1000); // 4 hours

            if (remaining < 0) {
                setCountdown(formatOverdue(remaining));
            } else {
                setCountdown(formatCountdown(remaining));
            }
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 60000); // 60 seconds

        return () => clearInterval(interval);
    }, [targetDate, status]);

    // Resolved state
    if (status === 'RESOLVED') {
        return (
            <span
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                aria-label="Ticket resolved"
            >
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                DONE
            </span>
        );
    }

    // No target date or cancelled
    if (!targetDate || status === 'CANCELLED') {
        return (
            <span
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100/50 text-slate-400 dark:bg-slate-800/50 dark:text-slate-500"
                aria-label="No target date set"
            >
                <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                No SLA
            </span>
        );
    }

    const target = new Date(targetDate);
    const fullDate = format(target, 'dd MMMM yyyy HH:mm');
    const dateLabel = isHardwareInstallation ? 'Installation' : 'SLA Target';

    // Choose icon based on status
    const getIcon = () => {
        if (isOverdue) return AlertTriangle;
        if (isApproaching) return Timer;
        if (isHardwareInstallation) return Wrench;
        return Target;
    };

    const Icon = getIcon();

    return (
        <div
            className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-help transition-colors",
                isOverdue && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 animate-pulse",
                isApproaching && !isOverdue && "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
                !isOverdue && !isApproaching && isHardwareInstallation && "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
                !isOverdue && !isApproaching && !isHardwareInstallation && "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            )}
            title={`${dateLabel}: ${fullDate}`}
            aria-label={`${dateLabel}: ${fullDate}${isOverdue ? ', overdue' : ''}${isApproaching ? ', approaching deadline' : ''}`}
        >
            <Icon className={cn("w-3.5 h-3.5", isOverdue && "animate-pulse")} aria-hidden="true" />
            <span className="font-mono">{countdown}</span>
        </div>
    );
};
