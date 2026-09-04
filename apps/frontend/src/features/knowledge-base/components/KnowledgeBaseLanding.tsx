import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
    Search,
    X,
    LifeBuoy,
    Plus,
    Settings,
    SlidersHorizontal,
    BookOpen,
    LayoutGrid,
    List,
    Clock,
    CheckCircle2,
    Headphones,
    ArrowRight,
    SearchX,
    ExternalLink,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/api';
import { logger } from '@/lib/logger';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';
import { ArticleListRow } from '@/components/ui/ArticleListRow';
import { ArticleCard } from '@/components/ui/ArticleCard';
import { FeaturedArticleCard } from '@/components/ui/FeaturedArticleCard';
import { QuickTopicBento } from './QuickTopicBento';
import { useKBSocket } from '../hooks/useKBSocket';

export interface KBArticle {
    id: string;
    title: string;
    content: string;
    category: string;
    tags?: string[];
    viewCount?: number;
    createdAt: string;
    updatedAt?: string;
    author?: {
        fullName: string;
        avatarUrl?: string;
    };
}

interface PagedArticles {
    items: KBArticle[];
    total: number;
    hasMore: boolean;
}

export type KBSort = 'popular' | 'recent';
export type KBViewMode = 'grid' | 'list';

interface KnowledgeBaseLandingProps {
    title: string;
    subtitle: string;
    /** Path prefix for article links, e.g. "/kb/articles" or "/client/kb/articles". */
    articleBasePath: string;
    /** Where the "create ticket" calls to action lead. */
    createTicketPath: string;
    /** Author actions, rendered only for roles the backend actually accepts. */
    actions?: { createArticlePath?: string; managePath?: string };
}

const ALL_CATEGORIES = 'All';
const MAX_VISIBLE_CATEGORIES = 8;
const PAGE_SIZE = 24;
const READ_GUIDE_KEY = 'idesk.kb.featured-read';
const VIEW_MODE_KEY = 'idesk.kb.view-mode';

const QUICK_SEARCH_CHIPS = [
    { label: 'VPN WatchGuard', query: 'VPN' },
    { label: 'Reset Password', query: 'Password' },
    { label: 'WiFi Kantor', query: 'WiFi' },
    { label: 'Setup Outlook', query: 'Outlook' },
    { label: 'Shared Drive / File Server', query: 'Shared' },
    { label: 'Pengajuan E-Form', query: 'E-Form' },
];

const SORT_OPTIONS: Array<{ value: KBSort; label: string }> = [
    { value: 'popular', label: 'Paling Populer' },
    { value: 'recent', label: 'Terbaru' },
];

const hasReadGuide = (articleId?: string): boolean => {
    if (!articleId) return false;
    try {
        return localStorage.getItem(READ_GUIDE_KEY) === articleId;
    } catch {
        return false;
    }
};

const markGuideRead = (articleId: string): void => {
    try {
        localStorage.setItem(READ_GUIDE_KEY, articleId);
    } catch {
        /* storage unavailable */
    }
};

export const KnowledgeBaseLanding: React.FC<KnowledgeBaseLandingProps> = ({
    title,
    subtitle,
    articleBasePath,
    createTicketPath,
    actions,
}) => {
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [searchInput, setSearchInput] = useState('');
    const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORIES);
    const [sort, setSort] = useState<KBSort>('popular');
    const [page, setPage] = useState(0);
    const [loadedPages, setLoadedPages] = useState<KBArticle[][]>([]);
    const [viewMode, setViewMode] = useState<KBViewMode>(() => {
        try {
            return (localStorage.getItem(VIEW_MODE_KEY) as KBViewMode) || 'grid';
        } catch {
            return 'grid';
        }
    });

    // Realtime WebSocket synchronization for article views & engagement
    useKBSocket();

    const debouncedSearch = useDebounce(searchInput, 200);
    const isBrowsing = !debouncedSearch && selectedCategory === ALL_CATEGORIES;

    // Reset pagination when search, category, or sort changes
    useEffect(() => {
        setPage(0);
        setLoadedPages([]);
    }, [debouncedSearch, selectedCategory, sort]);

    // Handle view mode change & persist
    const handleViewModeChange = (mode: KBViewMode) => {
        setViewMode(mode);
        try {
            localStorage.setItem(VIEW_MODE_KEY, mode);
        } catch {
            /* ignore */
        }
    };

    // Keyboard shortcut to focus search (/ or Ctrl+K / Cmd+K)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                searchInputRef.current?.focus();
            } else if (e.key === '/' && document.activeElement !== searchInputRef.current) {
                // Check if user is currently in another input
                const tag = document.activeElement?.tagName.toLowerCase();
                if (tag !== 'input' && tag !== 'textarea') {
                    e.preventDefault();
                    searchInputRef.current?.focus();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const { data: categories = [] } = useQuery<string[]>({
        queryKey: ['kb-categories'],
        queryFn: async () => (await api.get('/kb/categories')).data,
        staleTime: 300000,
    });

    const { data: featured } = useQuery<KBArticle | null>({
        queryKey: ['kb-featured'],
        queryFn: async () => (await api.get('/kb/articles/featured')).data || null,
        staleTime: 300000,
    });

    const { data, isLoading, isFetching, error } = useQuery<PagedArticles>({
        queryKey: ['kb-articles', debouncedSearch, selectedCategory, sort, page],
        queryFn: async () => {
            const params: Record<string, string> = {
                sort,
                limit: String(PAGE_SIZE),
                offset: String(page * PAGE_SIZE),
                excludeFeatured: 'true',
            };
            if (debouncedSearch) params.q = debouncedSearch;
            if (selectedCategory !== ALL_CATEGORIES) params.category = selectedCategory;

            const response = await api.get('/kb/articles', { params });
            return response.data;
        },
        staleTime: 30000,
        retry: 2,
    });

    if (error) {
        logger.error('Failed to fetch articles:', error);
    }

    // Accumulate pages
    useEffect(() => {
        if (!data) return;
        setLoadedPages((prev) => {
            const next = [...prev];
            next[page] = data.items;
            return next;
        });
    }, [data, page]);

    const articles = useMemo(() => loadedPages.flat().filter(Boolean), [loadedPages]);
    const totalArticles = data?.total ?? articles.length;

    const visibleCategories = useMemo(
        () => [ALL_CATEGORIES, ...categories.slice(0, MAX_VISIBLE_CATEGORIES)],
        [categories],
    );

    const clearSearch = useCallback(() => {
        setSearchInput('');
        searchInputRef.current?.focus();
    }, []);

    const [guideRead, setGuideRead] = useState(false);

    useEffect(() => {
        if (featured?.id) setGuideRead(hasReadGuide(featured.id));
    }, [featured?.id]);

    const showFeatured = isBrowsing && !!featured;
    const isInitialLoading = isLoading && articles.length === 0;
    const isEmpty = !isInitialLoading && articles.length === 0;

    const handleSelectQuickTopic = (category: string, searchKeyword?: string) => {
        if (searchKeyword && !categories.some(c => c.toLowerCase() === category.toLowerCase())) {
            setSearchInput(searchKeyword);
            setSelectedCategory(ALL_CATEGORIES);
        } else {
            setSelectedCategory(category);
            setSearchInput('');
        }
    };

    return (
        <div className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6 space-y-8 sm:space-y-10">
            {/* Header & Action Bar */}
            <header className="pt-6 sm:pt-10">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[11px] font-semibold text-primary">
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>iDesk Knowledge Center</span>
                        </div>
                        <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground text-balance">
                            {title}
                        </h1>
                        <p className="max-w-2xl text-xs sm:text-sm leading-relaxed text-muted-foreground">
                            {subtitle}
                        </p>
                    </div>

                    {(actions?.createArticlePath || actions?.managePath) && (
                        <div className="flex shrink-0 items-center gap-2.5 pt-1">
                            {actions.createArticlePath && (
                                <Link
                                    to={actions.createArticlePath}
                                    className="inline-flex items-center gap-2 rounded-full bg-primary px-4 sm:px-5 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm shadow-primary/25 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-primary/90 hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
                                >
                                    <Plus className="w-4 h-4" strokeWidth={2} />
                                    <span>Buat Artikel</span>
                                </Link>
                            )}
                            {actions.managePath && (
                                <Link
                                    to={actions.managePath}
                                    className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-muted/70 hover:border-foreground/30 active:scale-[0.98]"
                                >
                                    <Settings className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} />
                                    <span>Kelola</span>
                                </Link>
                            )}
                        </div>
                    )}
                </div>
            </header>

            {/* Interactive Search Section with Quick Suggestion Chips */}
            <section className="space-y-3">
                <div className="relative flex items-center group">
                    <Search
                        className="pointer-events-none absolute left-5 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors"
                        strokeWidth={1.75}
                        aria-hidden="true"
                    />
                    <input
                        ref={searchInputRef}
                        type="search"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder="Cari solusi atau kata kunci panduan (misal: VPN, WiFi, Outlook, Password)..."
                        aria-label="Cari artikel panduan"
                        className={cn(
                            'w-full rounded-[1.5rem] border border-border/80 bg-card py-4 pl-13 pr-24 text-sm sm:text-base text-foreground',
                            'placeholder:text-muted-foreground/70',
                            'shadow-[0_2px_12px_rgba(0,0,0,0.03)]',
                            'transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
                            'focus:border-primary/50 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:shadow-lg',
                            '[&::-webkit-search-cancel-button]:hidden',
                        )}
                    />

                    {/* Right side controls (Clear & Keyboard Shortcut badge) */}
                    <div className="absolute right-4 flex items-center gap-2">
                        {searchInput ? (
                            <button
                                type="button"
                                onClick={clearSearch}
                                title="Hapus pencarian"
                                aria-label="Hapus pencarian"
                                className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                            >
                                <X className="h-4 w-4" strokeWidth={2} />
                            </button>
                        ) : (
                            <kbd className="hidden sm:inline-flex items-center gap-1 rounded-lg border border-border bg-muted/60 px-2 py-1 text-[10px] font-mono font-medium text-muted-foreground">
                                <span>Ctrl</span>
                                <span>K</span>
                            </kbd>
                        )}
                    </div>
                </div>

                {/* Quick Suggestion Chips */}
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider shrink-0 pl-1">
                        Saran:
                    </span>
                    {QUICK_SEARCH_CHIPS.map((chip) => (
                        <button
                            key={chip.label}
                            type="button"
                            onClick={() => setSearchInput(chip.query)}
                            className={cn(
                                'shrink-0 rounded-full border border-border/70 bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground',
                                'transition-all duration-200 hover:border-primary/40 hover:bg-primary/5 hover:text-primary active:scale-95',
                                searchInput.toLowerCase() === chip.query.toLowerCase() &&
                                    'border-primary bg-primary/10 text-primary font-semibold',
                            )}
                        >
                            {chip.label}
                        </button>
                    ))}
                </div>
            </section>

            {/* Spotlight & Quick Topic Bento (Visible when browsing) */}
            {isBrowsing && (
                <section className="space-y-6 animate-fade-in-up">
                    {/* Pinned Featured Article Card */}
                    {showFeatured && (
                        <FeaturedArticleCard
                            article={featured}
                            to={`${articleBasePath}/${featured.id}`}
                            isRead={guideRead}
                            onOpen={() => markGuideRead(featured.id)}
                        />
                    )}

                    {/* 4 Quick Action Category Bento Tiles */}
                    <QuickTopicBento
                        onSelectTopic={handleSelectQuickTopic}
                        activeCategory={selectedCategory}
                    />
                </section>
            )}

            {/* Article Feed Header: Category Pills, View Mode Toggle, & Sort */}
            <section className="space-y-4 pt-2">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    {/* Category Pills */}
                    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-1 sm:pb-0">
                        {visibleCategories.map((cat) => {
                            const isActive = selectedCategory === cat;
                            return (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => {
                                        setSelectedCategory(cat);
                                        if (searchInput) setSearchInput('');
                                    }}
                                    aria-pressed={isActive}
                                    className={cn(
                                        'shrink-0 rounded-full px-4 py-1.5 text-xs font-medium',
                                        'transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-95',
                                        isActive
                                            ? 'bg-foreground text-background shadow-sm font-semibold'
                                            : 'text-muted-foreground bg-muted/40 hover:bg-muted hover:text-foreground',
                                    )}
                                >
                                    {cat === ALL_CATEGORIES ? 'Semua Kategori' : cat}
                                </button>
                            );
                        })}
                    </div>

                    {/* Right Tools: Result count, Sort, and View Toggle */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                        {/* Sort Selector */}
                        <div className="flex items-center gap-1.5 rounded-full border border-border/80 bg-card px-3 py-1 text-xs">
                            <SlidersHorizontal
                                className="h-3.5 w-3.5 text-muted-foreground"
                                strokeWidth={1.75}
                                aria-hidden="true"
                            />
                            <select
                                value={sort}
                                onChange={(e) => setSort(e.target.value as KBSort)}
                                aria-label="Urutkan artikel"
                                className="cursor-pointer bg-transparent text-xs font-medium text-muted-foreground hover:text-foreground focus:outline-none"
                            >
                                {SORT_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Dual-View Toggle (Grid vs List) */}
                        <div className="flex items-center rounded-full border border-border/80 bg-card p-0.5">
                            <button
                                type="button"
                                onClick={() => handleViewModeChange('grid')}
                                title="Tampilan Kartu (Grid)"
                                aria-label="Tampilan Kartu"
                                className={cn(
                                    'rounded-full p-1.5 transition-all duration-200',
                                    viewMode === 'grid'
                                        ? 'bg-primary text-primary-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground',
                                )}
                            >
                                <LayoutGrid className="w-3.5 h-3.5" strokeWidth={2} />
                            </button>
                            <button
                                type="button"
                                onClick={() => handleViewModeChange('list')}
                                title="Tampilan Baris (List)"
                                aria-label="Tampilan Baris"
                                className={cn(
                                    'rounded-full p-1.5 transition-all duration-200',
                                    viewMode === 'list'
                                        ? 'bg-primary text-primary-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground',
                                )}
                            >
                                <List className="w-3.5 h-3.5" strokeWidth={2} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Active Filter / Search Query Status Indicator */}
                {(debouncedSearch || selectedCategory !== ALL_CATEGORIES) && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/40 px-4 py-2 rounded-xl border border-border/60">
                        <div className="flex items-center gap-2 truncate">
                            <span>Menampilkan hasil untuk:</span>
                            {debouncedSearch && (
                                <span className="font-semibold text-foreground bg-card px-2 py-0.5 rounded-md border border-border">
                                    "{debouncedSearch}"
                                </span>
                            )}
                            {selectedCategory !== ALL_CATEGORIES && (
                                <span className="font-semibold text-foreground bg-card px-2 py-0.5 rounded-md border border-border">
                                    Kategori: {selectedCategory}
                                </span>
                            )}
                            <span className="text-muted-foreground/70">({totalArticles} panduan ditemukan)</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                setSearchInput('');
                                setSelectedCategory(ALL_CATEGORIES);
                            }}
                            className="text-primary hover:underline font-medium shrink-0 ml-2"
                        >
                            Reset Filter
                        </button>
                    </div>
                )}

                {/* Dynamic Article Feed: Grid Mode or List Mode */}
                {isInitialLoading ? (
                    viewMode === 'grid' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {Array.from({ length: 6 }, (_, i) => (
                                <div
                                    key={i}
                                    className="h-48 rounded-[1.5rem] border border-border bg-card p-5 animate-pulse space-y-3"
                                >
                                    <div className="h-5 w-24 rounded-full bg-muted" />
                                    <div className="h-4 w-3/4 rounded bg-muted" />
                                    <div className="h-3 w-full rounded bg-muted/70" />
                                    <div className="h-3 w-2/3 rounded bg-muted/70" />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="overflow-hidden rounded-[1.5rem] border border-border bg-card divide-y divide-border/60">
                            {Array.from({ length: 6 }, (_, i) => (
                                <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
                                    <div className="h-9 w-9 shrink-0 rounded-xl bg-muted" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-3.5 w-2/3 rounded bg-muted" />
                                        <div className="h-2.5 w-1/3 rounded bg-muted/70" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                ) : isEmpty ? (
                    /* Refined Empty State */
                    <div className="rounded-[1.75rem] border border-border/80 bg-card px-6 py-16 text-center space-y-4">
                        <div className="mx-auto w-12 h-12 rounded-2xl bg-muted/80 border border-border flex items-center justify-center text-muted-foreground">
                            <SearchX className="w-6 h-6" strokeWidth={1.5} />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-base font-bold text-foreground">
                                {debouncedSearch ? 'Panduan tidak ditemukan' : 'Belum ada panduan di kategori ini'}
                            </h3>
                            <p className="mx-auto max-w-md text-xs sm:text-sm text-muted-foreground leading-relaxed">
                                {debouncedSearch
                                    ? `Tidak ada artikel yang cocok dengan kata kunci "${debouncedSearch}". Coba istilah lain, atau hubungi Helpdesk IT.`
                                    : 'Belum ada dokumen pada kategori ini. Silakan pilih kategori lain atau ajukan tiket bantuan.'}
                            </p>
                        </div>

                        {/* Category suggestions */}
                        {categories.length > 0 && (
                            <div className="pt-2 flex flex-wrap items-center justify-center gap-1.5">
                                {categories.slice(0, 6).map((cat) => (
                                    <button
                                        key={cat}
                                        type="button"
                                        onClick={() => {
                                            setSearchInput('');
                                            setSelectedCategory(cat);
                                        }}
                                        className="rounded-full border border-border/80 bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="pt-4">
                            <Link
                                to={createTicketPath}
                                className="group inline-flex items-center gap-2 rounded-full bg-primary py-2.5 pl-5 pr-3 text-xs font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-all duration-300 hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98]"
                            >
                                <span>Buat Tiket Bantuan IT</span>
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 transition-transform duration-300 group-hover:translate-x-0.5">
                                    <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                                </span>
                            </Link>
                        </div>
                    </div>
                ) : viewMode === 'grid' ? (
                    /* Bento Grid Mode */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5">
                        {articles.map((article) => (
                            <ArticleCard
                                key={article.id}
                                article={article}
                                to={`${articleBasePath}/${article.id}`}
                            />
                        ))}
                    </div>
                ) : (
                    /* Linear Row List Mode */
                    <div className="overflow-hidden rounded-[1.5rem] border border-border/80 bg-card divide-y divide-border/60 shadow-xs">
                        {articles.map((article) => (
                            <ArticleListRow
                                key={article.id}
                                article={article}
                                to={`${articleBasePath}/${article.id}`}
                            />
                        ))}
                    </div>
                )}

                {/* Load More Button */}
                {data?.hasMore && !isEmpty && (
                    <div className="mt-8 flex justify-center">
                        <button
                            type="button"
                            onClick={() => setPage((p) => p + 1)}
                            disabled={isFetching}
                            className={cn(
                                'rounded-full border border-border bg-card px-6 py-2.5 text-xs font-semibold text-foreground shadow-xs',
                                'transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
                                'hover:bg-muted hover:border-foreground/30 active:scale-[0.98] disabled:opacity-50',
                            )}
                        >
                            {isFetching ? 'Memuat artikel berikutnya...' : 'Muat lebih banyak artikel'}
                        </button>
                    </div>
                )}
            </section>

            {/* Support & Helpdesk Escalation Bridge */}
            <section className="relative overflow-hidden rounded-[1.75rem] border border-border/80 bg-card p-6 sm:p-8 shadow-xs">
                {/* Ambient Decorative Background */}
                <div
                    className="pointer-events-none absolute -bottom-16 -right-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl"
                    aria-hidden="true"
                />

                <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                            <Headphones className="h-6 w-6" strokeWidth={1.75} aria-hidden="true" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-base sm:text-lg font-bold text-foreground">
                                Belum menemukan solusi untuk kendala Anda?
                            </h3>
                            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-xl">
                                Tim IT Helpdesk siap membantu. Buat tiket permohonan atau pelaporan kendala langsung dari portal ini.
                            </p>
                            <div className="pt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                                <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Rata-rata respon IT &lt; 15 menit
                                </span>
                                <span>•</span>
                                <span>Operasional: 08:00 - 17:00 WIB</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-3 self-start sm:self-center">
                        <Link
                            to={createTicketPath}
                            className="group inline-flex items-center gap-2.5 rounded-full bg-primary py-2.5 pl-5 pr-3 text-xs font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-all duration-300 hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <span>Buat Tiket Bantuan</span>
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 transition-transform duration-300 group-hover:translate-x-0.5">
                                <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                            </span>
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default KnowledgeBaseLanding;
