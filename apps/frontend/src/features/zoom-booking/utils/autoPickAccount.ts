import type { CalendarDay, ZoomAccount } from '../types';

export interface AccountLoad {
    id: string;
    name: string;
    colorHex: string;
    meetingsAtTime: number;
}

export interface AccountAvailability {
    id: string;
    bookingsByStartTime: Map<string, NonNullable<CalendarDay['slots'][number]['booking']>>;
}

export function buildAvailability(
    accounts: ZoomAccount[],
    calendars: Map<string, CalendarDay[]>,
    date: string,
): AccountAvailability[] {
    return accounts.map((account) => {
        const bookingsByStartTime = new Map<string, NonNullable<CalendarDay['slots'][number]['booking']>>();
        const day = calendars.get(account.id)?.find((calendarDay) => calendarDay.date === date);
        for (const slot of day?.slots ?? []) {
            if (slot.booking) bookingsByStartTime.set(slot.booking.startTime || slot.time, slot.booking);
        }
        return { id: account.id, bookingsByStartTime };
    });
}

export function autoPickAccount(
    accounts: AccountLoad[],
    _date: string,
    startTime?: string,
    durationMinutes?: number,
    availability: AccountAvailability[] = [],
): AccountLoad | null {
    if (accounts.length === 0) return null;

    const start = startTime ? toMinutes(startTime) : null;
    const end = start !== null && durationMinutes ? start + durationMinutes : null;
    const freeAccounts = start === null || end === null
        ? accounts
        : accounts.filter((account) => !hasOverlap(availability.find((entry) => entry.id === account.id), start, end));
    const candidates = freeAccounts.length ? freeAccounts : accounts;

    return [...candidates].sort((a, b) =>
        a.meetingsAtTime - b.meetingsAtTime || a.id.localeCompare(b.id),
    )[0];
}

function hasOverlap(availability: AccountAvailability | undefined, start: number, end: number): boolean {
    if (!availability) return false;
    for (const booking of availability.bookingsByStartTime.values()) {
        if (start < toMinutes(booking.endTime) && end > toMinutes(booking.startTime)) return true;
    }
    return false;
}

function toMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
}
