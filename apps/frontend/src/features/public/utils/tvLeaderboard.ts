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

export const BADGES: Record<BadgeKey, { emoji: string; label: string; hint: string }> = {
    champion: { emoji: '🏆', label: 'Juara Bulan Ini', hint: 'Tiket selesai terbanyak' },
    fastest: { emoji: '⚡', label: 'Kilat', hint: 'Penyelesaian tercepat' },
    perfectSla: { emoji: '🎯', label: 'SLA Sempurna', hint: '100% tepat SLA' },
    favorite: { emoji: '⭐', label: 'Favorit Pemohon', hint: 'Rating tertinggi' },
    responsive: { emoji: '🔥', label: 'Paling Responsif', hint: 'Respons pertama tercepat' },
    criticalSolver: { emoji: '💪', label: 'Penakluk Kritis', hint: 'Critical & High terbanyak' },
};

/** One theme per working day, Monday to Friday; weekends wrap around the same list. */
export const LEADERBOARD_THEMES = ['confetti', 'spotlight', 'fireworks', 'shootingStars', 'goldRibbon'] as const;
export type LeaderboardTheme = (typeof LEADERBOARD_THEMES)[number];

/**
 * The day's theme from the server's WIB date ("YYYY-MM-DD"), so every TV shows the same one:
 * Monday confetti, Tuesday spotlight, Wednesday fireworks, Thursday shooting stars, Friday gold ribbon.
 */
export function themeForDate(dateKey: string): LeaderboardTheme {
    const [y, m, d] = dateKey.split('-').map(Number);
    const weekday = new Date(Date.UTC(y, (m || 1) - 1, d || 1)).getUTCDay(); // 0 = Sunday
    const index = (weekday + 6) % 7; // Monday = 0
    return LEADERBOARD_THEMES[index % LEADERBOARD_THEMES.length];
}

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
export function playFanfare(context: AudioContext | null): boolean {
    if (!context || context.state !== 'running') return false;
    const start = context.currentTime + 0.05;
    const master = context.createGain();
    master.gain.value = 0.22;
    master.connect(context.destination);
    for (const [frequency, at, length] of FANFARE_NOTES) {
        const osc = context.createOscillator();
        const gain = context.createGain();
        osc.type = 'triangle';
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
