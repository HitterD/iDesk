import { useEffect, useState } from 'react';
import api from '@/lib/api';
import type { TvLeaderboardData } from '../utils/tvLeaderboard';

/** The server decides when the leaderboard shows (WIB, working days); a minute poll lands within a minute of 12:00 / 13:00. */
export const LEADERBOARD_POLL_MS = 60_000;
/** While it is up, refresh the numbers a little more often so the agent of the day stays live. */
export const LEADERBOARD_ACTIVE_POLL_MS = 30_000;

/** Leaderboard of a TV board; null until loaded, or when the server is older than this feature. */
export function useTvLeaderboard(token: string | undefined): TvLeaderboardData | null {
    const [data, setData] = useState<TvLeaderboardData | null>(null);
    const active = Boolean(data?.active);

    useEffect(() => {
        if (!token) return;
        let cancelled = false;
        const load = () => {
            api.get(`/tv/board/${token}/leaderboard`, { skipToast: true })
                .then((res) => { if (!cancelled) setData(res.data); })
                // Keep the last state on a network blip; the queue board is the safe fallback.
                .catch(() => undefined);
        };
        load();
        const interval = setInterval(load, active ? LEADERBOARD_ACTIVE_POLL_MS : LEADERBOARD_POLL_MS);
        return () => { cancelled = true; clearInterval(interval); };
    }, [token, active]);

    return data;
}
