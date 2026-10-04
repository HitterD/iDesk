import { DEFAULT_TIMEZONE, localDateKey, startOfLocalDay } from '../../../modules/sla-config/business-hours.calc';

/**
 * Calendar helpers for WIB (Asia/Jakarta). The process runs with TZ=UTC
 * (main.ts), so `new Date('2026-10-04')`, `setHours(0)` and `getDate()` all
 * give UTC boundaries — 07:00 WIB — which drops the first seven hours of a
 * local day into the previous one.
 */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const WIB_OFFSET = '+07:00';
const MS_PER_DAY = 86_400_000;

/** 'YYYY-MM-DD' -> instant of 00:00 WIB that day; full ISO strings pass through. */
export function wibStartOfDate(date: string): Date {
    return new Date(DATE_ONLY.test(date) ? `${date}T00:00:00${WIB_OFFSET}` : date);
}

/** 'YYYY-MM-DD' -> last millisecond of that WIB day (inclusive end for BETWEEN). */
export function wibEndOfDate(date: string): Date {
    if (!DATE_ONLY.test(date)) return new Date(date);
    return new Date(wibStartOfDate(date).getTime() + MS_PER_DAY - 1);
}

/** Inclusive [start, end] instants covering whole WIB days for a date-only range. */
export function wibDateRange(startDate: string, endDate: string): { start: Date; end: Date } {
    return { start: wibStartOfDate(startDate), end: wibEndOfDate(endDate) };
}

/** 00:00 WIB of the day containing `at`. */
export function wibStartOfToday(at: Date = new Date()): Date {
    return startOfLocalDay(at, DEFAULT_TIMEZONE);
}

/** 00:00 WIB on the 1st of the WIB month containing `at`. */
export function wibStartOfMonth(at: Date = new Date()): Date {
    return wibStartOfDate(`${localDateKey(at, DEFAULT_TIMEZONE).slice(0, 7)}-01`);
}

/** 00:00 WIB on the Monday of the WIB week containing `at`. */
export function wibStartOfWeek(at: Date = new Date()): Date {
    const today = wibStartOfToday(at);
    const weekday = new Date(today.getTime() + 7 * 3_600_000).getUTCDay(); // 0 = Sunday, in WIB
    const daysSinceMonday = (weekday + 6) % 7;
    return new Date(today.getTime() - daysSinceMonday * MS_PER_DAY);
}

/** Whole WIB calendar month (1-12), inclusive bounds. */
export function wibMonthRange(year: number, month: number): { startDate: Date; endDate: Date } {
    const pad = (n: number) => String(n).padStart(2, '0');
    const next = month === 12 ? `${year + 1}-01-01` : `${year}-${pad(month + 1)}-01`;
    return {
        startDate: wibStartOfDate(`${year}-${pad(month)}-01`),
        endDate: new Date(wibStartOfDate(next).getTime() - 1),
    };
}

/** SQL expression for the WIB calendar date of a `timestamp` (UTC) column. */
export const wibDateSql = (column: string): string =>
    `DATE(${column} AT TIME ZONE 'UTC' AT TIME ZONE '${DEFAULT_TIMEZONE}')`;
