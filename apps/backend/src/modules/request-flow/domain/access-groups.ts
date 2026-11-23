const DAY_MS = 86_400_000;
const WIB_OFFSET_MS = 7 * 3_600_000;

export type AccessGroup = 'soon' | 'expired' | 'active' | 'permanent';
export const ACCESS_GROUPS: readonly AccessGroup[] = ['soon', 'expired', 'active', 'permanent'];
/** Access ending within this many days is "segera berakhir". */
export const ACCESS_SOON_DAYS = 7;

/** The WIB calendar day of `at`, as whole days since the epoch. */
const wibDay = (at: Date): number => Math.floor((at.getTime() + WIB_OFFSET_MS) / DAY_MS);

/** Whole days from today (WIB) to `endDate` (`YYYY-MM-DD`); negative once the date has passed. */
export function daysLeft(endDate: string, today: Date = new Date()): number {
    return Date.parse(`${endDate}T00:00:00Z`) / DAY_MS - wibDay(today);
}

/** Which tab of "Masa Berlaku Akses" an access belongs to; no end date means permanent. */
export function accessGroupOf(endDate: string | null | undefined, today: Date = new Date()): AccessGroup {
    if (!endDate) return 'permanent';
    const left = daysLeft(endDate, today);
    if (left < 0) return 'expired';
    return left <= ACCESS_SOON_DAYS ? 'soon' : 'active';
}
