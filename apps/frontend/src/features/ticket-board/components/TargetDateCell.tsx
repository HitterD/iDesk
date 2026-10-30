import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle, CheckCircle2, Calendar, Timer, Hourglass, History, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TicketPill } from '@/components/ui/ticket-pill';
import { format } from 'date-fns';
import { SlaAdjustment } from './ticket-detail/types';
import { offHoursLabel, slaCountdown, useSlaClock, type SlaClockInfo } from '@/lib/slaCountdown';
import {
    describeWorkingHours, formatSlaSpan, formatSlaTarget, formatSlaTargetFull, MS_PER_MINUTE, workingDayMinutes,
} from '@/lib/utils/slaDuration';

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
        vendorVisitAt?: string | null;
        vendorNote?: string | null;
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

/** Amber once this much working time is left. */
const DUE_SOON_MS = 4 * 60 * MS_PER_MINUTE;
const CLOCK_TICK_MS = 60_000;
const DEFAULT_SLA_MINUTES: Record<string, number> = { CRITICAL: 120, HIGH: 240, MEDIUM: 480, LOW: 1440 };

type SlaTone = 'ok' | 'soon' | 'late' | 'pause';

/** Working-day length for this priority, or null when its SLA counts calendar time. */
function dayMinutesFor(clock: SlaClockInfo | null, priority?: string): number | null {
    if (!clock || clock.businessHoursOnly[priority ?? ''] === false) return null;
    return workingDayMinutes(clock.schedule);
}

const SlaTwoLine: React.FC<{ tone: SlaTone; icon: React.ElementType; top: string; bottom?: string; title: string; label: string; extended?: number }> = ({
    tone, icon: Icon, top, bottom, title, label, extended,
}) => (
    <span className={cn('sla-cell', `is-${tone}`)} title={title} aria-label={label}>
        <b><Icon aria-hidden="true" />{top}</b>
        {bottom && <span>{bottom}</span>}
        {extended ? <i className="sla-cell-ext" title={`SLA telah diperpanjang ${extended} kali`}><History aria-hidden="true" />+{extended}</i> : null}
    </span>
);

/**
 * SLA of a ticket in two lines, readable without hovering: when the target falls (WIB) and how much
 * working time is left or overdue. The tooltip adds the full date, the working hours and extensions.
 */
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
    const [now, setNow] = useState(() => new Date());
    const slaClock = useSlaClock();

    const effectiveStatus = ticket?.status ?? status ?? '';
    const effectiveScheduledDate = ticket?.scheduledDate ?? scheduledDate;
    const effectiveIsHw = ticket?.isHardwareInstallation ?? isHardwareInstallation ?? false;
    const effectivePriority = ticket?.priority ?? priority;
    const effectiveCreatedAt = ticket?.createdAt ?? createdAt;

    // Determine target date: either explicit slaTarget or derived from createdAt + priority
    let targetDate = ticket?.slaTarget ?? slaTarget;
    if (!targetDate && effectiveCreatedAt && Number.isFinite(Date.parse(effectiveCreatedAt)) && effectivePriority && effectivePriority !== 'HARDWARE_INSTALLATION') {
        const minutes = DEFAULT_SLA_MINUTES[effectivePriority] || DEFAULT_SLA_MINUTES.MEDIUM;
        targetDate = new Date(new Date(effectiveCreatedAt).getTime() + minutes * MS_PER_MINUTE).toISOString();
    }

    const ticking = Boolean(targetDate) && !['RESOLVED', 'CLOSED', 'CANCELLED', 'WAITING_VENDOR'].includes(effectiveStatus) && !effectiveIsHw;
    useEffect(() => {
        if (!ticking) return;
        setNow(new Date());
        const interval = setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
        return () => clearInterval(interval);
    }, [ticking, targetDate]);

    const dayMinutes = dayMinutesFor(slaClock, effectivePriority);
    const hoursNote = dayMinutes && slaClock ? `\nDihitung dalam jam kerja ${describeWorkingHours(slaClock.schedule)}.` : '';

    if (effectiveStatus === 'RESOLVED' || effectiveStatus === 'CLOSED') {
        return (
            <TicketPill tone="green" aria-label="Tiket selesai">
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                Selesai
            </TicketPill>
        );
    }

    // Waiting vendor: the SLA clock is paused; show what is left and when the vendor is due.
    if (effectiveStatus === 'WAITING_VENDOR') {
        const remaining = ticket?.slaRemainingMinutes ?? slaRemainingMinutes;
        const visit = ticket?.vendorVisitAt ? new Date(ticket.vendorVisitAt) : null;
        const note = ticket?.vendorNote;
        const top = remaining != null ? `Dijeda · sisa ${formatSlaSpan(Math.max(0, remaining) * MS_PER_MINUTE, dayMinutes)}` : 'Dijeda';
        const title = [note, 'SLA berhenti selama menunggu vendor dan berjalan lagi saat status diubah.', visit ? `Janji vendor: ${formatSlaTargetFull(visit)}` : null]
            .filter(Boolean).join('\n');
        return (
            <SlaTwoLine tone="pause" icon={Pause} top={top} bottom={visit ? `vendor ${formatSlaTarget(visit, now)}` : undefined}
                title={title} label="SLA Timer Paused" />
        );
    }

    // Hardware installation: show exact installation date
    if (effectiveIsHw && effectiveScheduledDate) {
        const target = new Date(effectiveScheduledDate);
        const full = format(target, 'dd MMMM yyyy');
        return (
            <TicketPill tone="neutral" title={`Jadwal Pemasangan: ${full}`} aria-label={`Jadwal Pemasangan: ${full}`}>
                <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden="true" />
                <span className="font-medium">{format(target, 'dd MMM yyyy')}</span>
            </TicketPill>
        );
    }

    if (effectiveStatus === 'CANCELLED') {
        return <TicketPill tone="neutral" aria-label="Ticket cancelled">-</TicketPill>;
    }

    if (!targetDate) {
        return (
            <TicketPill tone="neutral" aria-label="Belum ada target SLA">
                <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                Tanpa SLA
            </TicketPill>
        );
    }

    const target = new Date(targetDate);
    const clock = slaCountdown(targetDate, now, effectivePriority, slaClock);
    const isOverdue = clock.remainingMs < 0;
    const isDueSoon = !isOverdue && clock.remainingMs <= DUE_SOON_MS;
    const offHours = clock.offHours ? offHoursLabel(clock, now, slaClock) : null;
    const adjustments = ticket?.slaAdjustments ?? slaAdjustments ?? [];
    const span = formatSlaSpan(clock.remainingMs, dayMinutes);
    const bottom = isOverdue ? `lewat ${span}` : `sisa ${span}`;
    const title = [
        `SLA Target: ${formatSlaTargetFull(target)}`,
        adjustments.length > 0 ? `Diperpanjang ${adjustments.length}×.` : null,
        offHours,
    ].filter(Boolean).join('\n') + hoursNote;
    const label = `SLA Target: ${formatSlaTargetFull(target)}${isOverdue ? ', overdue' : ''}${isDueSoon ? ', approaching deadline' : ''}`;

    return (
        <SlaTwoLine tone={isOverdue ? 'late' : isDueSoon ? 'soon' : 'ok'} icon={offHours ? Hourglass : isOverdue ? AlertTriangle : Timer}
            top={formatSlaTarget(target, now)} bottom={bottom} title={title} label={label} extended={adjustments.length} />
    );
};

export default TargetDateCell;
