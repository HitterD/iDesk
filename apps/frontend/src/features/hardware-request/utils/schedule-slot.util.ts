const MS_PER_HOUR = 60 * 60 * 1000;

/**
 * Start/end of an installation slot on the picked calendar day, in the browser's timezone.
 *
 * Built from the date's local Y/M/D on purpose: `date.toISOString()` is UTC, so local
 * midnight in WIB (UTC+7) reads as the previous day and the slot landed a day early.
 */
export function buildSlotRange(day: Date, time: string, durationHours: number): { start: Date; end: Date } {
    const [hours, minutes = 0] = time.split(':').map(Number);
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes, 0, 0);
    const end = new Date(start.getTime() + durationHours * MS_PER_HOUR);
    return { start, end };
}
