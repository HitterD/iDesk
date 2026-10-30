import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, BookOpen, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { slugify, stripEmojis } from '@/features/knowledge-base/components/ArticleMarkdownViewer';
import { useKBSocket } from '@/features/knowledge-base/hooks/useKBSocket';
import { useAuth } from '@/stores/useAuth';
import { cn } from '@/lib/utils';
import { ArticleDocView } from '@/features/knowledge-base/components/ArticleDocView';

interface Article {
    id: string;
    title: string;
    content: string;
    category: string;
    tags?: string[];
    viewCount: number;
    helpfulCount: number;
    createdAt: string;
    updatedAt: string;
    authorName?: string;
    author?: { fullName: string };
    featuredImage?: string;
    images?: string[];
}

interface TocItem {
    id: string;
    title: string;
    level: number;
    stepNumber?: string;
}

const getImageUrl = (url: string): string => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
        return url;
    }
    if (url.startsWith('/kb/') || url.startsWith('/assets/') || url.startsWith('/sounds/') || url.startsWith('/images/')) {
        return url;
    }
    const apiUrl = import.meta.env.VITE_API_URL || '';
    return `${apiUrl}${url.startsWith('/') ? '' : '/'}${url}`;
};

function formatIndonesianDate(dateStr?: string): string {
    if (!dateStr) return '';
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
    } catch {
        return dateStr;
    }
}

export const ClientArticleDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { user, updateUser } = useAuth();
    const [isSubmittingAck, setIsSubmittingAck] = useState(false);
    const [helpfulVote, setHelpfulVote] = useState<'yes' | 'no' | null>(null);
    const [copiedShare, setCopiedShare] = useState(false);
    const [activeTocId, setActiveTocId] = useState<string>('');
    const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({});
    const [scrollProgress, setScrollProgress] = useState(0);
    const tocContainerRef = useRef<HTMLDivElement>(null);

    // Realtime WebSocket synchronization
    useKBSocket(id);

    const { data: article, isLoading } = useQuery<Article>({
        queryKey: ['kb-article', id],
        queryFn: async () => {
            const res = await api.get(`/kb/articles/${id}`);
            return res.data;
        },
        enabled: !!id,
        retry: 2,
    });

    // Fetch viewers list
    const { data: viewersData } = useQuery({
        queryKey: ['kb-viewers', id],
        queryFn: async () => {
            const res = await api.get(`/kb/articles/${id}/viewers`);
            return res.data;
        },
        enabled: !!id,
        staleTime: 10000,
    });

    // Extract Table of Contents & total steps
    const { tocItems, totalSteps } = useMemo(() => {
        if (!article?.content) return { tocItems: [], totalSteps: 0 };
        const lines = article.content.split('\n');
        const items: TocItem[] = [];
        let stepCount = 0;

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('## ')) {
                const rawTitle = trimmed.replace(/^##\s*/, '').trim();
                const title = stripEmojis(rawTitle);
                items.push({
                    id: slugify(title),
                    title,
                    level: 2,
                });
            } else if (trimmed.startsWith('### ')) {
                const rawTitle = trimmed.replace(/^###\s*/, '').trim();
                const stepMatch = rawTitle.match(/^(?:Step|Langkah)\s*(\d+)[:\s]*(.*)/i);
                if (stepMatch) {
                    stepCount++;
                    const stepNum = stepMatch[1];
                    const stepTitle = stripEmojis(stepMatch[2] || `Langkah ${stepNum}`);
                    items.push({
                        id: slugify(`step-${stepNum}-${stepTitle}`),
                        title: `Langkah ${stepNum}: ${stepTitle}`,
                        level: 3,
                        stepNumber: stepNum,
                    });
                } else {
                    const title = stripEmojis(rawTitle);
                    items.push({
                        id: slugify(title),
                        title,
                        level: 3,
                    });
                }
            }
        }
        return { tocItems: items, totalSteps: stepCount };
    }, [article?.content]);

    // Track scroll progress and auto-trigger last TOC item at page bottom
    useEffect(() => {
        const handleScroll = () => {
            const scrollHeight = document.documentElement.scrollHeight;
            const clientHeight = window.innerHeight;
            const scrollY = window.scrollY;
            const totalHeight = scrollHeight - clientHeight;
            if (totalHeight > 0) {
                const current = (scrollY / totalHeight) * 100;
                setScrollProgress(Math.min(100, Math.max(0, current)));
            }

            // Auto-activate last TOC item when user reaches bottom of document
            if (scrollHeight - (scrollY + clientHeight) <= 60) {
                if (tocItems.length > 0) {
                    setActiveTocId(tocItems[tocItems.length - 1].id);
                }
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [tocItems]);

    // Deduplicated session-based view tracking with user context
    useEffect(() => {
        if (!id) return;
        const sessionKey = `idusk_kb_viewed_${id}`;
        const hasViewedInSession = sessionStorage.getItem(sessionKey);

        if (!hasViewedInSession) {
            sessionStorage.setItem(sessionKey, '1');
            api.post(`/kb/articles/${id}/view`).catch(() => { });
        }
    }, [id, user]);

    // Active Scrollspy Observer
    useEffect(() => {
        if (tocItems.length === 0) return;
        if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries.find((entry) => entry.isIntersecting);
                if (visible) {
                    setActiveTocId(visible.target.id);
                }
            },
            {
                rootMargin: '-80px 0px -65% 0px',
                threshold: 0.1,
            }
        );

        tocItems.forEach((item) => {
            const el = document.getElementById(item.id);
            if (el) observer.observe(el);
        });

        return () => observer.disconnect();
    }, [tocItems]);

    // Auto-scroll TOC container so the active item stays visible
    useEffect(() => {
        if (!activeTocId || !tocContainerRef.current) return;
        const activeBtn = tocContainerRef.current.querySelector<HTMLElement>(`[data-toc-id="${activeTocId}"]`);
        if (activeBtn && tocContainerRef.current) {
            const container = tocContainerRef.current;
            const btnTop = activeBtn.offsetTop;
            const btnBottom = btnTop + activeBtn.offsetHeight;
            const containerScrollTop = container.scrollTop;
            const containerHeight = container.clientHeight;

            if (btnTop < containerScrollTop) {
                container.scrollTo({ top: Math.max(0, btnTop - 12), behavior: 'smooth' });
            } else if (btnBottom > containerScrollTop + containerHeight) {
                container.scrollTo({ top: btnBottom - containerHeight + 12, behavior: 'smooth' });
            }
        }
    }, [activeTocId]);

    // Reading time calculation (average 200 words per minute)
    const readingTime = useMemo(() => {
        if (!article?.content) return '1 mnt baca';
        const wordCount = article.content.trim().split(/\s+/).length;
        const minutes = Math.ceil(wordCount / 200);
        return `± ${Math.max(1, minutes)} mnt baca`;
    }, [article?.content]);

    // Handle Step Completion Toggle
    const handleToggleStep = useCallback((stepNumber: string) => {
        setCompletedSteps((prev) => {
            const next = { ...prev, [stepNumber]: !prev[stepNumber] };
            if (next[stepNumber]) {
                toast.success(`Langkah ${stepNumber} ditandai selesai!`);
            }
            return next;
        });
    }, []);

    const completedCount = useMemo(() => {
        return Object.values(completedSteps).filter(Boolean).length;
    }, [completedSteps]);

    const stepProgressPercent = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;

    const handleScrollTo = (slugId: string) => {
        setActiveTocId(slugId);
        const element = document.getElementById(slugId);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const handleVote = async (vote: 'yes' | 'no') => {
        if (helpfulVote) return;
        setHelpfulVote(vote);

        if (vote === 'yes') {
            try {
                await api.post(`/kb/articles/${id}/helpful`);
                toast.success('Terima kasih! Masukan Anda sangat berharga bagi kami.');
            } catch {
                toast.success('Terima kasih atas penilaian Anda!');
            }
        } else {
            toast.info('Terima kasih atas masukannya. Tim IT Helpdesk akan terus menyempurnakan panduan ini.');
        }
    };

    const handleShare = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setCopiedShare(true);
            toast.success('Link artikel disalin ke clipboard!');
            setTimeout(() => setCopiedShare(false), 2000);
        } catch {
            toast.error('Gagal menyalin link');
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const isPortalGuidebook = useMemo(() => {
        if (!article?.title) return false;
        const title = article.title.toLowerCase();
        return (
            title.includes('panduan lengkap penggunaan portal user') ||
            title.includes('panduan portal user') ||
            Boolean(article.tags?.some((t) => t.toLowerCase().includes('panduan user')))
        );
    }, [article?.title, article?.tags]);

    const handleAcknowledgeGuidebook = async () => {
        setIsSubmittingAck(true);
        try {
            const res = await api.post('/users/me/acknowledge-guidebook');
            const acknowledgedAt = res.data?.acknowledgedAt || new Date().toISOString();
            updateUser({ guidebookAcknowledgedAt: acknowledgedAt });
            try {
                sessionStorage.removeItem('guidebook_dismissed_session');
            } catch {}
            toast.success('Terima kasih! Panduan portal iDesk berhasil di-acknowledge.');
        } catch {
            toast.error('Gagal mencatat acknowledgement. Silakan coba lagi.');
        } finally {
            setIsSubmittingAck(false);
        }
    };

    if (isLoading) {
        return (
            <div className="max-w-4xl mx-auto py-16 px-4 space-y-8 animate-pulse">
                <div className="h-6 w-36 bg-muted rounded-md" />
                <div className="h-10 w-3/4 bg-muted rounded-xl" />
                <div className="h-4 w-1/2 bg-muted rounded-md" />
                <div className="space-y-4 pt-8">
                    <div className="h-4 w-full bg-muted/60 rounded" />
                    <div className="h-4 w-5/6 bg-muted/60 rounded" />
                    <div className="h-4 w-4/6 bg-muted/60 rounded" />
                </div>
            </div>
        );
    }

    if (!article) {
        return (
            <div className="max-w-xl mx-auto py-16 px-4 text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-muted border border-border flex items-center justify-center mx-auto text-muted-foreground">
                    <BookOpen className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-foreground">Artikel Tidak Ditemukan</h2>
                <p className="text-sm text-muted-foreground">Artikel yang Anda cari mungkin telah dipindahkan atau dinonaktifkan.</p>
                <Link
                    to="/client/kb"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-2xs"
                >
                    <ArrowLeft className="w-4 h-4" /> Kembali ke Knowledge Base
                </Link>
            </div>
        );
    }

    const authorDisplayName = article.authorName || article.author?.fullName || 'IT Helpdesk Team';
    const ackCallout = isPortalGuidebook && user?.role === 'USER' && (
                        <div
                            className={cn(
                                "p-4 sm:p-5 rounded-2xl border transition-all duration-300 shadow-2xs print:hidden",
                                user?.guidebookAcknowledgedAt
                                    ? "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                                    : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                            )}
                        >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-start sm:items-center gap-3.5">
                                    <div
                                        className={cn(
                                            "w-10 h-10 rounded-xl shrink-0 border flex items-center justify-center",
                                            user?.guidebookAcknowledgedAt
                                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60"
                                                : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                                        )}
                                    >
                                        {user?.guidebookAcknowledgedAt ? (
                                            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                                        ) : (
                                            <BookOpen className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                                        )}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                                                Konfirmasi Pemahaman Panduan Portal
                                            </h3>
                                            {user?.guidebookAcknowledgedAt && (
                                                <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                    Ter-Acknowledge
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed max-w-xl">
                                            {user?.guidebookAcknowledgedAt
                                                ? `Anda telah mengonfirmasi pemahaman panduan portal ini. Notifikasi pengingat tidak akan muncul lagi pada login berikutnya.`
                                                : `Sebagai pengguna portal iDesk, pastikan Anda memahami kanal pengajuan layanan dan tata tertib penggunaan portal ini. Klik tombol konfirmasi setelah membaca.`}
                                        </p>
                                    </div>
                                </div>

                                {!user?.guidebookAcknowledgedAt && (
                                    <button
                                        type="button"
                                        onClick={handleAcknowledgeGuidebook}
                                        disabled={isSubmittingAck}
                                        className="shrink-0 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-primary hover:bg-primary/90 shadow-md shadow-primary/25 transition-all duration-150 disabled:opacity-60 cursor-pointer"
                                    >
                                        {isSubmittingAck ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                <span>Menyimpan...</span>
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle2 className="w-4 h-4" />
                                                <span>Saya Mengerti & Acknowledge</span>
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    );

    return (
        <ArticleDocView
            article={article}
            authorName={authorDisplayName}
            readingTime={readingTime}
            updatedLabel={formatIndonesianDate(article.updatedAt || article.createdAt)}
            printedLabel={formatIndonesianDate(new Date().toISOString())}
            viewers={viewersData}
            tocItems={tocItems}
            activeTocId={activeTocId}
            onScrollTo={handleScrollTo}
            tocContainerRef={tocContainerRef}
            totalSteps={totalSteps}
            completedSteps={completedSteps}
            onToggleStep={handleToggleStep}
            helpfulVote={helpfulVote}
            onVote={handleVote}
            copiedShare={copiedShare}
            onShare={handleShare}
            onPrint={handlePrint}
            kbPath="/client/kb"
            createTicketPath="/client/create"
            imageUrl={getImageUrl}
            scrollProgress={scrollProgress}
            topSlot={ackCallout || undefined}
        />
    );
};

export default ClientArticleDetailPage;
