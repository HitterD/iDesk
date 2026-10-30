import type { BusinessSchedule } from '../businessHours';

const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
export const MS_PER_MINUTE = 60_000;
const WALL_DAY_MINUTES = HOURS_PER_DAY * MINUTES_PER_HOUR;
const WIB = 'Asia/Jakarta';

/** Legacy compact form ("2h 3j", 24-hour days); kept for wall-clock durations only. */
export const formatSlaDuration = (ms: number): string => {
    const totalMinutes = Math.max(0, Math.floor(ms / MS_PER_MINUTE));
    const days = Math.floor(totalMinutes / WALL_DAY_MINUTES);
    const hours = Math.floor((totalMinutes % WALL_DAY_MINUTES) / MINUTES_PER_HOUR);
    const minutes = totalMinutes % MINUTES_PER_HOUR;
    if (days > 0) return `${days}h ${hours}j`;
    if (hours > 0) return `${hours}j ${minutes}m`;
    return `${minutes}m`;
};

/** Minutes in one working day of `schedule` (e.g. 08:00-17:00 = 540). */
export function workingDayMinutes(schedule: BusinessSchedule | null | undefined): number | null {
    if (!schedule) return null;
    const minutes = schedule.endTime - schedule.startTime;
    return minutes > 0 ? minutes : null;
}

/**
 * SLA time in words: "2 hari 3 jam kerja", "2 jam 10 mnt kerja", "45 mnt".
 * With a working day (business-hours SLA) a "hari" is one working day, not 24 hours, and the
 * text says "kerja"; without one it counts calendar days.
 */
export function formatSlaSpan(ms: number, dayMinutes: number | null): string {
    const total = Math.max(0, Math.floor(Math.abs(ms) / MS_PER_MINUTE));
    const perDay = dayMinutes ?? WALL_DAY_MINUTES;
    const days = Math.floor(total / perDay);
    const hours = Math.floor((total % perDay) / MINUTES_PER_HOUR);
    const minutes = total % MINUTES_PER_HOUR;
    const parts = days > 0
        ? [`${days} hari`, ...(hours > 0 ? [`${hours} jam`] : [])]
        : hours > 0 ? [`${hours} jam`, ...(minutes > 0 ? [`${minutes} mnt`] : [])] : [`${minutes} mnt`];
    return dayMinutes ? `${parts.join(' ')} kerja` : parts.join(' ');
}

const TARGET_DAY = new Intl.DateTimeFormat('id-ID', { timeZone: WIB, weekday: 'short', day: 'numeric', month: 'short' });
const TARGET_TIME = new Intl.DateTimeFormat('id-ID', { timeZone: WIB, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const TARGET_FULL = new Intl.DateTimeFormat('id-ID', {
    timeZone: WIB, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
const WIB_DATE_KEY = new Intl.DateTimeFormat('en-CA', { timeZone: WIB });

/** "Sel, 27 Okt · 14.00", "Hari ini · 15.30" or "Besok · 09.00", always in WIB. */
export function formatSlaTarget(target: Date, now: Date): string {
    const key = WIB_DATE_KEY.format(target);
    const time = TARGET_TIME.format(target);
    if (key === WIB_DATE_KEY.format(now)) return `Hari ini · ${time}`;
    if (key === WIB_DATE_KEY.format(new Date(now.getTime() + WALL_DAY_MINUTES * MS_PER_MINUTE))) return `Besok · ${time}`;
    return `${TARGET_DAY.format(target)} · ${time}`;
}

/** "Selasa, 27 Oktober 2026 14.00 WIB" for tooltips. */
export const formatSlaTargetFull = (target: Date): string => `${TARGET_FULL.format(target)} WIB`;

/** "Sen–Jum 08.00–17.00 WIB (1 hari kerja = 9 jam)" for tooltips. */
export function describeWorkingHours(schedule: BusinessSchedule): string {
    const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const clock = (m: number) => `${String(Math.floor(m / MINUTES_PER_HOUR)).padStart(2, '0')}.${String(m % MINUTES_PER_HOUR).padStart(2, '0')}`;
    const days = [...schedule.workDays].sort((a, b) => a - b);
    const contiguous = days.every((d, i) => i === 0 || d === days[i - 1] + 1);
    const dayText = days.length > 2 && contiguous ? `${DAYS[days[0]]}–${DAYS[days[days.length - 1]]}` : days.map((d) => DAYS[d]).join(', ');
    const perDay = workingDayMinutes(schedule) ?? 0;
    const hours = perDay % MINUTES_PER_HOUR === 0 ? `${perDay / MINUTES_PER_HOUR} jam` : `${(perDay / MINUTES_PER_HOUR).toFixed(1)} jam`;
    return `${dayText} ${clock(schedule.startTime)}–${clock(schedule.endTime)} WIB (1 hari kerja = ${hours})`;
}
