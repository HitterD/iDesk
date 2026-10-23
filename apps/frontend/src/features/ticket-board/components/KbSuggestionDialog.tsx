import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, FileText, Lightbulb } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

export interface KbSuggestionArticle {
    id: string;
    title: string;
    category: string;
    content?: string;
    viewCount?: number;
}

interface KbSuggestionDialogProps {
    /** Suggestions were requested; the dialog itself only appears once relevant articles exist. */
    isOpen: boolean;
    onClose: () => void;
    ticketId: string;
    basePath?: string; // '/kb' for agent, '/client/kb' for client
}

const SUGGESTION_LIMIT = 3;
const SUGGESTION_STALE_MS = 5 * 60_000;

/**
 * Relevant KB articles for a freshly opened ticket. Fetched first and shown only when there is
 * something to show, so an empty result never flashes a modal open and shut.
 */
export const KbSuggestionDialog: React.FC<KbSuggestionDialogProps> = ({
    isOpen,
    onClose,
    ticketId,
    basePath = '/kb',
}) => {
    const navigate = useNavigate();
    const { data: articles = [] } = useQuery<KbSuggestionArticle[]>({
        queryKey: ['kb-suggestions', ticketId],
        queryFn: async () => {
            const res = await api.get(`/tickets/${ticketId}/kb-suggestions`);
            return (Array.isArray(res.data) ? res.data : []).slice(0, SUGGESTION_LIMIT);
        },
        enabled: isOpen && Boolean(ticketId),
        staleTime: SUGGESTION_STALE_MS,
        retry: false,
    });

    return (
        <Dialog open={isOpen && articles.length > 0} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent size="lg" className="gap-0 p-0 overflow-hidden">
                <div className="flex items-center gap-3 p-5 pr-12 border-b border-border">
                    <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-primary/10 text-primary">
                        <Lightbulb className="w-[18px] h-[18px]" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                        <DialogTitle className="text-base font-bold">Artikel KB yang mungkin membantu</DialogTitle>
                        <DialogDescription className="text-xs mt-0.5">
                            Berdasarkan kendala pada tiket ini
                        </DialogDescription>
                    </div>
                </div>

                <ul className="p-4 space-y-2">
                    {articles.map((a) => (
                        <li key={a.id}>
                            <button
                                type="button"
                                onClick={() => navigate(`${basePath}/articles/${a.id}`)}
                                className="kb-suggest-item group"
                            >
                                <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                    <FileText className="w-4 h-4" aria-hidden="true" />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block text-[13px] font-semibold text-foreground truncate">{a.title}</span>
                                    <span className="block text-[11.5px] text-muted-foreground mt-0.5 truncate">
                                        {a.category} · {a.viewCount ?? 0}× dilihat
                                    </span>
                                </span>
                                <ArrowUpRight className="kb-suggest-arrow" aria-hidden="true" />
                            </button>
                        </li>
                    ))}
                </ul>

                <div className="flex justify-end px-5 py-3.5 border-t border-border">
                    <Button variant="soft" onClick={onClose}>Tutup</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
