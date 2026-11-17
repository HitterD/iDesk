import { createRoot } from 'react-dom/client';
import '@/index.css';
import '@/features/public/components/tv-leaderboard.css';
import '@/features/public/components/tv-leaderboard-themes.css';
import '@/features/public/components/tv-leaderboard-art.css';
import { TvLeaderboard } from '@/features/public/components/TvLeaderboard';
import { LEADERBOARD_THEMES, themeForDate, type LeaderboardAgent, type TvLeaderboardData } from '@/features/public/utils/tvLeaderboard';

document.documentElement.style.fontSize = 'clamp(14px, min(0.95vw, 1.7vh), 40px)';
const a = (name: string, resolved: number, badges: LeaderboardAgent['badges'], rating: number | null = 4.8): LeaderboardAgent => ({
    agentId: name, name, avatarUrl: null, resolved, slaRate: 96, avgResolutionMinutes: 95, avgResponseMinutes: 8, rating, ratingCount: 4, criticalResolved: 3, badges,
});
const want = new URLSearchParams(location.search).get('theme') ?? LEADERBOARD_THEMES[0];
// Find a date that lands on the requested look.
let dateKey = '2026-11-09';
for (let i = 0; i < 30; i++) { const d = new Date(Date.UTC(2026, 10, 9 + i)).toISOString().slice(0, 10); if (themeForDate(d) === want) { dateKey = d; break; } }
const data: TvLeaderboardData = {
    active: true, dateKey, monthLabel: 'November 2026',
    agentOfTheDay: { agent: a('BENY SAPUTRA, S.KOM', 4, ['perfectSla']), period: 'today', date: dateKey },
    topAgents: [
        a('ALPHIN SANTOSO PUTRA WIJAYA', 26, ['champion', 'criticalSolver']),
        a('RM BAGASTYO ANGGORO WIBOWO', 21, ['perfectSla', 'favorite']),
        a('ANDREW ALFONSO SETIAWAN', 20, ['fastest', 'perfectSla']),
        a('IGN ARDIAN KUSUMA', 20, []), a('YUDI ARTA TRIRENSILA', 14, []), a('BENY SAPUTRA, S.KOM', 13, [], null),
        a('KEVIN AUSTIN WIDJAJA', 11, []), a('YOHANES OCTAVIAN RIZKY NUGROHO', 8, []), a('BILLY EMANOEL', 6, [], null), a('JASON KRISTANTO', 6, []),
    ],
};
createRoot(document.getElementById('root')!).render(
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
        <TvLeaderboard data={data} siteName="Sepanjang" time="12.04" queue={{ open: 8, inProgress: 20, overdue: 2 }} />
    </div>,
);
