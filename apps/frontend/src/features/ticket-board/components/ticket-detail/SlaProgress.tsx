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
    ok: { bar: 'bg-primary', text: 'text-primary' },
    warning: { bar: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
    overdue: { bar: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400' },
    paused: { bar: 'bg-slate-400', text: 'text-slate-500 dark:text-slate-400' },
    done: { bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
};

interface SlaProgressProps {
    status: string;
    priority?: string;
    createdAt: string;
    slaStartedAt?: string | null;
    slaTarget?: string | null;
    slaRemainingMinutes?: number | null;
    pausedAt?: string | null;
}

/** Remaining SLA time as a label plus a bar of time used (start → target). */
export const SlaProgress: React.FC<SlaProgressProps> = ({ status, priority, createdAt, slaStartedAt, slaTarget, slaRemainingMinutes, pausedAt }) => {
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
        label = slaRemainingMinutes != null ? `Dijeda · sisa ${formatDuration(slaRemainingMinutes * 60_000)}` : 'Dijeda';
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

    return (
        <div className="space-y-1.5" title={isPaused ? (pausedAt ? `Dijeda sejak ${formatDateTimeID(pausedAt)}` : 'Dijeda') : `Target: ${formatDateTimeID(slaTarget)}`}>
            <div className="flex items-baseline justify-between gap-2">
                <span className={cn('text-sm font-semibold tabular-nums', TONE[tone].text)}>{label}</span>
                {percent != null && <span className="text-[11px] tabular-nums text-slate-400">{percent}%</span>}
            </div>
            <div
                className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
                role="progressbar"
                aria-label="Waktu SLA terpakai"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
            >
                <div className={cn('h-full rounded-full transition-all', TONE[tone].bar)} style={{ width: `${percent ?? 0}%` }} />
            </div>
        </div>
    );
};
