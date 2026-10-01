/**
 * Pure business-hours arithmetic, evaluated in the schedule's timezone
 * (the server runs in UTC, so local Date getters must never be used here).
 * Shared by every SLA path so they all agree on what "working time" is.
 */
export interface BusinessSchedule {
    /** 0 = Sunday ... 6 = Saturday */
    workDays: number[];
    /** Minutes from midnight, e.g. 480 = 08:00 */
    startTime: number;
    /** Minutes from midnight, e.g. 1020 = 17:00 */
    endTime: number;
    /** IANA zone, e.g. 'Asia/Jakarta' */
    timezone: string;
    /** 'YYYY-MM-DD' dates in the schedule's timezone */
    holidays: string[];
}

export const DEFAULT_TIMEZONE = 'Asia/Jakarta';
const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;
/** Upper bound on days scanned, so a schedule without work days cannot loop forever. */
const MAX_DAYS_SCANNED = 3 * 366;

interface LocalDay {
    /** UTC instant of local midnight */
    midnight: number;
    key: string;
    weekday: number;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timezone: string): Intl.DateTimeFormat {
    let formatter = formatterCache.get(timezone);
    if (!formatter) {
        formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            hourCycle: 'h23',
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
        });
        formatterCache.set(timezone, formatter);
    }
    return formatter;
}

/** Offset (local - UTC) in ms of `timezone` at instant `ms`. */
function offsetAt(ms: number, timezone: string): number {
    const parts: Record<string, number> = {};
    for (const p of formatterFor(timezone).formatToParts(new Date(ms))) {
        if (p.type !== 'literal') parts[p.type] = Number(p.value);
    }
    const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    return asUtc - (ms - (ms % 1000));
}

function localDayOf(ms: number, timezone: string): LocalDay {
    const local = ms + offsetAt(ms, timezone);
    const localMidnight = local - (((local % MS_PER_DAY) + MS_PER_DAY) % MS_PER_DAY);
    const d = new Date(localMidnight);
    const key = d.toISOString().slice(0, 10);
    // Local midnight as a UTC instant; re-check the offset at that instant for DST zones.
    const midnight = localMidnight - offsetAt(localMidnight - offsetAt(ms, timezone), timezone);
    return { midnight, key, weekday: d.getUTCDay() };
}

function nextLocalDay(day: LocalDay, timezone: string): LocalDay {
    // +36h lands safely inside the next local day even across DST shifts.
    return localDayOf(day.midnight + 36 * 3_600_000, timezone);
}

function isWorkDay(day: LocalDay, schedule: BusinessSchedule, holidays: Set<string>): boolean {
    return schedule.workDays.includes(day.weekday) && !holidays.has(day.key);
}

/** Working window [open, close) of a local day as UTC instants. */
function windowOf(day: LocalDay, schedule: BusinessSchedule): [number, number] {
    return [day.midnight + schedule.startTime * MS_PER_MINUTE, day.midnight + schedule.endTime * MS_PER_MINUTE];
}

function tzOf(schedule: BusinessSchedule): string {
    return schedule.timezone || DEFAULT_TIMEZONE;
}

function isUsable(schedule: BusinessSchedule): boolean {
    return schedule.workDays?.length > 0 && schedule.endTime > schedule.startTime;
}

/** True when `at` falls inside a working window. */
export function isWithinBusinessHours(at: Date, schedule: BusinessSchedule): boolean {
    if (!isUsable(schedule)) return true;
    const ms = at.getTime();
    const day = localDayOf(ms, tzOf(schedule));
    if (!isWorkDay(day, schedule, new Set(schedule.holidays ?? []))) return false;
    const [open, close] = windowOf(day, schedule);
    return ms >= open && ms < close;
}

/** `at` itself when inside working hours, otherwise the next opening time. */
export function nextBusinessStart(at: Date, schedule: BusinessSchedule): Date {
    if (!isUsable(schedule)) return new Date(at);
    const tz = tzOf(schedule);
    const holidays = new Set(schedule.holidays ?? []);
    const ms = at.getTime();
    let day = localDayOf(ms, tz);
    for (let i = 0; i < MAX_DAYS_SCANNED; i++) {
        if (isWorkDay(day, schedule, holidays)) {
            const [open, close] = windowOf(day, schedule);
            if (ms < close) return new Date(Math.max(ms, open));
        }
        day = nextLocalDay(day, tz);
    }
    return new Date(at);
}

/**
 * Instant reached after `minutes` of working time from `start`.
 * Ends exactly at closing time rather than rolling to the next opening.
 */
export function addBusinessMinutes(start: Date, minutes: number, schedule: BusinessSchedule): Date {
    if (!Number.isFinite(minutes) || minutes <= 0) return new Date(start);
    if (!isUsable(schedule)) return new Date(start.getTime() + minutes * MS_PER_MINUTE);
    const tz = tzOf(schedule);
    const holidays = new Set(schedule.holidays ?? []);
    let cursor = start.getTime();
    let remaining = minutes * MS_PER_MINUTE;
    let day = localDayOf(cursor, tz);
    for (let i = 0; i < MAX_DAYS_SCANNED; i++) {
        if (isWorkDay(day, schedule, holidays)) {
            const [open, close] = windowOf(day, schedule);
            const from = Math.max(cursor, open);
            if (from < close) {
                if (remaining <= close - from) return new Date(from + remaining);
                remaining -= close - from;
            }
        }
        day = nextLocalDay(day, tz);
        cursor = day.midnight;
    }
    return new Date(cursor + remaining);
}

/** Working minutes between two instants (0 when `end` <= `start`). */
export function businessMinutesBetween(start: Date, end: Date, schedule: BusinessSchedule): number {
    const startMs = start.getTime();
    const endMs = end.getTime();
    if (!(endMs > startMs)) return 0;
    if (!isUsable(schedule)) return Math.round((endMs - startMs) / MS_PER_MINUTE);
    const tz = tzOf(schedule);
    const holidays = new Set(schedule.holidays ?? []);
    let total = 0;
    let day = localDayOf(startMs, tz);
    for (let i = 0; i < MAX_DAYS_SCANNED && day.midnight < endMs; i++) {
        if (isWorkDay(day, schedule, holidays)) {
            const [open, close] = windowOf(day, schedule);
            const from = Math.max(startMs, open);
            const to = Math.min(endMs, close);
            if (to > from) total += to - from;
        }
        day = nextLocalDay(day, tz);
    }
    return Math.round(total / MS_PER_MINUTE);
}

/** Closing time of the first working day strictly after the local day of `at`. */
export function endOfNextBusinessDay(at: Date, schedule: BusinessSchedule): Date {
    const tz = tzOf(schedule);
    const holidays = new Set(schedule.holidays ?? []);
    let day = nextLocalDay(localDayOf(at.getTime(), tz), tz);
    for (let i = 0; i < MAX_DAYS_SCANNED; i++) {
        if (!isUsable(schedule) || isWorkDay(day, schedule, holidays)) return new Date(windowOf(day, schedule)[1]);
        day = nextLocalDay(day, tz);
    }
    return new Date(windowOf(day, schedule)[1]);
}
