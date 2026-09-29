import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatDateTimeID } from '@/lib/utils/dateFormat';
import {
    RATING_COMMENT_MAX,
    RATING_STARS,
    TicketAgentRating,
    TicketAgentRatingsResponse,
    agentRatingsQueryKey,
    getApiErrorMessage,
} from './resolutionApi';

interface Draft {
    rating: number;
    comment: string;
}

const EMPTY_DRAFT: Draft = { rating: 0, comment: '' };

const StarRow: React.FC<{
    value: number;
    onChange?: (value: number) => void;
    agentName: string;
}> = ({ value, onChange, agentName }) => (
    <div className="flex items-center gap-1" role={onChange ? 'radiogroup' : undefined} aria-label={`Rating untuk ${agentName}`}>
        {RATING_STARS.map((star) => {
            const filled = star <= value;
            const icon = (
                <Star
                    className={cn('w-5 h-5', filled ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600')}
                />
            );
            if (!onChange) return <span key={star}>{icon}</span>;
            return (
                <button
                    key={star}
                    type="button"
                    role="radio"
                    aria-checked={star === value}
                    aria-label={`${star} bintang untuk ${agentName}`}
                    onClick={() => onChange(star)}
                    className="p-0.5 rounded cursor-pointer hover:scale-110 transition-transform"
                >
                    {icon}
                </button>
            );
        })}
    </div>
);

const RatedAgentRow: React.FC<{ agent: TicketAgentRating }> = ({ agent }) => (
    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">{agent.fullName}</span>
            <StarRow value={agent.rating ?? 0} agentName={agent.fullName} />
        </div>
        {agent.comment && <p className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{agent.comment}</p>}
    </div>
);

interface AgentRatingFormProps {
    ticketId: string;
}

/**
 * Optional per-agent rating (1-5 stars + "Kesan & saran") the requester can
 * leave on a CLOSED ticket. Already-rated agents render read-only.
 */
export const AgentRatingForm: React.FC<AgentRatingFormProps> = ({ ticketId }) => {
    const queryClient = useQueryClient();
    const [drafts, setDrafts] = useState<Record<string, Draft>>({});
    const [dismissed, setDismissed] = useState(false);

    const { data } = useQuery<TicketAgentRatingsResponse>({
        queryKey: agentRatingsQueryKey(ticketId),
        queryFn: async () => (await api.get(`/tickets/${ticketId}/agent-ratings`, { skipToast: true })).data,
    });

    const submitMutation = useMutation({
        mutationFn: async (ratings: { agentId: string; rating: number; comment?: string }[]) =>
            (await api.post(`/tickets/${ticketId}/agent-ratings`, { ratings }, { skipToast: true })).data,
        onSuccess: () => {
            toast.success('Terima kasih atas penilaian Anda!');
            setDrafts({});
            queryClient.invalidateQueries({ queryKey: agentRatingsQueryKey(ticketId) });
        },
        onError: (error) => toast.error(getApiErrorMessage(error, 'Gagal mengirim penilaian')),
    });

    const agents = data?.agents ?? [];
    const rated = agents.filter((a) => a.rating !== null);
    const unrated = data?.canRate ? agents.filter((a) => a.rating === null) : [];

    if (agents.length === 0 || (rated.length === 0 && unrated.length === 0)) return null;

    const updateDraft = (agentId: string, patch: Partial<Draft>) =>
        setDrafts((prev) => ({
            ...prev,
            [agentId]: { ...(prev[agentId] ?? EMPTY_DRAFT), ...patch },
        }));

    const payload = unrated
        .map((a) => ({ agentId: a.agentId, draft: drafts[a.agentId] }))
        .filter(({ draft }) => draft && draft.rating > 0)
        .map(({ agentId, draft }) => ({
            agentId,
            rating: draft.rating,
            ...(draft.comment.trim() ? { comment: draft.comment.trim() } : {}),
        }));

    const showForm = unrated.length > 0 && !dismissed;
    if (!showForm && rated.length === 0) return null;

    return (
        <section
            aria-label="Penilaian agen"
            className="mx-3 sm:mx-6 mt-3 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3 shrink-0 max-h-[50vh] overflow-y-auto custom-scrollbar"
        >
            <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Beri Penilaian Layanan</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {showForm
                        ? 'Opsional — bantu kami meningkatkan layanan dengan menilai agen yang menangani tiket ini.'
                        : 'Terima kasih atas penilaian Anda.'}
                    {showForm && data?.ratingDeadline && ` Batas penilaian: ${formatDateTimeID(data.ratingDeadline)}.`}
                </p>
            </div>

            {rated.map((agent) => (
                <RatedAgentRow key={agent.agentId} agent={agent} />
            ))}

            {showForm && (
                <>
                    {unrated.map((agent) => {
                        const draft = drafts[agent.agentId];
                        const commentId = `rating-comment-${agent.agentId}`;
                        return (
                            <div
                                key={agent.agentId}
                                className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                        {agent.fullName}
                                    </span>
                                    <StarRow
                                        value={draft?.rating ?? 0}
                                        onChange={(rating) => updateDraft(agent.agentId, { rating })}
                                        agentName={agent.fullName}
                                    />
                                </div>
                                <label htmlFor={commentId} className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                                    Kesan & saran <span className="text-slate-400">(opsional)</span>
                                </label>
                                <textarea
                                    id={commentId}
                                    value={draft?.comment ?? ''}
                                    onChange={(e) => updateDraft(agent.agentId, { comment: e.target.value })}
                                    maxLength={RATING_COMMENT_MAX}
                                    rows={2}
                                    disabled={submitMutation.isPending}
                                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary resize-none disabled:opacity-50"
                                />
                            </div>
                        );
                    })}
                    <div className="flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => setDismissed(true)}
                            disabled={submitMutation.isPending}
                            className="px-3 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
                        >
                            Lewati
                        </button>
                        <button
                            type="button"
                            onClick={() => submitMutation.mutate(payload)}
                            disabled={payload.length === 0 || submitMutation.isPending}
                            className="px-3 py-2 rounded-xl text-xs font-bold text-primary-foreground bg-primary hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {submitMutation.isPending ? 'Mengirim...' : 'Kirim Penilaian'}
                        </button>
                    </div>
                </>
            )}
        </section>
    );
};

export default AgentRatingForm;
