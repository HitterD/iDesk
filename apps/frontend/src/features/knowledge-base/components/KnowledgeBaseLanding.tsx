import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, FilePlus2, Headphones, Search, SearchX, Settings2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ResEmpty, ResSkeletonRows } from '@/components/resources/ResourceParts';
import api from '@/lib/api';
import { logger } from '@/lib/logger';
import { useDebounce } from '@/hooks/useDebounce';
import { KbArticleRow } from './KbArticleRow';
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

    // Re-selecting the active topic clears it (mockup kb.html topic toggle).
    const selectTopic = useCallback((category: string) => {
        setSelectedCategory((current) => (current === category ? ALL_CATEGORIES : category));
    }, []);

    return (
        <div className="kb-page pb-24">
            <AuthorActions actions={actions} />
            <section className="kb-hero">
                <h1>{title}</h1>
                <p>{subtitle}</p>
                <SearchBox inputRef={searchInputRef} value={searchInput} onChange={setSearchInput} onClear={clearSearch} />
            </section>

            <TopicGrid categories={topics} onSelect={selectTopic} selected={selectedCategory === ALL_CATEGORIES ? undefined : selectedCategory} />

            <section className="kb-list" aria-label="Daftar artikel" aria-live="polite">
                <div className="kb-bar">
                    {isBrowsing ? (
                        <h2>{sort === 'popular' ? 'Artikel populer' : 'Artikel terbaru'}</h2>
                    ) : (
                        <ResultsHeading
                            search={debouncedSearch}
                            category={selectedCategory === ALL_CATEGORIES ? undefined : selectedCategory}
                            total={isInitialLoading ? undefined : totalArticles}
                            onReset={resetFilters}
                        />
                    )}
                    <span className="res-spacer" />
                    <SortControl value={sort} onChange={setSort} />
                </div>

                <ArticleFeed
                    articles={articles}
                    isLoading={isInitialLoading}
                    search={debouncedSearch}
                    articleBasePath={articleBasePath}
                    onReset={resetFilters}
                    isFiltered={!isBrowsing}
                    featured={isBrowsing && featured ? { article: featured, isRead: guideRead, onOpen: () => markGuideRead(featured.id) } : undefined}
                />

                {data?.hasMore && articles.length > 0 && (
                    <div className="kb-more">
                        <Button variant="subtle" onClick={() => setPage((p) => p + 1)} loading={isFetching}>
                            {isFetching ? 'Memuat…' : 'Muat lebih banyak'}
                        </Button>
                    </div>
                )}
            </section>

            <HelpCard createTicketPath={createTicketPath} />
        </div>
    );
};

function AuthorActions({ actions }: { actions?: KnowledgeBaseLandingProps['actions'] }) {
    if (!actions?.createArticlePath && !actions?.managePath) return null;
    return (
        <div className="kb-actions">
            {actions.managePath && (
                <Link to={actions.managePath} className="idesk-btn is-soft"><Settings2 aria-hidden="true" />Kelola</Link>
            )}
            {actions.createArticlePath && (
                <Link to={actions.createArticlePath} className="idesk-btn is-soft"><FilePlus2 aria-hidden="true" />Buat Artikel</Link>
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
        <label className="kb-search">
            <Search aria-hidden="true" />
            <input
                ref={inputRef}
                type="search"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Cari panduan, misal VPN, WiFi, Outlook"
                aria-label="Cari artikel panduan"
            />
            {value ? (
                <button type="button" className="queue-field-clear" onClick={onClear} title="Hapus pencarian" aria-label="Hapus pencarian">
                    <X aria-hidden="true" />
                </button>
            ) : <kbd className="hidden sm:inline">Ctrl K</kbd>}
        </label>
    );
}

function SortControl({ value, onChange }: { value: KBSort; onChange: (sort: KBSort) => void }) {
    return (
        <div role="radiogroup" aria-label="Urutkan artikel" className="kb-seg">
            {SORT_OPTIONS.map((option) => (
                <button key={option.value} type="button" role="radio" aria-checked={value === option.value} onClick={() => onChange(option.value)}>
                    {option.label}
                </button>
            ))}
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
            <button type="button" className="res-back" onClick={onReset} aria-label="Kembali ke semua topik" title="Kembali ke semua topik">
                <X aria-hidden="true" />
            </button>
            <h2>{label}</h2>
            {total !== undefined && <span className="res-muted shrink-0">{total} hasil</span>}
        </div>
    );
}

interface ArticleFeedProps {
    articles: KBArticle[];
    isLoading: boolean;
    search: string;
    articleBasePath: string;
    onReset: () => void;
    /** A search or topic is narrowing the feed, so "see all topics" can widen it. */
    isFiltered: boolean;
    /** "Mulai di sini" guide shown as the first row while browsing. */
    featured?: { article: KBArticle; isRead: boolean; onOpen: () => void };
}

const emptyCopy = (search: string, isFiltered: boolean): { title: string; body: string } => {
    if (search) return { title: 'Panduan tidak ditemukan', body: 'Coba kata kunci lain, atau lihat semua topik.' };
    if (isFiltered) return { title: 'Belum ada panduan di topik ini', body: 'Pilih topik lain atau buat tiket bantuan.' };
    return { title: 'Belum ada panduan', body: 'Panduan akan muncul di sini setelah tim IT menerbitkannya.' };
};

function ArticleFeed({ articles, isLoading, search, articleBasePath, onReset, isFiltered, featured }: ArticleFeedProps) {
    if (isLoading) {
        return <div className="kb-arts"><ResSkeletonRows rows={SKELETON_ROWS} /></div>;
    }
    if (articles.length === 0 && !featured) {
        const copy = emptyCopy(search, isFiltered);
        return (
            <ResEmpty icon={SearchX} className="kb-empty" title={copy.title}
                cta={isFiltered ? <Button variant="soft" onClick={onReset}>Lihat semua topik</Button> : undefined}>
                {copy.body}
            </ResEmpty>
        );
    }
    return (
        <div className="kb-arts">
            {featured && <KbArticleRow article={featured.article} to={`${articleBasePath}/${featured.article.id}`} start={featured.isRead ? 'Sudah dibaca' : 'Mulai di sini'} onOpen={featured.onOpen} />}
            {articles.map((article) => (
                <KbArticleRow key={article.id} article={article} to={`${articleBasePath}/${article.id}`} />
            ))}
        </div>
    );
}

function HelpCard({ createTicketPath }: { createTicketPath: string }) {
    return (
        <section className="kb-help" aria-label="Bantuan">
            <div className="kb-help-ic"><Headphones aria-hidden="true" /></div>
            <h2>Masih butuh bantuan?</h2>
            <p>Tim IT Helpdesk siap membantu. Buat tiket dan kami akan menindaklanjuti.</p>
            <Link to={createTicketPath} className="idesk-text-link">Buat tiket<ArrowRight aria-hidden="true" /></Link>
            <small>Operasional Senin–Jumat, 08:00–17:00 WIB</small>
        </section>
    );
}

export default KnowledgeBaseLanding;
