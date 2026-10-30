import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { cssVars, DashEmpty, DashStars } from './DashboardParts';
import { feedAge } from './dashboardChart';

const RATING_LEVELS = ['5', '4', '3', '2', '1'] as const;
const MAX_RECENT_COMMENTS = 5;
const RATING_STALE_MS = 60_000;
const PERCENT = 100;

export interface MyRatingsResponse {
    average: number | null;
    count: number;
    distribution: Record<string, number>;
    recent: { rating: number; comment: string | null; createdAt: string }[];
}

const formatAverage = (avg: number | null | undefined): string =>
    avg == null ? '-' : avg.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Agent dashboard card (mockup "Rating Saya"): average, distribution and anonymous recent feedback. */
export const MyRatingCard: React.FC<{ className?: string }> = ({ className }) => {
    const { data, isLoading, isError } = useQuery<MyRatingsResponse>({
        queryKey: ['agent-ratings', 'me'],
        queryFn: async () => (await api.get('/agent-ratings/me', { skipToast: true })).data,
        staleTime: RATING_STALE_MS,
    });

    const count = data?.count ?? 0;
    const comments = (data?.recent ?? []).filter((r) => r.comment).slice(0, MAX_RECENT_COMMENTS);

    return (
        <section aria-label="Rating Saya" className={cn('dash-panel', className)}>
            <h3>Rating Saya</h3>
            {isLoading ? (
                <p className="dash-panel-sub m-0">Memuat rating...</p>
            ) : isError ? (
                <p className="dash-panel-sub m-0">Gagal memuat rating.</p>
            ) : count === 0 ? (
                <DashEmpty icon={<Star aria-hidden="true" />}>Belum ada rating dari pengguna</DashEmpty>
            ) : (
                <>
                    <div className="dash-rate-sum">
                        <b>{formatAverage(data?.average)}</b>
                        <DashStars value={data?.average ?? 0} />
                        <small>{count} penilaian</small>
                    </div>
                    <div className="dash-hbars mb-3" aria-label="Sebaran rating">
                        {RATING_LEVELS.map((level) => {
                            const n = data?.distribution?.[level] ?? 0;
                            return (
                                <div key={level} className="dash-hb is-sm">
                                    <span className="dash-stars" aria-label={`${level} bintang`}>{level}<Star aria-hidden="true" /></span>
                                    <span className="dash-track"><i style={cssVars({ '--p': `${count > 0 ? (n / count) * PERCENT : 0}%`, '--c': 'var(--dash-star)' })} /></span>
                                    <b data-testid={`rating-dist-${level}`}>{n}</b>
                                </div>
                            );
                        })}
                    </div>
                    {comments.length > 0 && (
                        <>
                            <p className="dash-panel-sub" style={{ margin: '0 0 8px' }}>Kesan &amp; saran terbaru</p>
                            {comments.map((r, i) => (
                                <div key={i} className="dash-quote">
                                    <b><DashStars value={r.rating} />{r.rating}/5<small>{feedAge(r.createdAt)}</small></b>
                                    <p>{r.comment}</p>
                                </div>
                            ))}
                        </>
                    )}
                </>
            )}
        </section>
    );
};

export default MyRatingCard;
