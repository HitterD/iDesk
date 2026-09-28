import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, X, Plus, Settings, SearchX, Headphones } from 'lucide-react';
import api from '@/lib/api';
import { logger } from '@/lib/logger';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';
import { ArticleListRow } from '@/components/ui/ArticleListRow';
import { FeaturedArticleCard } from '@/components/ui/FeaturedArticleCard';
import { TopicGrid } from './TopicGrid';
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
const SKELETON_ROWS = 6;
const READ_GUIDE_KEY = 'idesk.kb.featured-read';
const HEADLINE = 'Ada yang bisa kami bantu?';

const SORT_OPTIONS: Array<{ value: KBSort; label: string }> = [
    { value: 'popular', label: 'Populer' },
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

/** Focuses the search box on Ctrl/Cmd+K, or "/" when no other field is focused. */
const useSearchShortcut = (inputRef: React.RefObject<HTMLInputElement | null>) => {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const isCmdK = (e.ctrlKey || e.metaKey) && e.key === 'k';
            const tag = document.activeElement?.tagName.toLowerCase();
            const isSlash = e.key === '/' && tag !== 'input' && tag !== 'textarea';
            if (isCmdK || isSlash) {
                e.preventDefault();
                inputRef.current?.focus();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [inputRef]);
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
    const [guideRead, setGuideRead] = useState(false);

    // Realtime WebSocket synchronization for article views & engagement
    useKBSocket();
    useSearchShortcut(searchInputRef);

    const debouncedSearch = useDebounce(searchInput, 200);
    const isBrowsing = !debouncedSearch && selectedCategory === ALL_CATEGORIES;

    // Reset pagination when search, category, or sort changes
    useEffect(() => {
        setPage(0);
        setLoadedPages([]);
    }, [debouncedSearch, selectedCategory, sort]);

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

    useEffect(() => {
        if (featured?.id) setGuideRead(hasReadGuide(featured.id));
    }, [featured?.id]);

    const articles = useMemo(() => loadedPages.flat().filter(Boolean), [loadedPages]);
    const topics = useMemo(() => categories.slice(0, MAX_VISIBLE_CATEGORIES), [categories]);
    const totalArticles = data?.total ?? articles.length;
    const isInitialLoading = isLoading && articles.length === 0;

    const clearSearch = useCallback(() => {
        setSearchInput('');
        searchInputRef.current?.focus();
    }, []);

    const resetFilters = useCallback(() => {
        setSearchInput('');
        setSelectedCategory(ALL_CATEGORIES);
    }, []);

    const selectTopic = useCallback((category: string) => {
        setSelectedCategory(category);
        setSearchInput('');
    }, []);

    return (
        <div className="mx-auto w-full max-w-3xl px-4 pb-24 sm:px-6 space-y-10">
            <header className="relative pt-8 text-center sm:pt-14">
                <AuthorActions actions={actions} />
                <p className="text-sm font-medium text-primary">{title}</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground text-balance sm:text-5xl">
                    {HEADLINE}
                </h1>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                    {subtitle}
                </p>
            </header>

            <SearchBox
                inputRef={searchInputRef}
                value={searchInput}
                onChange={setSearchInput}
                onClear={clearSearch}
            />

            {isBrowsing && (
                <div className="space-y-10 animate-fade-in-up">
                    {featured && (
                        <FeaturedArticleCard
                            article={featured}
                            to={`${articleBasePath}/${featured.id}`}
                            isRead={guideRead}
                            onOpen={() => markGuideRead(featured.id)}
                        />
                    )}
                    <TopicGrid categories={topics} onSelect={selectTopic} />
                </div>
            )}

            <section className="space-y-3" aria-live="polite">
                <div className="flex items-center justify-between gap-3">
                    {isBrowsing ? (
                        <h2 className="text-lg font-semibold tracking-tight text-foreground">
                            {sort === 'popular' ? 'Artikel populer' : 'Artikel terbaru'}
                        </h2>
                    ) : (
                        <ResultsHeading
                            search={debouncedSearch}
                            category={selectedCategory === ALL_CATEGORIES ? undefined : selectedCategory}
                            total={isInitialLoading ? undefined : totalArticles}
                            onReset={resetFilters}
                        />
                    )}
                    <SortControl value={sort} onChange={setSort} />
                </div>

                <ArticleFeed
                    articles={articles}
                    isLoading={isInitialLoading}
                    search={debouncedSearch}
                    articleBasePath={articleBasePath}
                    onReset={resetFilters}
                />

                {data?.hasMore && articles.length > 0 && (
                    <div className="flex justify-center pt-4">
                        <button
                            type="button"
                            onClick={() => setPage((p) => p + 1)}
                            disabled={isFetching}
                            className="rounded-full px-5 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/5 disabled:opacity-50"
                        >
                            {isFetching ? 'Memuat…' : 'Muat lebih banyak'}
                        </button>
                    </div>
                )}
            </section>

            <HelpCard createTicketPath={createTicketPath} />
        </div>
    );
};

function AuthorActions({ actions }: { actions?: KnowledgeBaseLandingProps['actions'] }) {
    if (!actions?.createArticlePath && !actions?.managePath) return null;

    const pillClass = 'inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium transition-colors';
    return (
        <div className="mb-6 flex justify-center gap-2 sm:absolute sm:right-0 sm:top-6 sm:mb-0">
            {actions.createArticlePath && (
                <Link to={actions.createArticlePath} className={cn(pillClass, 'bg-primary text-primary-foreground hover:bg-primary/90')}>
                    <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                    <span>Buat Artikel</span>
                </Link>
            )}
            {actions.managePath && (
                <Link to={actions.managePath} className={cn(pillClass, 'bg-muted/70 text-foreground hover:bg-muted')}>
                    <Settings className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
                    <span>Kelola</span>
                </Link>
            )}
        </div>
    );
}

interface SearchBoxProps {
    inputRef: React.RefObject<HTMLInputElement | null>;
    value: string;
    onChange: (value: string) => void;
    onClear: () => void;
}

function SearchBox({ inputRef, value, onChange, onClear }: SearchBoxProps) {
    return (
        <div className="group relative flex items-center">
            <Search
                className="pointer-events-none absolute left-5 h-5 w-5 text-muted-foreground transition-colors group-focus-within:text-primary"
                strokeWidth={1.75}
                aria-hidden="true"
            />
            <input
                ref={inputRef}
                type="search"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Cari panduan, misal VPN, WiFi, Outlook"
                aria-label="Cari artikel panduan"
                className={cn(
                    'w-full rounded-2xl bg-muted/60 py-4 pl-13 pr-20 text-base text-foreground',
                    'placeholder:text-muted-foreground/70',
                    'transition-all duration-200 focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 focus:shadow-lg',
                    '[&::-webkit-search-cancel-button]:hidden',
                )}
            />
            <div className="absolute right-4 flex items-center">
                {value ? (
                    <button
                        type="button"
                        onClick={onClear}
                        title="Hapus pencarian"
                        aria-label="Hapus pencarian"
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-muted-foreground/20 text-muted-foreground transition-colors hover:bg-muted-foreground/30"
                    >
                        <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </button>
                ) : (
                    <kbd className="hidden rounded-md bg-card px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground ring-1 ring-border sm:inline">
                        Ctrl K
                    </kbd>
                )}
            </div>
        </div>
    );
}

function SortControl({ value, onChange }: { value: KBSort; onChange: (sort: KBSort) => void }) {
    return (
        <div role="radiogroup" aria-label="Urutkan artikel" className="flex shrink-0 rounded-full bg-muted/70 p-0.5">
            {SORT_OPTIONS.map((option) => {
                const isActive = value === option.value;
                return (
                    <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        onClick={() => onChange(option.value)}
                        className={cn(
                            'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                            isActive ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}

interface ResultsHeadingProps {
    search: string;
    category?: string;
    total?: number;
    onReset: () => void;
}

function ResultsHeading({ search, category, total, onReset }: ResultsHeadingProps) {
    const label = search ? `“${search}”${category ? ` di ${category}` : ''}` : category;
    return (
        <div className="flex min-w-0 items-center gap-2">
            <button
                type="button"
                onClick={onReset}
                aria-label="Kembali ke semua topik"
                title="Kembali ke semua topik"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted/70 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
                <X className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
            <h2 className="min-w-0 truncate text-lg font-semibold tracking-tight text-foreground">{label}</h2>
            {total !== undefined && (
                <span className="shrink-0 text-sm text-muted-foreground">{total} hasil</span>
            )}
        </div>
    );
}

interface ArticleFeedProps {
    articles: KBArticle[];
    isLoading: boolean;
    search: string;
    articleBasePath: string;
    onReset: () => void;
}

function ArticleFeed({ articles, isLoading, search, articleBasePath, onReset }: ArticleFeedProps) {
    const listClass = 'overflow-hidden rounded-2xl bg-card ring-1 ring-border/60 divide-y divide-border/60';

    if (isLoading) {
        return (
            <div className={listClass}>
                {Array.from({ length: SKELETON_ROWS }, (_, i) => (
                    <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
                        <div className="h-9 w-9 shrink-0 rounded-full bg-muted" />
                        <div className="flex-1 space-y-2">
                            <div className="h-3.5 w-2/3 rounded bg-muted" />
                            <div className="h-2.5 w-1/3 rounded bg-muted/70" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (articles.length === 0) {
        return (
            <div className="rounded-2xl bg-muted/40 px-6 py-14 text-center">
                <SearchX className="mx-auto h-8 w-8 text-muted-foreground/60" strokeWidth={1.5} aria-hidden="true" />
                <h3 className="mt-3 text-base font-semibold text-foreground">
                    {search ? 'Panduan tidak ditemukan' : 'Belum ada panduan di topik ini'}
                </h3>
                <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                    {search ? 'Coba kata kunci lain, atau lihat semua topik.' : 'Pilih topik lain atau buat tiket bantuan.'}
                </p>
                <button type="button" onClick={onReset} className="mt-4 text-sm font-medium text-primary hover:underline">
                    Lihat semua topik
                </button>
            </div>
        );
    }

    return (
        <div className={listClass}>
            {articles.map((article) => (
                <ArticleListRow key={article.id} article={article} to={`${articleBasePath}/${article.id}`} />
            ))}
        </div>
    );
}

function HelpCard({ createTicketPath }: { createTicketPath: string }) {
    return (
        <section className="rounded-3xl bg-muted/50 px-6 py-8 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Headphones className="h-6 w-6" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <h2 className="mt-3 text-lg font-semibold tracking-tight text-foreground">Masih butuh bantuan?</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Tim IT Helpdesk siap membantu. Buat tiket dan kami akan menindaklanjuti.
            </p>
            <Link
                to={createTicketPath}
                className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
                <Plus className="h-4 w-4" strokeWidth={2} />
                Buat tiket
            </Link>
            <p className="mt-4 text-xs text-muted-foreground">
                Rata-rata respon IT &lt; 15 menit · Operasional 08:00–17:00 WIB
            </p>
        </section>
    );
}

export default KnowledgeBaseLanding;
