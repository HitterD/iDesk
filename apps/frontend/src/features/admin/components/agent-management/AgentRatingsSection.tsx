import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import api from '@/lib/api';
import { formatDateTimeID } from '@/lib/utils/dateFormat';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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

export interface AgentRatingEntry {
    raterName: string;
    ticketId: string;
    ticketNumber: string | null;
    rating: number;
    comment: string | null;
    createdAt: string;
}

const MAX_RECENT_ROWS = 10;
const TICKET_ID_SHORT_LENGTH = 8;
/** Averages keep two decimals so 4.97 is not shown as 5.0 next to a true 5.00. */
const AVERAGE_DECIMALS = 2;
const STAR_DECIMALS = 0;
const ALL_SITES = 'ALL';

const RatingValue = ({ value, decimals }: { value: number | null; decimals: number }) => (
    <span className="inline-flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-100">
        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
        {value === null ? '-' : value.toLocaleString('id-ID', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
    </span>
);

const ticketLabel = (r: { ticketNumber: string | null; ticketId: string }) => `#${r.ticketNumber ?? r.ticketId.slice(0, TICKET_ID_SHORT_LENGTH)}`;

/** Every rating one agent received: who gave it, the stars, the comment and the ticket. */
function AgentRatingsDialog({ agent, onClose }: { agent: AgentRatingsOverview['agents'][number] | null; onClose: () => void }) {
    const { data = [], isLoading, isError } = useQuery<AgentRatingEntry[]>({
        queryKey: ['agent-ratings', 'agent', agent?.agentId],
        queryFn: async () => (await api.get(`/agent-ratings/agents/${agent!.agentId}`, { skipToast: true })).data,
        enabled: !!agent,
        staleTime: 60_000,
    });

    return (
        <Dialog open={!!agent} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Rating {agent?.fullName}</DialogTitle>
                    <DialogDescription>
                        {agent && <>Rata-rata <RatingValue value={agent.average} decimals={AVERAGE_DECIMALS} /> dari {agent.count} penilaian, terbaru di atas.</>}
                    </DialogDescription>
                </DialogHeader>
                {isLoading ? (
                    <p className="text-sm text-slate-500">Memuat rating...</p>
                ) : isError ? (
                    <p className="text-sm text-slate-500">Gagal memuat rating agen.</p>
                ) : data.length === 0 ? (
                    <p className="text-sm text-slate-500">Belum ada rating.</p>
                ) : (
                    <ul className="space-y-2 max-h-[60vh] overflow-y-auto">
                        {data.map((r) => (
                            <li key={`${r.ticketId}-${r.createdAt}`} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-xs space-y-1">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="font-semibold text-slate-800 dark:text-slate-100">{r.raterName}</span>
                                    <RatingValue value={r.rating} decimals={STAR_DECIMALS} />
                                </div>
                                <div className="text-slate-500">
                                    <Link to={`/tickets/${r.ticketId}`} className="underline-offset-2 hover:underline">Tiket {ticketLabel(r)}</Link> • {formatDateTimeID(r.createdAt)}
                                </div>
                                {r.comment && <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{r.comment}</p>}
                            </li>
                        ))}
                    </ul>
                )}
            </DialogContent>
        </Dialog>
    );
}

/**
 * Admin/manager view of requester ratings: per-agent averages (best first, then most rated)
 * plus the latest feedback. With a site code, only agents of that site. Click an agent to see
 * every rating they received.
 */
export function AgentRatingsSection({ siteCode }: { siteCode?: string }) {
    const site = siteCode && siteCode !== ALL_SITES ? siteCode : undefined;
    const [openAgent, setOpenAgent] = useState<AgentRatingsOverview['agents'][number] | null>(null);
    const { data, isLoading, isError } = useQuery<AgentRatingsOverview>({
        queryKey: ['agent-ratings', 'overview', site ?? ALL_SITES],
        queryFn: async () => (await api.get(site ? `/agent-ratings?siteCode=${encodeURIComponent(site)}` : '/agent-ratings', { skipToast: true })).data,
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
                                        <td className="px-3 py-2">
                                            <button type="button" onClick={() => setOpenAgent(a)} aria-label={`Lihat rating ${a.fullName}`}
                                                className="text-left text-slate-800 dark:text-slate-100 hover:underline underline-offset-2">
                                                {a.fullName}
                                            </button>
                                        </td>
                                        <td className="px-3 py-2 text-center"><RatingValue value={a.average} decimals={AVERAGE_DECIMALS} /></td>
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
                                    <RatingValue value={r.rating} decimals={STAR_DECIMALS} />
                                </div>
                                <div className="text-slate-500">
                                    Tiket {ticketLabel(r)} • {formatDateTimeID(r.createdAt)}
                                </div>
                                {r.comment && <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{r.comment}</p>}
                            </div>
                        ))}
                    </div>
                </div>
            )}
            <AgentRatingsDialog agent={openAgent} onClose={() => setOpenAgent(null)} />
        </section>
    );
}
