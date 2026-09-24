import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
    ArrowLeft,
    Calendar,
    Share2,
    ThumbsUp,
    ThumbsDown,
    Edit,
    Eye,
    LifeBuoy,
    Plus,
    Check,
    Clock,
    Printer as PrintIcon,
    ChevronRight,
    ListTree,
    CheckCircle2,
    Headphones,
    BookOpen
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { ArticleMarkdownViewer, slugify, stripEmojis } from '../components/ArticleMarkdownViewer';
import { ArticleViewersStack } from '../components/ArticleViewersStack';
import { getCategoryMeta } from '@/components/ui/ArticleCard';
import { useKBSocket } from '../hooks/useKBSocket';
import { useAuth } from '@/stores/useAuth';
import { cn } from '@/lib/utils';

interface Article {
    id: string;
    title: string;
    content: string;
    category: string;
    tags: string[];
    status: string;
    visibility: string;
    viewCount: number;
    helpfulCount: number;
    authorName: string;
    featuredImage?: string;
    images?: string[];
    createdAt: string;
    updatedAt: string;
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

export const BentoArticleDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const [article, setArticle] = useState<Article | null>(null);
    const [loading, setLoading] = useState(true);
    const [helpfulVote, setHelpfulVote] = useState<'yes' | 'no' | null>(null);
    const [copiedShare, setCopiedShare] = useState(false);
    const [activeTocId, setActiveTocId] = useState<string>('');
    const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({});
    const [scrollProgress, setScrollProgress] = useState(0);
    const tocContainerRef = useRef<HTMLDivElement>(null);

    // Realtime WebSocket listener for live view count, helpful & viewers updates
    useKBSocket(id);

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

            // Auto-activate last TOC item when user scrolls near the bottom of page
            if (scrollHeight - (scrollY + clientHeight) <= 60) {
                if (tocItems.length > 0) {
                    setActiveTocId(tocItems[tocItems.length - 1].id);
                }
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [tocItems]);

    // Fetch article & perform unique view registration with user profile info
    useEffect(() => {
        const fetchArticle = async () => {
            try {
                const response = await api.get(`/kb/articles/${id}`);
                setArticle(response.data);

                // DEDUPLICATION: Check if already viewed in this browser session
                const sessionKey = `idusk_kb_viewed_${id}`;
                const hasViewedInSession = sessionStorage.getItem(sessionKey);

                if (!hasViewedInSession) {
                    sessionStorage.setItem(sessionKey, '1');
                    api.post(`/kb/articles/${id}/view`)
                        .then((res) => {
                            if (res.data?.viewCount !== undefined) {
                                setArticle((prev) => prev ? { ...prev, viewCount: res.data.viewCount } : null);
                            }
                        })
                        .catch(() => { });
                }
            } catch (error) {
                console.error('Failed to fetch article:', error);
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            fetchArticle();
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

    // Auto-scroll TOC container so the active item stays visible within its bounded scroll area
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
                const response = await api.post(`/kb/articles/${id}/helpful`);
                if (response.data?.helpfulCount !== undefined) {
                    setArticle((prev) => prev ? { ...prev, helpfulCount: response.data.helpfulCount } : null);
                }
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

    if (loading) {
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
                    to="/kb"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-2xs"
                >
                    <ArrowLeft className="w-4 h-4" /> Kembali ke Knowledge Base
                </Link>
            </div>
        );
    }

    const meta = getCategoryMeta(article.category);
    const IconComponent = meta.icon;
    const authorDisplayName = article.authorName || 'IT Helpdesk Team';
    const canEdit = user?.role === 'ADMIN' || user?.role === 'AGENT' || user?.role === 'MANAGER';

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-20 relative">
            {/* Top Reading Progress Bar (Hidden when printing) */}
            <div
                className="fixed top-0 left-0 h-[2.5px] bg-primary z-50 transition-all duration-75 shadow-xs print:hidden"
                style={{ width: `${scrollProgress}%` }}
                aria-hidden="true"
            />

            {/* Breadcrumb Navigation & Action Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/70 pb-4 print:hidden">
                <div className="flex items-center flex-wrap gap-2 text-xs">
                    <Link
                        to="/kb"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-border text-foreground hover:bg-muted font-medium transition-all shadow-2xs group"
                    >
                        <ArrowLeft className="w-3.5 h-3.5 text-muted-foreground group-hover:-translate-x-0.5 group-hover:text-foreground transition-transform" />
                        <span>Knowledge Base</span>
                    </Link>

                    <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
                        <span className="font-semibold text-foreground/80">{article.category}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
                        <span className="truncate max-w-[240px] text-muted-foreground font-normal">
                            {article.title}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                    <button
                        type="button"
                        onClick={handleShare}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border text-foreground hover:bg-muted font-medium transition-all rounded-xl text-xs shadow-2xs cursor-pointer"
                        title="Salin tautan artikel"
                    >
                        {copiedShare ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Share2 className="w-3.5 h-3.5 text-muted-foreground" />}
                        <span>{copiedShare ? 'Tersalin' : 'Bagikan'}</span>
                    </button>
                    <button
                        type="button"
                        onClick={handlePrint}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border text-foreground hover:bg-muted font-medium transition-all rounded-xl text-xs shadow-2xs cursor-pointer"
                        title="Cetak panduan ini atau simpan sebagai PDF"
                    >
                        <PrintIcon className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>Cetak</span>
                    </button>
                    {canEdit && (
                        <Link
                            to={`/kb/articles/${id}/edit`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-secondary-foreground border border-border/80 hover:bg-muted font-semibold transition-all rounded-xl text-xs shadow-2xs cursor-pointer"
                        >
                            <Edit className="w-3.5 h-3.5" />
                            <span>Edit</span>
                        </Link>
                    )}
                </div>
            </div>

            {/* 2-Column Documentation Grid (Content 8 Cols + Sticky Sidebar 4 Cols) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start print:block print:w-full">
                {/* Left Area: Main Article Canvas (8 Columns) */}
                <main className="lg:col-span-8 space-y-8 min-w-0 print:w-full print:col-span-12 print:block print:space-y-6">
                    {/* Formal Enterprise SOP Document Header for Print */}
                    <div className="hidden print:flex items-center justify-between pb-4 mb-6 border-b-2 border-slate-900 print:w-full">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-lg font-mono">
                                iD
                            </div>
                            <div>
                                <div className="text-base font-bold text-slate-900 tracking-tight">iDesk Enterprise Platform</div>
                                <div className="text-[11px] text-slate-600 uppercase tracking-wider font-semibold">Standard Operating Procedure & Documentation</div>
                            </div>
                        </div>
                        <div className="text-right text-[11px] text-slate-600 space-y-0.5">
                            <div>ID Dokumen: <span className="font-mono font-semibold text-slate-900">{article.id?.slice(0, 8)}</span></div>
                            <div>Kategori: <span className="font-semibold text-slate-900">{article.category}</span></div>
                            <div>Tanggal Cetak: <span className="font-semibold text-slate-900">{formatIndonesianDate(new Date().toISOString())}</span></div>
                        </div>
                    </div>

                    {/* Clean Article Header */}
                    <header className="article-header space-y-4 border-b border-border/60 pb-6 print:border-b-2 print:border-slate-800">
                        {/* Meta Tags & Attributes */}
                        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-2">
                                <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border", meta.colorClass)}>
                                    <IconComponent className="w-3.5 h-3.5" />
                                    <span>{article.category}</span>
                                </span>

                                {article.status !== 'published' && (
                                    <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-semibold uppercase tracking-wider">
                                        {article.status}
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center flex-wrap gap-3.5 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-muted-foreground/80" />
                                    <span>{formatIndonesianDate(article.updatedAt || article.createdAt)}</span>
                                </span>

                                <span className="flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5 text-muted-foreground/80" />
                                    <span>{readingTime}</span>
                                </span>

                                <span className="flex items-center gap-1.5">
                                    <Eye className="w-3.5 h-3.5 text-muted-foreground/80" />
                                    <span>{article.viewCount} views</span>
                                </span>

                                {/* Clean Reader Stack */}
                                {viewersData?.recentViewers && viewersData.recentViewers.length > 0 && (
                                    <div className="border-l border-border/80 pl-3">
                                        <ArticleViewersStack
                                            viewers={viewersData.recentViewers}
                                            totalCount={viewersData.totalViewers || article.viewCount}
                                            articleTitle={article.title}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Article Title */}
                        <h1 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight leading-tight pt-1">
                            {article.title}
                        </h1>

                        {/* Author Byline */}
                        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <span>Ditulis oleh</span>
                            <span className="font-semibold text-foreground">{authorDisplayName}</span>
                            <span>•</span>
                            <span>Tim IT Helpdesk</span>
                        </div>
                    </header>

                    {/* Featured Banner (if available) */}
                    {article.featuredImage && (
                        <div className="rounded-2xl overflow-hidden border border-border/80 shadow-2xs">
                            <img
                                src={getImageUrl(article.featuredImage)}
                                alt={article.title}
                                className="w-full h-64 md:h-80 object-cover"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                }}
                            />
                        </div>
                    )}

                    {/* Article Content Viewer */}
                    <article className="pt-2">
                        <ArticleMarkdownViewer
                            content={article.content}
                            completedSteps={completedSteps}
                            onToggleStep={handleToggleStep}
                        />
                    </article>

                    {/* Article Tags */}
                    {article.tags && article.tags.length > 0 && (
                        <div className="pt-6 border-t border-border/70 flex flex-wrap items-center gap-2 print:hidden">
                            <span className="text-xs font-semibold text-muted-foreground mr-1">Topik Terkait:</span>
                            {article.tags.map((tag) => (
                                <span
                                    key={tag}
                                    className="px-2.5 py-1 rounded-lg bg-muted/60 text-muted-foreground text-xs font-mono border border-border/80 hover:text-foreground transition-colors"
                                >
                                    #{tag}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Simple, Authentic Feedback Widget */}
                    <section className="pt-6 border-t border-border/70 print:hidden">
                        <div className="rounded-2xl border border-border/80 bg-card/60 p-5 md:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xs">
                            <div className="space-y-1 text-center sm:text-left">
                                <h3 className="text-sm font-bold text-foreground">
                                    Apakah panduan ini membantu Anda?
                                </h3>
                                <p className="text-xs text-muted-foreground">
                                    {article.helpfulCount > 0
                                        ? `${article.helpfulCount} rekan kerja merasa terbantu dengan panduan ini.`
                                        : 'Beri tahu kami apakah solusi ini berhasil menyelesaikan kendala Anda.'}
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleVote('yes')}
                                    disabled={helpfulVote !== null}
                                    className={cn(
                                        "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border cursor-pointer shadow-2xs",
                                        helpfulVote === 'yes'
                                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                                            : "bg-card text-foreground border-border hover:bg-muted"
                                    )}
                                >
                                    <ThumbsUp className="w-3.5 h-3.5 text-emerald-500" />
                                    <span>Ya, Membantu</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleVote('no')}
                                    disabled={helpfulVote !== null}
                                    className={cn(
                                        "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border cursor-pointer shadow-2xs",
                                        helpfulVote === 'no'
                                            ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30"
                                            : "bg-card text-foreground border-border hover:bg-muted"
                                    )}
                                >
                                    <ThumbsDown className="w-3.5 h-3.5 text-muted-foreground" />
                                    <span>Belum</span>
                                </button>
                            </div>
                        </div>
                    </section>
                </main>

                {/* Right Area: Sticky Table of Contents & Clean IT Support (4 Columns) */}
                <aside className="lg:col-span-4 space-y-5 sticky top-6 print:hidden">
                    {/* Step Tracker Card (Shown only if article contains steps) */}
                    {totalSteps > 0 && (
                        <div className="p-4 rounded-2xl border border-border/80 bg-card/80 space-y-2.5 shadow-2xs">
                            <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                                <span className="flex items-center gap-1.5">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                    <span>Progres Solusi</span>
                                </span>
                                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                                    {completedCount}/{totalSteps} Selesai
                                </span>
                            </div>

                            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden border border-border/60">
                                <div
                                    className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                                    style={{ width: `${stepProgressPercent}%` }}
                                />
                            </div>

                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                                {completedCount === totalSteps
                                    ? 'Semua langkah telah selesai.'
                                    : 'Tandai langkah yang selesai untuk memantau proses Anda.'}
                            </p>
                        </div>
                    )}

                    {/* Table of Contents (Daftar Isi) */}
                    {tocItems.length > 0 && (
                        <nav className="p-4 rounded-2xl border border-border/80 bg-card/80 space-y-3 shadow-2xs">
                            <div className="flex items-center gap-2 pb-2.5 border-b border-border/60 text-xs font-bold text-foreground">
                                <ListTree className="w-4 h-4 text-muted-foreground" />
                                <span>Daftar Isi</span>
                            </div>

                            <div ref={tocContainerRef} className="space-y-1 max-h-[min(380px,calc(100vh-240px))] overflow-y-auto custom-scrollbar px-1 py-0.5">
                                {tocItems.map((item, idx) => {
                                    const isStepDone = item.stepNumber ? !!completedSteps[item.stepNumber] : false;
                                    const isActive = activeTocId === item.id;
                                    return (
                                        <button
                                            key={idx}
                                            type="button"
                                            data-toc-id={item.id}
                                            onClick={() => handleScrollTo(item.id)}
                                            className={cn(
                                                "w-full text-left text-xs py-2 rounded-xl transition-all cursor-pointer flex items-center justify-between gap-2 relative select-none",
                                                item.level === 3
                                                    ? "pl-6 pr-2.5 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                                    : "pl-3.5 pr-2.5 font-medium text-foreground/90 hover:bg-muted/50",
                                                isActive
                                                    ? "bg-primary/10 text-primary font-semibold shadow-2xs"
                                                    : ""
                                            )}
                                            title={item.title}
                                        >
                                            {isActive && (
                                                <span
                                                    className={cn(
                                                        "absolute top-2 bottom-2 w-1 bg-primary rounded-full transition-all",
                                                        item.level === 3 ? "left-2" : "left-1"
                                                    )}
                                                    aria-hidden="true"
                                                />
                                            )}
                                            <span className={cn("truncate block flex-1", isStepDone && "line-through opacity-75")}>
                                                {item.title}
                                            </span>
                                            {isStepDone && (
                                                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 ml-1.5" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </nav>
                    )}

                    {/* Single Purposeful IT Helpdesk Widget */}
                    <div className="p-4 md:p-5 rounded-2xl border border-border/80 bg-card/80 space-y-3 shadow-2xs">
                        <div className="flex items-center gap-2.5 text-xs font-bold text-foreground">
                            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                                <Headphones className="w-4 h-4" />
                            </div>
                            <span>Butuh Bantuan Langsung?</span>
                        </div>

                        <p className="text-xs text-muted-foreground leading-relaxed">
                            Jika panduan ini belum mengatasi kendala yang Anda alami, silakan buat tiket agar tim IT Helpdesk dapat mendampingi secara langsung.
                        </p>

                        <Link
                            to="/tickets/create"
                            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 transition-colors cursor-pointer shadow-xs"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Buat Tiket Bantuan</span>
                        </Link>
                    </div>
                </aside>
            </div>
        </div>
    );
};

export default BentoArticleDetailPage;
