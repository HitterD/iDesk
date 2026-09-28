/**
 * Calendar colors for Zoom accounts.
 *
 * The old default palette (blue, teal, cyan, navy, two greens, two browns) made
 * accounts hard to tell apart. Accounts still on one of those defaults are shown
 * with a clearly distinct palette instead; custom colors picked in Settings are kept.
 */
export const ACCOUNT_PALETTE = [
    '#007AFF', // blue
    '#FF9500', // orange
    '#34C759', // green
    '#FF3B30', // red
    '#30B0C7', // teal
    '#FF2D55', // pink
    '#A2845E', // brown
    '#E0A800', // yellow
    '#8E8E93', // graphite
    '#5856D6', // indigo
] as const;

const LEGACY_DEFAULT_COLORS = new Set([
    '#2563EB', '#0D9488', '#D97706', '#0284C7', '#059669',
    '#EA580C', '#475569', '#15803D', '#B45309', '#1E40AF',
    '#3B82F6',
]);

/** Alpha suffix (~12%) appended to a #RRGGBB color for soft event backgrounds. */
export const SOFT_BG_ALPHA = '1F';

interface ColorableAccount {
    id: string;
    colorHex?: string | null;
    displayOrder?: number | null;
}

/** Color for the account at `index` in the (display-ordered) account list. */
export function resolveAccountColor(account: ColorableAccount, index: number): string {
    const hex = account.colorHex?.toUpperCase();
    if (hex && !LEGACY_DEFAULT_COLORS.has(hex)) return account.colorHex as string;
    const position = account.displayOrder && account.displayOrder > 0 ? account.displayOrder - 1 : index;
    return ACCOUNT_PALETTE[position % ACCOUNT_PALETTE.length];
}

/** Map of account id → calendar color. */
export function buildAccountColorMap(accounts: ColorableAccount[]): Map<string, string> {
    return new Map(accounts.map((a, i) => [a.id, resolveAccountColor(a, i)]));
}

/** Soft translucent background for an account color. */
export function softBackground(hex: string): string {
    return /^#[0-9a-f]{6}$/i.test(hex) ? `${hex}${SOFT_BG_ALPHA}` : hex;
}
