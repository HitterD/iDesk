import type { CalendarSlot } from '../types';

const BUSY: ReadonlySet<CalendarSlot['status']> = new Set(['booked', 'my_booking', 'blocked', 'external']);
const DAY_MINUTES = 24 * 60;

export const toMinutes = (time: string): number => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + (m || 0);
};
export const fromMinutes = (minutes: number): string =>
    `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/** "30 mnt", "1 jam", "1,5 jam". */
export const durationLabel = (minutes: number): string =>
    minutes < 60 ? `${minutes} mnt` : `${(minutes / 60).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jam`;

export interface Occupant { title: string; start: number; end: number; blocked: boolean }

/**
 * What already occupies the day, as minute ranges. A booking spanning several slots appears once; the booking
 * being rescheduled (`excludeBookingId`) does not count against itself.
 */
export function occupants(slots: CalendarSlot[] | undefined, excludeBookingId?: string): Occupant[] {
    const seen = new Set<string>();
    const result: Occupant[] = [];
    for (const slot of slots ?? []) {
        if (!BUSY.has(slot.status)) continue;
        if (slot.booking?.id && slot.booking.id === excludeBookingId) continue;
        const key = slot.booking?.id ?? `${slot.status}:${slot.time}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const start = toMinutes(slot.booking?.startTime ?? slot.time);
        const end = slot.booking?.endTime ? toMinutes(slot.booking.endTime) : toMinutes(slot.endTime || slot.time) || start + 30;
        result.push({ title: slot.status === 'blocked' ? 'Diblokir' : slot.booking?.title ?? 'Terisi', start, end, blocked: slot.status === 'blocked' });
    }
    return result;
}

/** The first occupant overlapping [start, start + duration), if any. */
export function clashWith(list: Occupant[], start: string, duration: number): Occupant | undefined {
    const from = toMinutes(start);
    const to = from + duration;
    return list.find((o) => from < o.end && to > o.start);
}

/** Whether a meeting of `duration` starting at `start` stays within the day. */
export const endsBeforeMidnight = (start: string, duration: number): boolean => toMinutes(start) + duration <= DAY_MINUTES;

/** "14.30" for display; the app shows times the Indonesian way. */
export const displayTime = (time: string): string => time.replace(':', '.');

/**
 * Reads a typed time: "9", "09", "930", "0930", "9.30", "9:30", "14", "1430". Returns "HH:mm", or null when it
 * is not a real clock time.
 */
export function parseTypedTime(text: string): string | null {
    const match = text.trim().match(/^(\d{1,2})(?:[.:\s]?(\d{2}))?$/);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2] ?? 0);
    if (hours > 23 || minutes > 59) return null;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
