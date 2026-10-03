import { BusinessSchedule, DEFAULT_TIMEZONE, openingOfBusinessDay } from '../sla-config/business-hours.calc';
import { DEFAULT_HOLIDAYS } from '../sla-config/default-holidays';

/** Used when no BusinessHoursService is wired (unit tests): Mon-Fri 08:00-17:00 WIB. */
export const FALLBACK_SCHEDULE: BusinessSchedule = {
    workDays: [1, 2, 3, 4, 5],
    startTime: 480,
    endTime: 1020,
    timezone: DEFAULT_TIMEZONE,
    holidays: DEFAULT_HOLIDAYS,
};

export interface InstallDayTicket {
    isHardwareInstallation?: boolean | null;
    scheduledDate?: Date | null;
}

/**
 * Instant from which a hardware-installation ticket weighs on its technician:
 * opening time of the install day (H), or of the next working day when H is
 * a weekend/holiday. Null for tickets that always count immediately.
 */
export function installActivationAt(ticket: InstallDayTicket, schedule: BusinessSchedule): Date | null {
    if (!ticket.isHardwareInstallation || !ticket.scheduledDate) return null;
    return openingOfBusinessDay(new Date(ticket.scheduledDate), schedule);
}

/** Whether a ticket's priority points count towards workload at `now`. */
export function countsTowardsWorkload(ticket: InstallDayTicket, schedule: BusinessSchedule, now: Date): boolean {
    const activation = installActivationAt(ticket, schedule);
    return activation === null || now.getTime() >= activation.getTime();
}
