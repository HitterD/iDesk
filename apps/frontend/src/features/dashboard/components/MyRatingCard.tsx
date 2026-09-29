import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Star, MessageSquareQuote } from 'lucide-react';
import api from '@/lib/api';
import { formatRelativeTime } from '@/lib/utils/dateFormat';

const RATING_LEVELS = ['5', '4', '3', '2', '1'] as const;
const MAX_RECENT_COMMENTS = 5;

export interface MyRatingsResponse {
    average: number | null;
    count: number;
    distribution: Record<string, number>;
    recent: { rating: number; comment: string | null; createdAt: string }[];
}

/** Agent dashboard card: own average rating, distribution and anonymous recent feedback. */
export const MyRatingCard: React.FC = () => {
    const { data, isLoading, isError } = useQuery<MyRatingsResponse>({
        queryKey: ['agent-ratings', 'me'],
        queryFn: async () => (await api.get('/agent-ratings/me', { skipToast: true })).data,
        staleTime: 60_000,
    });

    const count = data?.count ?? 0;
    const comments = (data?.recent ?? []).filter((r) => r.comment).slice(0, MAX_RECENT_COMMENTS);

    return (
        <section aria-label="Rating Saya" className="bg-card border border-border rounded-2xl p-6 flex flex-col min-h-0">
            <h2 className="font-bold text-foreground text-lg tracking-tight mb-4">Rating Saya</h2>

            {isLoading ? (
                <p className="text-sm text-muted-foreground">Memuat rating...</p>
            ) : isError ? (
                <p className="text-sm text-muted-foreground">Gagal memuat rating.</p>
            ) : count === 0 ? (
                <div className="py-6 flex flex-col items-center justify-center text-center">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                        <Star className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">Belum ada rating dari pengguna</p>
                </div>
            ) : (
                <div className="space-y-5">
                    <div className="flex items-center gap-3">
                        <span className="text-4xl font-bold text-foreground">{data?.average?.toFixed(1) ?? '-'}</span>
                        <div>
                            <div className="flex items-center gap-0.5">
                                {[1, 2, 3, 4, 5].map((s) => (
                                    <Star
                                        key={s}
                                        className={
                                            s <= Math.round(data?.average ?? 0)
                                                ? 'w-4 h-4 fill-amber-400 text-amber-400'
                                                : 'w-4 h-4 text-muted-foreground/40'
                                        }
                                    />
                                ))}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{count} penilaian</p>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        {RATING_LEVELS.map((level) => {
                            const n = data?.distribution?.[level] ?? 0;
                            const pct = count > 0 ? (n / count) * 100 : 0;
                            return (
                                <div key={level} className="flex items-center gap-2 text-xs">
                                    <span className="w-3 text-muted-foreground">{level}</span>
                                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                        <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className="w-6 text-right text-muted-foreground" data-testid={`rating-dist-${level}`}>{n}</span>
                                </div>
                            );
                        })}
                    </div>

                    {comments.length > 0 && (
                        <div className="space-y-2">
                            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Kesan & saran terbaru</h3>
                            {comments.map((r, i) => (
                                <div key={i} className="p-2.5 rounded-xl bg-muted/50 text-xs space-y-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="flex items-center gap-1 font-semibold text-foreground">
                                            <MessageSquareQuote className="w-3.5 h-3.5 text-muted-foreground" />
                                            {r.rating}/5
                                        </span>
                                        <span className="text-muted-foreground">{formatRelativeTime(r.createdAt)}</span>
                                    </div>
                                    <p className="text-foreground/80 whitespace-pre-wrap">{r.comment}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </section>
    );
};

export default MyRatingCard;
