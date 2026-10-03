import { DASHBOARD_TIMEZONE } from './agentDashboard.types';

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 1440;

/** 95 -> "1j 35m", 3000 -> "2h 2j"; null -> "-". */
export function formatDuration(minutes: number | null): string {
    if (minutes === null) return '-';
    if (minutes < MINUTES_PER_HOUR) return `${minutes}m`;
    if (minutes < MINUTES_PER_DAY) {
        const h = Math.floor(minutes / MINUTES_PER_HOUR);
        const m = minutes % MINUTES_PER_HOUR;
        return m ? `${h}j ${m}m` : `${h}j`;
    }
    const d = Math.floor(minutes / MINUTES_PER_DAY);
    const h = Math.floor((minutes % MINUTES_PER_DAY) / MINUTES_PER_HOUR);
    return h ? `${d}h ${h}j` : `${d}h`;
}

/** WIB date + time, e.g. "07 Okt 14:30". */
export function formatWibDateTime(iso: string): string {
    return new Date(iso).toLocaleString('id-ID', {
        timeZone: DASHBOARD_TIMEZONE, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
}

/** "2026-10-07" -> "07/10" for chart axes. */
export const shortDateLabel = (date: string): string => `${date.slice(8, 10)}/${date.slice(5, 7)}`;
