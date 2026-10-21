/** Pure chart helpers shared by the dashboards (mockup pages.js `lines` / `columns`). */

export const DAYS_PER_WEEK = 7;
/** Periods longer than this read as noise per day, so they aggregate into weeks (mockup: 30/90 days weekly). */
export const DAILY_MAX_DAYS = 14;
const Y_TICKS = 4;
const Y_TICKS_FEW = 2;
/** Small counts get 0 / mid / max gridlines instead of one per ticket. */
const FEW_TICKS_MAX = 5;
const HEADROOM = 1.1;

export interface SeriesPoint {
    /** ISO date (yyyy-mm-dd) of the first day in the bucket. */
    start: string;
    /** ISO date of the last day in the bucket (same as start for daily buckets). */
    end: string;
    values: Record<string, number>;
}

/**
 * Daily rows -> buckets of `size` days, counted back from the latest day so the newest
 * bucket is complete and only the oldest one may be partial.
 */
export function bucketByDays<K extends string>(
    rows: readonly ({ date: string } & Record<K, number>)[],
    keys: readonly K[],
    size: number,
): SeriesPoint[] {
    const buckets: SeriesPoint[] = [];
    for (let endIdx = rows.length - 1; endIdx >= 0; endIdx -= size) {
        const startIdx = Math.max(0, endIdx - size + 1);
        const slice = rows.slice(startIdx, endIdx + 1);
        const values = Object.fromEntries(keys.map((k) => [k, slice.reduce((sum, r) => sum + r[k], 0)]));
        buckets.unshift({ start: rows[startIdx].date, end: rows[endIdx].date, values });
    }
    return buckets;
}

/** Daily up to two weeks, weekly beyond (mockup trend: 7 = per hari, 30/90 = per minggu). */
export const isWeekly = (days: number): boolean => days > DAILY_MAX_DAYS;

/** Y axis for the trend lines: 4 steps (2 for tiny counts) with ~10% headroom, round values. */
export function lineAxis(peak: number): { max: number; ticks: number[] } {
    const steps = peak <= FEW_TICKS_MAX ? Y_TICKS_FEW : Y_TICKS;
    const max = Math.max(steps, Math.ceil((peak * HEADROOM) / steps) * steps);
    return { max, ticks: Array.from({ length: steps + 1 }, (_, i) => (max / steps) * i) };
}

/** Y axis for columns: next "nice" top (20, 30, 200 ...) split into 4 steps. */
export function columnAxis(peak: number): { max: number; ticks: number[] } {
    const top = Math.max(peak, 1);
    const step = Math.pow(10, Math.floor(Math.log10(top)));
    const nice = Math.ceil(top / step) * step;
    // Small tops (5, 7 ...) would give fractional gridlines; round up to a multiple of the step count instead.
    const max = nice % Y_TICKS === 0 ? nice : Math.ceil(nice / Y_TICKS) * Y_TICKS;
    return { max, ticks: Array.from({ length: Y_TICKS + 1 }, (_, i) => (max / Y_TICKS) * i) };
}

const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/** "2026-10-15" -> "15 Okt". */
export function dayMonthLabel(isoDate: string): string {
    const [, m, d] = isoDate.split('-').map(Number);
    return `${d} ${MONTHS_ID[m - 1]}`;
}

/** "2026-10-15" -> "15/10" (mockup column axis). */
export function daySlashLabel(isoDate: string): string {
    const [, m, d] = isoDate.split('-').map(Number);
    return `${d}/${m}`;
}

/** Local calendar date as yyyy-mm-dd (the team dashboard buckets by the browser's day). */
export function localIsoDate(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

/** "2 mnt" · "1 jam" · "3 hr" (mockup feed time column). */
export function feedAge(iso: string, now: number = Date.now()): string {
    const minutes = Math.max(0, Math.floor((now - new Date(iso).getTime()) / MS_PER_MINUTE));
    if (minutes < 1) return 'baru';
    if (minutes < MINUTES_PER_HOUR) return `${minutes} mnt`;
    const hours = Math.floor(minutes / MINUTES_PER_HOUR);
    if (hours < HOURS_PER_DAY) return `${hours} jam`;
    return `${Math.floor(hours / HOURS_PER_DAY)} hr`;
}
