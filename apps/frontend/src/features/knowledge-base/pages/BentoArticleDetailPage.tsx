import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
    ArrowLeft,
    Calendar,
    Share2,
    ThumbsUp,
    Edit,
    Eye,
    User,
    LifeBuoy,
    Plus,
    Check,
    Clock,
    Printer as PrintIcon,
    ChevronRight,
    ListTree,
    Sparkles,
    ShieldCheck,
    HelpCircle,
    CheckCircle2,
    Flame,
    Zap,
    Lightbulb,
    Target,
    Users
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { ArticleMarkdownViewer, slugify } from '../components/ArticleMarkdownViewer';
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
    const [isHelpfulClicked, setIsHelpfulClicked] = useState(false);
    const [selectedReaction, setSelectedReaction] = useState<string | null>(null);
    const [copiedShare, setCopiedShare] = useState(false);
    const [activeTocId, setActiveTocId] = useState<string>('');
    const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({});
    const [scrollProgress, setScrollProgress] = useState(0);

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

    // Track scroll progress
    useEffect(() => {
        const handleScroll = () => {
            const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
            if (totalHeight > 0) {
                const current = (window.scrollY / totalHeight) * 100;
                setScrollProgress(Math.min(100, Math.max(0, current)));
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

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
                    // Viewer identity is taken from the session cookie on the server.
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

    // Extract Table of Contents & total steps
    const { tocItems, totalSteps } = useMemo(() => {
        if (!article?.content) return { tocItems: [], totalSteps: 0 };
        const lines = article.content.split('\n');
        const items: TocItem[] = [];
        let stepCount = 0;

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('## ')) {
                const title = trimmed.replace(/^##\s*/, '').trim();
                items.push({
                    id: slugify(title),
                    title,
                    level: 2,
                });
            } else if (trimmed.startsWith('### ')) {
                const title = trimmed.replace(/^###\s*/, '').trim();
                const stepMatch = title.match(/^(?:Step|Langkah)\s*(\d+)[:\s]*(.*)/i);
                if (stepMatch) {
                    stepCount++;
                    const stepNum = stepMatch[1];
                    const stepTitle = stepMatch[2] || `Langkah ${stepNum}`;
                    items.push({
                        id: slugify(`step-${stepNum}-${stepTitle}`),
                        title: `Langkah ${stepNum}: ${stepTitle}`,
                        level: 3,
                        stepNumber: stepNum,
                    });
                } else {
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

    // Handle Step Completion Toggle
    const handleToggleStep = useCallback((stepNumber: string) => {
        setCompletedSteps((prev) => {
            const next = { ...prev, [stepNumber]: !prev[stepNumber] };
            if (next[stepNumber]) {
                toast.success(`Langkah ${stepNumber} ditandai selesai! 🎉`);
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
            element.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const handleReaction = async (reactionKey: string, label: string) => {
        setSelectedReaction(reactionKey);
        if (!isHelpfulClicked) {
            try {
                const response = await api.post(`/kb/articles/${id}/helpful`);
                setArticle(response.data);
                setIsHelpfulClicked(true);
                toast.success(`Terima kasih atas feedback "${label}"! ✨`);
            } catch {
                setIsHelpfulClicked(true);
                toast.success(`Feedback tercatat! ✨`);
            }
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
            <div className="max-w-6xl mx-auto p-12 text-center text-muted-foreground animate-pulse space-y-4">
                <div className="h-6 w-48 bg-muted rounded-md mx-auto" />
                <div className="h-64 bg-card rounded-2xl border border-border" />
            </div>
        );
    }

    if (!article) {
        return (
            <div className="max-w-xl mx-auto p-12 text-center space-y-4">
                <h2 className="text-xl font-bold text-foreground">Artikel Tidak Ditemukan</h2>
                <p className="text-sm text-muted-foreground">Artikel yang Anda cari mungkin telah dihapus atau dipindahkan.</p>
                <Link
                    to="/kb"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold"
                >
                    <ArrowLeft className="w-4 h-4" /> Kembali ke Knowledge Base
                </Link>
            </div>
        );
    }

    const meta = getCategoryMeta(article.category);
    const IconComponent = meta.icon;
    const authorDisplayName = article.authorName || 'IT Support Team';

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-16 relative">
            {/* Top Reading Progress Bar */}
            <div
                className="fixed top-0 left-0 h-1 bg-primary z-50 transition-all duration-75 shadow-sm"
                style={{ width: `${scrollProgress}%` }}
                aria-hidden="true"
            />

            {/* Breadcrumb Navigation & Top Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/80 pb-4">
                <div className="flex items-center flex-wrap gap-2 text-xs">
                    <Link
                        to="/kb"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-border text-foreground hover:bg-muted font-semibold transition-all shadow-2xs group cursor-pointer"
                    >
                        <ArrowLeft className="w-3.5 h-3.5 text-muted-foreground group-hover:-translate-x-0.5 group-hover:text-foreground transition-all" />
                        <span>Kembali ke Knowledge Base</span>
                    </Link>

                    <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
                        <span className="font-semibold text-foreground">{article.category}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
                        <span className="truncate max-w-[220px] text-muted-foreground">
                            {article.title}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                    <button
                        type="button"
                        onClick={handleShare}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border text-foreground hover:bg-muted font-medium transition-all rounded-lg text-xs shadow-2xs cursor-pointer"
                    >
                        {copiedShare ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Share2 className="w-3.5 h-3.5" />}
                        <span>{copiedShare ? 'Tersalin' : 'Bagikan'}</span>
                    </button>
                    <button
                        type="button"
                        onClick={handlePrint}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border text-foreground hover:bg-muted font-medium transition-all rounded-lg text-xs shadow-2xs cursor-pointer"
                        title="Cetak / Simpan PDF"
                    >
                        <PrintIcon className="w-3.5 h-3.5" />
                        <span>Cetak</span>
                    </button>
                    <Link
                        to={`/kb/articles/${id}/edit`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-secondary-foreground border border-border/80 hover:bg-muted font-semibold transition-all rounded-lg text-xs shadow-2xs cursor-pointer"
                    >
                        <Edit className="w-3.5 h-3.5" />
                        <span>Edit</span>
                    </Link>
                </div>
            </div>

            {/* 2-Column Documentation Grid (Content 8 Cols + Sticky Sidebar 4 Cols) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Left Area: Main Article Content (8 Columns) */}
                <div className="lg:col-span-8 space-y-6">
                    <article className="rounded-3xl border border-border bg-card p-6 md:p-10 shadow-xs space-y-6">
                        {/* Meta Badges + Avatar Stack */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/60">
                            <div className="flex items-center gap-2">
                                <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider border", meta.colorClass)}>
                                    <IconComponent className="w-3.5 h-3.5" />
                                    <span>{article.category}</span>
                                </div>

                                {article.status !== 'published' && (
                                    <span className="px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-600 border border-amber-500/20 text-xs font-bold uppercase tracking-wider">
                                        {article.status}
                                    </span>
                                )}
                            </div>

                            {/* Live Realtime Views Badge & Readers Avatar Stack */}
                            <div className="flex items-center flex-wrap gap-3 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1 font-medium">
                                    <Calendar className="w-3.5 h-3.5" />
                                    {formatIndonesianDate(article.updatedAt || article.createdAt)}
                                </span>

                                <span className="flex items-center gap-1.5 font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    <span>{article.viewCount} views</span>
                                </span>

                                {/* Readers Avatar Stack */}
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

                        {/* Article Title & Author Header */}
                        <div className="space-y-2.5">
                            <h1 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight leading-tight">
                                {article.title}
                            </h1>

                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1.5 font-medium text-foreground">
                                    <User className="w-3.5 h-3.5 text-foreground/70" />
                                    {authorDisplayName}
                                </span>
                                <span>•</span>
                                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                    ✓ Terverifikasi IT Helpdesk
                                </span>
                            </div>
                        </div>

                        {/* Featured Banner */}
                        {article.featuredImage && (
                            <div className="rounded-2xl overflow-hidden border border-border">
                                <img
                                    src={getImageUrl(article.featuredImage)}
                                    alt={article.title}
                                    className="w-full h-64 md:h-72 object-cover"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                />
                            </div>
                        )}

                        {/* Rich Content Viewer with Step Checklist Toggle */}
                        <div className="pt-2">
                            <ArticleMarkdownViewer
                                content={article.content}
                                completedSteps={completedSteps}
                                onToggleStep={handleToggleStep}
                            />
                        </div>

                        {/* Article Tags */}
                        {article.tags && article.tags.length > 0 && (
                            <div className="pt-6 border-t border-border flex flex-wrap items-center gap-1.5">
                                <span className="text-xs text-muted-foreground mr-1">Tags:</span>
                                {article.tags.map((tag) => (
                                    <span
                                        key={tag}
                                        className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-xs font-mono border border-border"
                                    >
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Interactive Reactions Widget */}
                        <div className="pt-6 border-t border-border space-y-3.5">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                <span className="text-xs md:text-sm font-bold text-foreground">
                                    Bagaimana panduan ini membantu Anda?
                                </span>
                                {article.helpfulCount > 0 && (
                                    <span className="text-[11px] font-mono text-muted-foreground">
                                        {article.helpfulCount} orang terbantu dengan artikel ini
                                    </span>
                                )}
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleReaction('fast', 'Solutif & Cepat')}
                                    className={cn(
                                        "flex items-center justify-center gap-1.5 p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer",
                                        selectedReaction === 'fast'
                                            ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 shadow-2xs font-bold"
                                            : "bg-card border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                                    <span>Solutif</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleReaction('clear', 'Sangat Jelas')}
                                    className={cn(
                                        "flex items-center justify-center gap-1.5 p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer",
                                        selectedReaction === 'clear'
                                            ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 shadow-2xs font-bold"
                                            : "bg-card border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <Lightbulb className="w-3.5 h-3.5 text-yellow-500" />
                                    <span>Jelas</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleReaction('target', 'Tepat Sasaran')}
                                    className={cn(
                                        "flex items-center justify-center gap-1.5 p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer",
                                        selectedReaction === 'target'
                                            ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 shadow-2xs font-bold"
                                            : "bg-card border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <Target className="w-3.5 h-3.5 text-rose-500" />
                                    <span>Tepat Sasaran</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleReaction('helpful', 'Membantu')}
                                    className={cn(
                                        "flex items-center justify-center gap-1.5 p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer",
                                        selectedReaction === 'helpful'
                                            ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 shadow-2xs font-bold"
                                            : "bg-card border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <ThumbsUp className="w-3.5 h-3.5 text-primary" />
                                    <span>Membantu</span>
                                </button>
                            </div>
                        </div>
                    </article>

                    {/* Bottom Escalation CTA */}
                    <div className="rounded-2xl border border-border bg-card p-5 md:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xs">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-muted border border-border flex items-center justify-center text-foreground shrink-0">
                                <LifeBuoy className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-foreground">Kendala Belum Terselesaikan?</h4>
                                <p className="text-xs text-muted-foreground">Buat tiket agar tim IT Helpdesk dapat memberikan asistensi langsung.</p>
                            </div>
                        </div>

                        <Link
                            to="/tickets/create"
                            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Buat Tiket Bantuan</span>
                        </Link>
                    </div>
                </div>

                {/* Right Area: Sticky Table of Contents, Step Tracker & Quick Summary (4 Columns) */}
                <div className="lg:col-span-4 space-y-4 sticky top-6">
                    {/* Step Tracker Card (if article has steps) */}
                    {totalSteps > 0 && (
                        <div className="p-4 rounded-2xl border border-border bg-card space-y-2.5 shadow-2xs">
                            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-foreground">
                                <span className="flex items-center gap-1.5">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                    <span>Progres Solusi</span>
                                </span>
                                <span className="font-mono text-emerald-600 dark:text-emerald-400">
                                    {completedCount}/{totalSteps} Selesai
                                </span>
                            </div>

                            <div className="w-full bg-muted rounded-full h-2 overflow-hidden border border-border/80">
                                <div
                                    className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                                    style={{ width: `${stepProgressPercent}%` }}
                                />
                            </div>

                            <p className="text-[11px] text-muted-foreground">
                                {completedCount === totalSteps
                                    ? '🎉 Selamat! Semua langkah telah Anda selesaikan.'
                                    : 'Klik tombol "Tandai Selesai" pada setiap langkah untuk memantau kemajuan Anda.'}
                            </p>
                        </div>
                    )}

                    {/* Table of Contents (Daftar Isi) */}
                    {tocItems.length > 0 && (
                        <div className="p-4 rounded-2xl border border-border bg-card space-y-3 shadow-2xs">
                            <div className="flex items-center gap-2 pb-2 border-b border-border text-xs font-bold uppercase tracking-wider text-foreground">
                                <ListTree className="w-4 h-4 text-muted-foreground" />
                                <span>Daftar Isi Panduan</span>
                            </div>

                            <nav className="space-y-1 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                                {tocItems.map((item, idx) => {
                                    const isStepDone = item.stepNumber ? !!completedSteps[item.stepNumber] : false;
                                    return (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => handleScrollTo(item.id)}
                                            className={cn(
                                                "w-full text-left text-xs py-1.5 px-2 rounded-lg transition-colors cursor-pointer flex items-center justify-between gap-1",
                                                item.level === 3 ? "pl-4 text-muted-foreground hover:text-foreground" : "font-semibold text-foreground/90 hover:bg-muted/50",
                                                activeTocId === item.id && "bg-muted text-primary font-bold"
                                            )}
                                            title={item.title}
                                        >
                                            <span className={cn("truncate", isStepDone && "line-through opacity-75")}>
                                                {item.title}
                                            </span>
                                            {isStepDone && (
                                                <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                                            )}
                                        </button>
                                    );
                                })}
                            </nav>
                        </div>
                    )}

                    {/* Quick Guide Info Card */}
                    <div className="p-4 rounded-2xl border border-border bg-card space-y-3 shadow-2xs text-xs">
                        <div className="flex items-center gap-2 pb-2 border-b border-border font-bold uppercase tracking-wider text-foreground">
                            <HelpCircle className="w-4 h-4 text-muted-foreground" />
                            <span>Informasi Panduan</span>
                        </div>

                        <div className="space-y-2 text-muted-foreground">
                            <div className="flex items-center justify-between">
                                <span>Tipe Solusi:</span>
                                <span className="font-semibold text-foreground">Mandiri (Self-Service)</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>Tingkat Kesulitan:</span>
                                <span className="font-semibold text-emerald-600 dark:text-emerald-400">Mudah / Pemula</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>Diperbarui:</span>
                                <span className="font-mono text-foreground">{formatIndonesianDate(article.updatedAt || article.createdAt)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Direct Helpdesk Shortcut */}
                    <div className="p-4 rounded-2xl border border-border bg-muted/20 space-y-2.5 text-xs">
                        <span className="font-bold text-foreground block">Butuh bantuan IT langsung?</span>
                        <p className="text-muted-foreground leading-relaxed">
                            Jika langkah-langkah di atas tidak berhasil, segera buat tiket bantuan di sistem.
                        </p>
                        <Link
                            to="/tickets/create"
                            className="w-full flex items-center justify-center gap-1.5 p-2 rounded-xl bg-foreground text-background font-bold text-xs hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Buat Tiket Sekarang</span>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BentoArticleDetailPage;
