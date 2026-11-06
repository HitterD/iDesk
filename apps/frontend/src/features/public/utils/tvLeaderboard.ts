/** Shape of GET /tv/board/:token/leaderboard (backend tv-leaderboard.service.ts). */
export type BadgeKey = 'champion' | 'fastest' | 'perfectSla' | 'favorite' | 'responsive' | 'criticalSolver';

export interface LeaderboardAgent {
    agentId: string;
    name: string;
    avatarUrl: string | null;
    resolved: number;
    slaRate: number | null;
    avgResolutionMinutes: number | null;
    avgResponseMinutes: number | null;
    rating: number | null;
    ratingCount: number;
    criticalResolved: number;
    badges: BadgeKey[];
}

export interface TvLeaderboardData {
    active: boolean;
    dateKey: string;
    monthLabel: string;
    agentOfTheDay: { agent: LeaderboardAgent; period: 'today' | 'previous'; date: string } | null;
    topAgents: LeaderboardAgent[];
}

/** Company shown on the leaderboard header, before the board's site (same name as the login page). */
export const COMPANY_NAME = 'PT Santos Jaya Abadi';

/** "PT Santos Jaya Abadi · Sepanjang" from the board's site name. */
export const leaderboardOwner = (siteName: string): string => (siteName ? `${COMPANY_NAME} · ${siteName}` : COMPANY_NAME);

export const BADGES: Record<BadgeKey, { emoji: string; label: string; hint: string }> = {
    champion: { emoji: '🏆', label: 'Juara Bulan Ini', hint: 'Tiket selesai terbanyak' },
    fastest: { emoji: '⚡', label: 'Kilat', hint: 'Penyelesaian tercepat' },
    perfectSla: { emoji: '🎯', label: 'SLA Sempurna', hint: '100% tepat SLA' },
    favorite: { emoji: '⭐', label: 'Favorit Pemohon', hint: 'Rating tertinggi' },
    responsive: { emoji: '🔥', label: 'Paling Responsif', hint: 'Respons pertama tercepat' },
    criticalSolver: { emoji: '💪', label: 'Penakluk Kritis', hint: 'Critical & High terbanyak' },
};

/**
 * Nine looks, one per working day in turn, so two weeks in a row never look the same.
 * The first five are pixel / retro, the last four are polished "tech" panels.
 */
export const LEADERBOARD_THEMES = [
    'arcadeMaze', 'pixelSky', 'pixelSpace', 'blockStack', 'pixelForest',
    'neonCircuit', 'hexTech', 'mechaSteel', 'racing',
] as const;
export type LeaderboardTheme = (typeof LEADERBOARD_THEMES)[number];
const PIXEL_THEMES: ReadonlySet<LeaderboardTheme> = new Set(['arcadeMaze', 'pixelSky', 'pixelSpace', 'blockStack', 'pixelForest']);

export const isPixelTheme = (theme: LeaderboardTheme): boolean => PIXEL_THEMES.has(theme);

/** A Monday the rotation counts from; any Monday works, it only fixes the order. */
const ROTATION_START_UTC = Date.UTC(2024, 0, 1);
const MS_PER_DAY = 86_400_000;
const DAYS_PER_WEEK = 7;
const WORKING_DAYS_PER_WEEK = 5;

/** Working days (Mon-Fri) since the rotation start; a weekend counts as its Friday. */
export function workingDayIndex(dateKey: string): number {
    const [y, m, d] = dateKey.split('-').map(Number);
    const days = Math.floor((Date.UTC(y, (m || 1) - 1, d || 1) - ROTATION_START_UTC) / MS_PER_DAY);
    const weeks = Math.floor(days / DAYS_PER_WEEK);
    const weekday = days - weeks * DAYS_PER_WEEK; // 0 = Monday
    return weeks * WORKING_DAYS_PER_WEEK + Math.min(weekday, WORKING_DAYS_PER_WEEK - 1);
}

/** The day's look from the server's WIB date ("YYYY-MM-DD"): every TV shows the same one, the next working day the next. */
export function themeForDate(dateKey: string): LeaderboardTheme {
    const count = LEADERBOARD_THEMES.length;
    return LEADERBOARD_THEMES[((workingDayIndex(dateKey) % count) + count) % count];
}

/** Pixel looks get an 8-bit (square wave) fanfare, the others a softer one. */
export const fanfareWave = (theme: LeaderboardTheme): OscillatorType => (isPixelTheme(theme) ? 'square' : 'triangle');

/** "135" -> "2j 15m", "45" -> "45m". */
export function minutesLabel(minutes: number | null): string {
    if (minutes == null) return '—';
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${h}j ${rest}m` : `${h}j`;
}

/** First two initials for the avatar fallback. */
export function initialsOf(name: string): string {
    return name.trim().split(/\s+/).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('');
}

/** "BUDI SANTOSO" -> "Budi Santoso". */
export function titleName(name: string): string {
    return name.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

/** Notes of the congratulation fanfare: [frequency Hz, start s, length s]. C major arpeggio + chord. */
export const FANFARE_NOTES: ReadonlyArray<readonly [number, number, number]> = [
    [523.25, 0, 0.18], [659.25, 0.16, 0.18], [783.99, 0.32, 0.18], [1046.5, 0.48, 0.5],
    [783.99, 0.98, 0.14], [1046.5, 1.1, 1.1], [1318.51, 1.1, 1.1], [1567.98, 1.1, 1.1],
];

/** Plays the fanfare on a Web Audio context (no file to load, no license). Returns false when it cannot play. */
export function playFanfare(context: AudioContext | null, wave: OscillatorType = 'triangle'): boolean {
    if (!context || context.state !== 'running') return false;
    const start = context.currentTime + 0.05;
    const master = context.createGain();
    // Square waves are much louder at the same gain.
    master.gain.value = wave === 'square' ? 0.08 : 0.22;
    master.connect(context.destination);
    for (const [frequency, at, length] of FANFARE_NOTES) {
        const osc = context.createOscillator();
        const gain = context.createGain();
        osc.type = wave;
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(0, start + at);
        gain.gain.linearRampToValueAtTime(1, start + at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + at + length);
        osc.connect(gain).connect(master);
        osc.start(start + at);
        osc.stop(start + at + length + 0.05);
    }
    return true;
}
