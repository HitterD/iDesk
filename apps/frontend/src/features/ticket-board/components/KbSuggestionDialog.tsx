import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { BookOpen, X, Lightbulb, ArrowUpRight, FileText, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

export interface KbSuggestionArticle {
    id: string;
    title: string;
    category: string;
    content?: string;
    viewCount?: number;
}

interface KbSuggestionDialogProps {
    isOpen: boolean;
    onClose: () => void;
    ticketId: string;
    basePath?: string; // '/kb' for agent, '/client/kb' for client
}

const SUGGESTION_LIMIT = 3;

export const KbSuggestionDialog: React.FC<KbSuggestionDialogProps> = ({
    isOpen,
    onClose,
    ticketId,
    basePath = '/kb',
}) => {
    const [articles, setArticles] = useState<KbSuggestionArticle[]>([]);
    const [loading, setLoading] = useState(false);
    const [entered, setEntered] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        if (!isOpen || !ticketId) return;
        setLoading(true);
        setEntered(false);
        const t = window.setTimeout(() => setEntered(true), 20);
        api.get(`/tickets/${ticketId}/kb-suggestions`)
            .then((res) => {
                // Backend returns [] when nothing is relevant; hide silently.
                const list = Array.isArray(res.data) ? res.data : [];
                setArticles(list.slice(0, SUGGESTION_LIMIT));
                if (list.length === 0) onClose();
            })
            .catch(() => onClose())
            .finally(() => setLoading(false));
        return () => window.clearTimeout(t);
    }, [isOpen, ticketId, onClose]);

    if (!isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-300"
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-2xl overflow-hidden bg-card text-card-foreground border border-border/80 shadow-2xl rounded-[2rem] animate-in zoom-in-95 duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-1.5 bg-black/[0.03] dark:bg-white/[0.03] ring-1 ring-black/5 dark:ring-white/10 rounded-[calc(2rem-0.375rem)]">
                    <div className="bg-card rounded-[calc(2rem-0.75rem)] border border-border/60 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] overflow-hidden">
                        {/* Header */}
                        <div
                            className={cn(
                                'flex items-start justify-between p-5 border-b border-border bg-muted/30 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]',
                                entered ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border bg-primary/10 text-primary border-primary/20">
                                    <Lightbulb className="w-4.5 h-4.5" strokeWidth={1.5} />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-foreground">
                                        Artikel KB yang Mungkin Relevan
                                    </h3>
                                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                        Berdasarkan kendala pada tiket ini ({ticketId.slice(0, 8)})
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-all duration-300 active:scale-95 cursor-pointer"
                            >
                                <X className="w-4 h-4" strokeWidth={1.5} />
                            </button>
                        </div>

                        {/* Content */}
                        <div
                            className={cn(
                                'p-5 space-y-3 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]',
                                entered ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
                            )}
                            style={{ transitionDelay: entered ? '80ms' : '0ms' }}
                        >
                            {loading ? (
                                <div className="flex items-center justify-center py-10 text-muted-foreground">
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span className="ml-2 text-xs">Mencari artikel relevan…</span>
                                </div>
                            ) : articles.length === 0 ? (
                                <div className="py-8 text-center text-sm text-muted-foreground">
                                    <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-40" strokeWidth={1.5} />
                                    Tidak ada artikel yang cukup relevan saat ini.
                                </div>
                            ) : (
                                <div className="space-y-2.5">
                                    {articles.map((a) => (
                                        <button
                                            key={a.id}
                                            type="button"
                                            onClick={() => navigate(`${basePath}/articles/${a.id}`)}
                                            className={cn(
                                                'w-full text-left flex items-center gap-3 p-3.5 rounded-2xl border transition-all duration-400 ease-[cubic-bezier(0.32,0.72,0,1)]',
                                                'hover:-translate-y-0.5 active:scale-[0.99] bg-background hover:bg-muted border-border/70 cursor-pointer group'
                                            )}
                                        >
                                            <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
                                                <FileText className="w-4 h-4" strokeWidth={1.5} />
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block text-xs font-bold text-foreground truncate">
                                                    {a.title}
                                                </span>
                                                <span className="block text-[11px] text-muted-foreground mt-0.5 truncate">
                                                    {a.category} · {a.viewCount ?? 0} views
                                                </span>
                                            </span>
                                            <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:translate-x-0.5">
                                                <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div
                            className={cn(
                                'flex items-center justify-end px-5 py-3.5 border-t border-border bg-muted/30 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]',
                                entered ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
                            )}
                            style={{ transitionDelay: entered ? '140ms' : '0ms' }}
                        >
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted border border-border rounded-full transition-colors cursor-pointer active:scale-[0.98]"
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
