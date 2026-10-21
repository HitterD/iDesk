import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle, CheckCircle2, Calendar, Timer, Hourglass, History, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TicketPill } from '@/components/ui/ticket-pill';
import { format } from 'date-fns';
import { SlaAdjustment } from './ticket-detail/types';
import { offHoursLabel, slaCountdown, useSlaClock } from '@/lib/slaCountdown';

export interface TargetDateCellProps {
    ticket?: {
        slaTarget?: string;
        slaRemainingMinutes?: number | null;
        scheduledDate?: string;
        isHardwareInstallation?: boolean;
        status?: string;
        priority?: string;
        createdAt?: string;
        slaAdjustments?: SlaAdjustment[];
    };
    slaTarget?: string;
    slaRemainingMinutes?: number | null;
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
    if (remainingMs <= 0) return 'Lewat';

    const hours = Math.floor(remainingMs / (1000 * 60 * 60));
    const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
        const days = Math.floor(hours / 24);
        return `${days}h ${hours % 24}j`;
    }
    if (hours > 0) {
        return `${hours}j ${minutes}m`;
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
        return `Lewat ${days}h ${hours % 24}j`;
    }
    if (hours > 0) {
        return `Lewat ${hours}j ${minutes}m`;
    }
    return `Lewat ${minutes}m`;
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
    slaRemainingMinutes,
}) => {
    const [countdown, setCountdown] = useState<string>('');
    const [isOverdue, setIsOverdue] = useState(false);
    const [isApproaching, setIsApproaching] = useState(false);
    const [offHoursText, setOffHoursText] = useState<string | null>(null);
    const slaClock = useSlaClock();

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
        if (!targetDate || effectiveStatus === 'RESOLVED' || effectiveStatus === 'CLOSED' || effectiveStatus === 'CANCELLED' || effectiveStatus === 'WAITING_VENDOR' || effectiveIsHw) {
            return;
        }

        const updateCountdown = () => {
            const now = new Date();
            const clock = slaCountdown(targetDate, now, effectivePriority, slaClock);
            const remaining = clock.remainingMs;
            setOffHoursText(clock.offHours ? offHoursLabel(clock, now, slaClock) : null);

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
    }, [targetDate, effectiveStatus, effectiveIsHw, effectivePriority, slaClock]);

    // Resolved state
    if (effectiveStatus === 'RESOLVED' || effectiveStatus === 'CLOSED') {
        return (
            <TicketPill tone="green"
                aria-label="Tiket selesai"
            >
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                Selesai
            </TicketPill>
        );
    }

    // Waiting vendor state (SLA paused)
    if (effectiveStatus === 'WAITING_VENDOR') {
        const remaining = ticket?.slaRemainingMinutes ?? slaRemainingMinutes;
        return (
            <TicketPill tone="amber"
                title="SLA Timer di-pause selama menunggu vendor"
                aria-label="SLA Timer Paused"
            >
                <Pause className="w-3 h-3" aria-hidden="true" />
                {remaining != null ? `Dijeda · sisa ${remaining <= 0 ? '0m' : formatCountdown(remaining * 60_000)}` : 'Dijeda'}
            </TicketPill>
        );
    }

    // Hardware installation: show exact installation date
    if (effectiveIsHw && effectiveScheduledDate) {
        const target = new Date(effectiveScheduledDate);
        const formattedDate = format(target, 'dd MMM yyyy');
        return (
            <TicketPill tone="neutral"
                title={`Jadwal Pemasangan: ${format(target, 'dd MMMM yyyy')}`}
                aria-label={`Jadwal Pemasangan: ${format(target, 'dd MMMM yyyy')}`}
            >
                <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden="true" />
                <span className="font-medium">{formattedDate}</span>
            </TicketPill>
        );
    }

    // Cancelled state
    if (effectiveStatus === 'CANCELLED') {
        return (
            <TicketPill tone="neutral"
                aria-label="Ticket cancelled"
            >
                -
            </TicketPill>
        );
    }

    // No target date set
    if (!targetDate) {
        return (
            <TicketPill tone="neutral"
                aria-label="Belum ada target SLA"
            >
                <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                Tanpa SLA
            </TicketPill>
        );
    }

    const target = new Date(targetDate);
    const fullDate = format(target, 'dd MMMM yyyy HH:mm');
    const adjustments = ticket?.slaAdjustments ?? slaAdjustments ?? [];
    const isExtended = adjustments.length > 0;

    const getIcon = () => {
        if (isOverdue) return AlertTriangle;
        return Timer;
    };

    const Icon = getIcon();

    return (
        <div className="inline-flex items-center gap-1.5">
            <TicketPill tone={isOverdue ? 'red' : isApproaching ? 'amber' : 'blue'} className="cursor-help"
                title={`SLA Target: ${fullDate}${isExtended ? ` (Diperpanjang ${adjustments.length}x)` : ''}${offHoursText ? `
${offHoursText}` : ''}`}
                aria-label={`SLA Target: ${fullDate}${isOverdue ? ', overdue' : ''}${isApproaching ? ', approaching deadline' : ''}`}
            >
                {offHoursText
                    ? <Hourglass className="w-3.5 h-3.5" aria-hidden="true" />
                    : <Icon className={cn("w-3.5 h-3.5", isOverdue && "animate-pulse")} aria-hidden="true" />}
                <span className={isOverdue ? undefined : 'font-mono'}>{countdown}</span>
            </TicketPill>

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
