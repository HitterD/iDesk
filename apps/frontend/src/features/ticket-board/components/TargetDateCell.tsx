import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle, CheckCircle2, Calendar, Target, Timer, Hourglass, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { SlaAdjustment } from './ticket-detail/types';

export interface TargetDateCellProps {
    ticket?: {
        slaTarget?: string;
        scheduledDate?: string;
        isHardwareInstallation?: boolean;
        status?: string;
        priority?: string;
        createdAt?: string;
        slaAdjustments?: SlaAdjustment[];
    };
    slaTarget?: string;
    scheduledDate?: string;
    isHardwareInstallation?: boolean;
    status?: string;
    priority?: string;
    createdAt?: string;
    slaAdjustments?: SlaAdjustment[];
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
    ticket,
    slaTarget,
    scheduledDate,
    isHardwareInstallation,
    status,
    priority,
    createdAt,
    slaAdjustments,
}) => {
    const [countdown, setCountdown] = useState<string>('');
    const [isOverdue, setIsOverdue] = useState(false);
    const [isApproaching, setIsApproaching] = useState(false);

    const effectiveStatus = ticket?.status ?? status ?? '';
    const effectiveScheduledDate = ticket?.scheduledDate ?? scheduledDate;
    const effectiveIsHw = ticket?.isHardwareInstallation ?? isHardwareInstallation ?? false;
    const effectivePriority = ticket?.priority ?? priority;
    const effectiveCreatedAt = ticket?.createdAt ?? createdAt;

    // Determine target date: either explicit slaTarget or derived from createdAt + priority
    let targetDate = ticket?.slaTarget ?? slaTarget;
    if (!targetDate && effectiveCreatedAt && effectivePriority && effectivePriority !== 'HARDWARE_INSTALLATION') {
        const DEFAULT_MINUTES: Record<string, number> = {
            CRITICAL: 120,
            HIGH: 240,
            MEDIUM: 480,
            LOW: 1440,
        };
        const minutes = DEFAULT_MINUTES[effectivePriority] || 480;
        targetDate = new Date(new Date(effectiveCreatedAt).getTime() + minutes * 60000).toISOString();
    }

    useEffect(() => {
        if (!targetDate || effectiveStatus === 'RESOLVED' || effectiveStatus === 'CANCELLED' || effectiveStatus === 'WAITING_VENDOR' || effectiveIsHw) {
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
        const interval = setInterval(updateCountdown, 60000);

        return () => clearInterval(interval);
    }, [targetDate, effectiveStatus, effectiveIsHw]);

    // Resolved state
    if (effectiveStatus === 'RESOLVED') {
        return (
            <span
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60 shadow-2xs"
                aria-label="Ticket resolved"
            >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                DONE
            </span>
        );
    }

    // Waiting vendor state (SLA paused)
    if (effectiveStatus === 'WAITING_VENDOR') {
        return (
            <span
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60 shadow-2xs"
                title="SLA Timer di-pause selama menunggu vendor"
                aria-label="SLA Timer Paused"
            >
                <Hourglass className="w-3 h-3 text-amber-600 dark:text-amber-400 animate-pulse" aria-hidden="true" />
                Paused
            </span>
        );
    }

    // Hardware installation: show exact installation date
    if (effectiveIsHw && effectiveScheduledDate) {
        const target = new Date(effectiveScheduledDate);
        const formattedDate = format(target, 'dd MMM yyyy');
        return (
            <div
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-2xs"
                title={`Jadwal Pemasangan: ${format(target, 'dd MMMM yyyy')}`}
                aria-label={`Jadwal Pemasangan: ${format(target, 'dd MMMM yyyy')}`}
            >
                <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden="true" />
                <span className="font-medium">{formattedDate}</span>
            </div>
        );
    }

    // Cancelled state
    if (effectiveStatus === 'CANCELLED') {
        return (
            <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium text-slate-400 dark:text-slate-500"
                aria-label="Ticket cancelled"
            >
                -
            </span>
        );
    }

    // No target date set
    if (!targetDate) {
        return (
            <span
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-100/60 text-slate-400 dark:bg-slate-800/50 dark:text-slate-500"
                aria-label="No target date set"
            >
                <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                No SLA
            </span>
        );
    }

    const target = new Date(targetDate);
    const fullDate = format(target, 'dd MMMM yyyy HH:mm');
    const adjustments = ticket?.slaAdjustments ?? slaAdjustments ?? [];
    const isExtended = adjustments.length > 0;

    const getIcon = () => {
        if (isOverdue) return AlertTriangle;
        if (isApproaching) return Timer;
        return Target;
    };

    const Icon = getIcon();

    return (
        <div className="inline-flex items-center gap-1.5">
            <div
                className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium cursor-help transition-colors shadow-2xs",
                    isOverdue && "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/50 animate-pulse",
                    isApproaching && !isOverdue && "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50",
                    !isOverdue && !isApproaching && "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/80"
                )}
                title={`SLA Target: ${fullDate}${isExtended ? ` (Diperpanjang ${adjustments.length}x)` : ''}`}
                aria-label={`SLA Target: ${fullDate}${isOverdue ? ', overdue' : ''}${isApproaching ? ', approaching deadline' : ''}`}
            >
                <Icon className={cn("w-3.5 h-3.5", isOverdue && "animate-pulse")} aria-hidden="true" />
                <span className="font-mono">{countdown}</span>
            </div>

            {isExtended && (
                <span
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50"
                    title={`SLA telah diperpanjang ${adjustments.length} kali`}
                >
                    <History className="w-2.5 h-2.5" />
                    <span>+{adjustments.length}</span>
                </span>
            )}
        </div>
    );
};

export default TargetDateCell;
