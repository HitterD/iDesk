import { useQuery } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import api from '@/lib/api';
import { formatDateTimeID } from '@/lib/utils/dateFormat';

export interface AgentRatingsOverview {
    agents: { agentId: string; fullName: string; average: number | null; count: number }[];
    recent: {
        agentId: string;
        agentName: string;
        raterName: string;
        ticketId: string;
        ticketNumber: string | null;
        rating: number;
        comment: string | null;
        createdAt: string;
    }[];
}

const MAX_RECENT_ROWS = 10;
const TICKET_ID_SHORT_LENGTH = 8;

const RatingValue = ({ value }: { value: number | null }) => (
    <span className="inline-flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-100">
        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
        {value === null ? '-' : value.toFixed(1)}
    </span>
);

/** Admin/manager view of requester ratings: per-agent averages plus the latest feedback. */
export function AgentRatingsSection() {
    const { data, isLoading, isError } = useQuery<AgentRatingsOverview>({
        queryKey: ['agent-ratings', 'overview'],
        queryFn: async () => (await api.get('/agent-ratings', { skipToast: true })).data,
        staleTime: 60_000,
    });

    const agents = data?.agents ?? [];
    const recent = (data?.recent ?? []).slice(0, MAX_RECENT_ROWS);

    return (
        <section aria-label="Rating Agen" className="px-4 sm:px-6 py-4 border-t border-[hsl(var(--border))] space-y-4">
            <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500" aria-hidden="true" />
                Rating dari Pengguna
            </h4>

            {isLoading ? (
                <p className="text-sm text-slate-500">Memuat rating...</p>
            ) : isError ? (
                <p className="text-sm text-slate-500">Gagal memuat rating agen.</p>
            ) : agents.length === 0 ? (
                <p className="text-sm text-slate-500">Belum ada rating dari pengguna.</p>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                                    <th className="px-3 py-2 text-left">Agen</th>
                                    <th className="px-3 py-2 text-center">Rata-rata</th>
                                    <th className="px-3 py-2 text-center">Jumlah</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {agents.map((a) => (
                                    <tr key={a.agentId}>
                                        <td className="px-3 py-2 text-slate-800 dark:text-slate-100">{a.fullName}</td>
                                        <td className="px-3 py-2 text-center"><RatingValue value={a.average} /></td>
                                        <td className="px-3 py-2 text-center text-slate-600 dark:text-slate-400">{a.count}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="space-y-2">
                        <h5 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Rating Terbaru</h5>
                        {recent.map((r, i) => (
                            <div key={`${r.ticketId}-${r.agentId}-${i}`} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-xs space-y-1">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="font-semibold text-slate-800 dark:text-slate-100">
                                        {r.agentName} <span className="font-normal text-slate-500">oleh {r.raterName}</span>
                                    </span>
                                    <RatingValue value={r.rating} />
                                </div>
                                <div className="text-slate-500">
                                    Tiket #{r.ticketNumber ?? r.ticketId.slice(0, TICKET_ID_SHORT_LENGTH)} • {formatDateTimeID(r.createdAt)}
                                </div>
                                {r.comment && <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{r.comment}</p>}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
}
