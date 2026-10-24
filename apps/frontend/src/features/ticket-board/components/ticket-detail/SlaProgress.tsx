import React from 'react';
import { cn } from '@/lib/utils';
import { formatDateTimeID } from '@/lib/utils/dateFormat';
import { slaCountdown, useSlaClock } from '@/lib/slaCountdown';
import { formatSlaDuration as formatDuration } from '@/lib/utils/slaDuration';
import { isTerminalStatus } from './constants';

const MS_PER_HOUR = 60 * 60 * 1000;
const WARNING_MS = 4 * MS_PER_HOUR;
const PAUSED_STATUSES = ['WAITING_VENDOR', 'PENDING'];

type SlaTone = 'ok' | 'warning' | 'overdue' | 'paused' | 'done';

const TONE: Record<SlaTone, { bar: string; text: string }> = {
    ok: { bar: 'bg-[hsl(var(--idesk-sapphire))]', text: 'text-[hsl(var(--idesk-sapphire))]' },
    warning: { bar: 'bg-[hsl(var(--ticket-amber))]', text: 'text-[hsl(var(--ticket-amber-ink))]' },
    overdue: { bar: 'bg-[hsl(var(--ticket-red))]', text: 'text-[hsl(var(--ticket-red-ink))]' },
    paused: { bar: 'bg-[hsl(var(--ticket-amber))]', text: 'text-[hsl(var(--ticket-amber-ink))]' },
    done: { bar: 'bg-[hsl(var(--ticket-green))]', text: 'text-[hsl(var(--ticket-green-ink))]' },
};

interface SlaProgressProps {
    status: string;
    priority?: string;
    createdAt: string;
    slaStartedAt?: string | null;
    slaTarget?: string | null;
    slaRemainingMinutes?: number | null;
    pausedAt?: string | null;
    /** Requester "Perkiraan waktu": no bar/percent; a paused ticket reads "Menunggu vendor". */
    variant?: 'agent' | 'requester';
    /** Muted text at the right of the label (requester: target date). */
    aside?: React.ReactNode;
    /** Requester label while paused, when the wait is not a vendor (e.g. "Menunggu hardware"). */
    pausedLabel?: string;
}

/** Remaining SLA time as a label plus a bar of time used (start → target). */
export const SlaProgress: React.FC<SlaProgressProps> = ({ status, priority, createdAt, slaStartedAt, slaTarget, slaRemainingMinutes, pausedAt, variant = 'agent', aside, pausedLabel }) => {
    const slaClock = useSlaClock();
    if (!slaTarget) return null;

    const now = new Date();
    const start = new Date(slaStartedAt || createdAt).getTime();
    const target = new Date(slaTarget).getTime();
    const isPaused = PAUSED_STATUSES.includes(status);
    const progressTime = isPaused && pausedAt ? new Date(pausedAt).getTime() : now.getTime();
    const usedRatio = target > start ? Math.min(1, Math.max(0, (progressTime - start) / (target - start))) : 1;

    let tone: SlaTone;
    let label: string;
    if (isTerminalStatus(status)) {
        tone = 'done';
        label = 'Selesai';
    } else if (isPaused) {
        tone = 'paused';
        label = variant === 'requester' && status === 'WAITING_VENDOR'
            ? pausedLabel ?? 'Menunggu vendor'
            : slaRemainingMinutes != null ? `Dijeda · sisa ${formatDuration(slaRemainingMinutes * 60_000)}` : 'Dijeda';
    } else {
        const { remainingMs, offHours } = slaCountdown(slaTarget, now, priority, slaClock);
        if (remainingMs <= 0) {
            tone = 'overdue';
            label = `Lewat ${formatDuration(-remainingMs)}`;
        } else {
            tone = offHours ? 'paused' : remainingMs < WARNING_MS ? 'warning' : 'ok';
            label = `Sisa ${formatDuration(remainingMs)}${offHours ? ' (di luar jam kerja)' : ''}`;
        }
    }

    const indeterminate = isPaused && !pausedAt;
    const percent = indeterminate ? undefined : tone === 'done' || tone === 'overdue' ? 100 : Math.round(usedRatio * 100);

    const right = variant === 'requester' ? aside : percent != null ? `${percent}% terpakai` : null;

    return (
        <div className="td-sla-big" title={isPaused ? (pausedAt ? `Dijeda sejak ${formatDateTimeID(pausedAt)}` : 'Dijeda') : `Target: ${formatDateTimeID(slaTarget)}`}>
            <div className="td-sla-t">
                <b className={cn('tabular-nums', TONE[tone].text)}>{label}</b>
                {right && <span className="tabular-nums">{right}</span>}
            </div>
            {variant === 'agent' && (
                <div
                    className="td-sla-bar"
                    role="progressbar"
                    aria-label="Waktu SLA terpakai"
                    aria-valuenow={percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                >
                    <i className={cn('transition-all', TONE[tone].bar)} style={{ width: `${percent ?? 0}%` }} />
                </div>
            )}
        </div>
    );
};
