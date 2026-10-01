import { formatResume, slaCountdown, type SlaClockInfo } from '@/lib/slaCountdown';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export interface SlaStatus {
    label: string;
    overdue: boolean;
    /** Clock frozen outside working hours. */
    paused?: boolean;
}

export interface SlaClockContext {
    priority?: string;
    info: SlaClockInfo | null | undefined;
}

function formatDuration(ms: number): string {
    if (ms >= DAY_MS) return `${Math.floor(ms / DAY_MS)} hari`;
    if (ms >= HOUR_MS) return `${Math.floor(ms / HOUR_MS)} jam`;
    return `${Math.max(1, Math.floor(ms / MINUTE_MS))} mnt`;
}

/**
 * Human SLA text for a TV card, e.g. "Terlambat 3 hari" or "Sisa 2 jam".
 * The server's `isOverdue` flag wins over the local clock so a skewed TV clock can't hide a breach.
 */
export function formatSlaStatus(slaTarget: string | null, isOverdue: boolean, now: Date, clock?: SlaClockContext): SlaStatus | null {
    if (!slaTarget) return isOverdue ? { label: 'Terlambat', overdue: true } : null;

    if (Number.isNaN(new Date(slaTarget).getTime())) return isOverdue ? { label: 'Terlambat', overdue: true } : null;
    const countdown = slaCountdown(slaTarget, now, clock?.priority, clock?.info);
    const diffMs = countdown.remainingMs;

    if (isOverdue || diffMs <= 0) {
        return { label: diffMs < 0 ? `Terlambat ${formatDuration(-diffMs)}` : 'Terlambat', overdue: true };
    }
    if (countdown.offHours && countdown.resumesAt) {
        const resume = formatResume(countdown.resumesAt, now, clock?.info?.schedule.timezone);
        return { label: `Sisa ${formatDuration(diffMs)} · dijeda s/d ${resume}`, overdue: false, paused: true };
    }
    return { label: `Sisa ${formatDuration(diffMs)}`, overdue: false };
}

/** Absolute SLA deadline, e.g. "25 Jul 07.00", shown beside the relative text. */
export function formatSlaDeadline(slaTarget: string): string {
    const date = new Date(slaTarget);
    const day = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    const time = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    return `${day} ${time}`;
}

function slaTime(slaTarget: string | null): number {
    const time = slaTarget ? new Date(slaTarget).getTime() : NaN;
    return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
}

/** Most urgent first: overdue tickets, then the earliest SLA deadline; tickets without SLA go last. */
export function sortByUrgency<T extends { slaTarget: string | null; isOverdue: boolean }>(cards: readonly T[]): T[] {
    return [...cards].sort((a, b) => Number(b.isOverdue) - Number(a.isOverdue) || slaTime(a.slaTarget) - slaTime(b.slaTarget));
}
