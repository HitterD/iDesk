import { useEffect, useSyncExternalStore } from 'react';
import api from '@/lib/api';
import { logger } from '@/lib/logger';
import { businessMinutesBetween, BusinessSchedule, isWithinBusinessHours, nextBusinessStart } from './businessHours';
import { formatSlaSpan, workingDayMinutes } from './utils/slaDuration';

const MS_PER_MINUTE = 60_000;
const SLA_CLOCK_STALE_MS = 10 * MS_PER_MINUTE;

/** Server payload of GET /business-hours/sla-clock (also embedded in the TV board data). */
export interface SlaClockInfo {
    schedule: BusinessSchedule;
    businessHoursOnly: Record<string, boolean>;
}

export interface SlaCountdown {
    /** SLA milliseconds left (negative once overdue), counted the same way the server does. */
    remainingMs: number;
    /** Clock is frozen outside working hours; `resumesAt` is the next opening. */
    offHours: boolean;
    resumesAt: Date | null;
}

function countsBusinessHours(info: SlaClockInfo | null | undefined, priority: string | undefined): info is SlaClockInfo {
    if (!info) return false;
    return info.businessHoursOnly[priority ?? ''] !== false;
}

/**
 * Time left until `target`, skipping non-working time for business-hours priorities.
 * Without clock info (still loading) it falls back to wall-clock time.
 */
export function slaCountdown(
    target: string | Date,
    now: Date,
    priority: string | undefined,
    info: SlaClockInfo | null | undefined,
): SlaCountdown {
    const targetDate = new Date(target);
    if (!countsBusinessHours(info, priority)) {
        return { remainingMs: targetDate.getTime() - now.getTime(), offHours: false, resumesAt: null };
    }
    const { schedule } = info;
    const remainingMs = targetDate >= now
        ? businessMinutesBetween(now, targetDate, schedule) * MS_PER_MINUTE
        : -businessMinutesBetween(targetDate, now, schedule) * MS_PER_MINUTE;
    const offHours = remainingMs > 0 && !isWithinBusinessHours(now, schedule);
    return { remainingMs, offHours, resumesAt: offHours ? nextBusinessStart(now, schedule) : null };
}

/** e.g. "Sen 08.00" or "besok 08.00" for the off-hours label. */
export function formatResume(resumesAt: Date, now: Date, timezone = 'Asia/Jakarta'): string {
    const day = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: timezone });
    const time = resumesAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: timezone });
    const tomorrow = new Date(now.getTime() + 24 * 60 * MS_PER_MINUTE);
    if (day(resumesAt) === day(now)) return time;
    if (day(resumesAt) === day(tomorrow)) return `besok ${time}`;
    const weekday = resumesAt.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', timeZone: timezone });
    return `${weekday} ${time}`;
}

/** "SLA dijeda — di luar jam kerja (lanjut Sen 08.00)" */
export function offHoursLabel(countdown: SlaCountdown, now: Date, info: SlaClockInfo | null | undefined): string {
    const resume = countdown.resumesAt ? ` (lanjut ${formatResume(countdown.resumesAt, now, info?.schedule.timezone)})` : '';
    return `SLA dijeda — di luar jam kerja${resume}`;
}

// Module-level store instead of React Query: SLA cells render in many places
// (including the public TV board) that may sit outside a QueryClientProvider.
let current: SlaClockInfo | null = null;
let fetchedAt = 0;
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/** Seeds the clock from data the caller already has (the TV board payload). */
export function setSlaClockInfo(info: SlaClockInfo | null | undefined): void {
    // Ignore malformed payloads; countdowns then stay on wall-clock time.
    if (!info?.schedule || !info.businessHoursOnly || info === current) return;
    current = info;
    fetchedAt = Date.now();
    listeners.forEach(l => l());
}

function refresh(): void {
    if (inFlight || Date.now() - fetchedAt < SLA_CLOCK_STALE_MS) return;
    inFlight = Promise.resolve()
        .then(() => api.get<SlaClockInfo>('/business-hours/sla-clock'))
        .then(res => setSlaClockInfo(res?.data))
        .catch(err => logger.warn('SLA clock info unavailable, falling back to wall-clock countdowns', err))
        .finally(() => { inFlight = null; fetchedAt = Date.now(); });
}

/** Forces a refetch, e.g. after an admin changed the schedule or an SLA config. */
export function invalidateSlaClock(): void {
    fetchedAt = 0;
    refresh();
}

/**
 * Schedule + per-priority counting mode. Fetches for signed-in users unless
 * `fetch` is false (public pages seed it with {@link setSlaClockInfo}).
 */
export function useSlaClock(fetch = true): SlaClockInfo | null {
    const info = useSyncExternalStore(subscribe, () => current);
    useEffect(() => { if (fetch) refresh(); }, [fetch]);
    return info;
}

/** Working-day length (minutes) for a priority's SLA, or null when it counts calendar time. */
export function slaDayMinutes(info: SlaClockInfo | null | undefined, priority: string | undefined): number | null {
    return countsBusinessHours(info, priority) ? workingDayMinutes(info.schedule) : null;
}

/** "2 hari 3 jam kerja" for business-hours SLAs, "1 hari 2 jam" for calendar ones. */
export function formatSlaTime(ms: number, info: SlaClockInfo | null | undefined, priority: string | undefined): string {
    return formatSlaSpan(ms, slaDayMinutes(info, priority));
}
