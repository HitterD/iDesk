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

const MS_PER_MINUTE = 60_000;
const NOON_HOUR = 11;
const AFTERNOON_HOUR = 15;
const EVENING_HOUR = 18;
const MORNING_HOUR = 4;
/** Leading tokens this short are titles ("RM", "H.", "Ir"), not first names. */
const MAX_TITLE_LENGTH = 2;

function humanSpan(minutes: number): string {
    if (minutes < 1) return '< 1 menit';
    if (minutes < MINUTES_PER_HOUR) return `${minutes} menit`;
    if (minutes < MINUTES_PER_DAY) return `${Math.floor(minutes / MINUTES_PER_HOUR)} jam`;
    return `${Math.floor(minutes / MINUTES_PER_DAY)} hari`;
}

/** SLA target relative to now: "Lewat 3 hari" / "Sisa 2 jam". */
export function formatSlaRelative(iso: string, now: Date = new Date()): { text: string; overdue: boolean } {
    const diffMinutes = Math.floor((new Date(iso).getTime() - now.getTime()) / MS_PER_MINUTE);
    const overdue = diffMinutes < 0;
    return { text: `${overdue ? 'Lewat' : 'Sisa'} ${humanSpan(Math.abs(diffMinutes))}`, overdue };
}

/** Time-of-day greeting in WIB. */
export function wibGreeting(now: Date = new Date()): string {
    const hour = Number(now.toLocaleString('en-US', { timeZone: DASHBOARD_TIMEZONE, hour: 'numeric', hourCycle: 'h23' }));
    if (hour >= MORNING_HOUR && hour < NOON_HOUR) return 'Selamat pagi';
    if (hour >= NOON_HOUR && hour < AFTERNOON_HOUR) return 'Selamat siang';
    if (hour >= AFTERNOON_HOUR && hour < EVENING_HOUR) return 'Selamat sore';
    return 'Selamat malam';
}

/** "RM BAGASTYO ANGGORO" -> "Bagastyo" (skips short leading titles, title-cases). */
export function firstName(fullName: string): string {
    const tokens = fullName.trim().split(/\s+/).filter(Boolean);
    const name = tokens.find((t) => t.replace(/\./g, '').length > MAX_TITLE_LENGTH) ?? tokens[0] ?? '';
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

/** SLA target relative to now in the queue's compact units: "Lewat 1j 40m" / "Sisa 2h 8j". */
export function formatSlaCompact(iso: string, now: Date = new Date()): { text: string; overdue: boolean } {
    const diffMs = new Date(iso).getTime() - now.getTime();
    const overdue = diffMs < 0;
    // Whole elapsed minutes either side of the target (never round an overdue span up).
    return { text: `${overdue ? 'Lewat' : 'Sisa'} ${formatDuration(Math.floor(Math.abs(diffMs) / MS_PER_MINUTE))}`, overdue };
}

/** "21 Okt 2026, 12.40" in WIB (page meta line). */
export function formatWibStamp(iso: string): string {
    return new Date(iso).toLocaleString('id-ID', {
        timeZone: DASHBOARD_TIMEZONE, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
}
