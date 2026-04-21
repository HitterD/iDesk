import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, ChevronRight, BookOpen, Plus, Settings, Eye, ImageIcon, Loader2, Filter } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { logger } from '@/lib/logger';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';
import { ArticleCard } from '@/components/ui/ArticleCard';
import { ArticleSearchAutocomplete } from '@/components/ui/ArticleSearchAutocomplete';

interface Article {
    id: string;
    title: string;
    content: string;
    category: string;
    tags: string[];
    viewCount: number;
    featuredImage?: string;
    createdAt: string;
}

// Skeleton component for loading state
const ArticleSkeleton: React.FC = () => (
    <div className="h-full glass-card overflow-hidden animate-pulse">
        <div className="h-40 bg-muted" />
        <div className="p-5">
            <div className="w-20 h-6 bg-muted rounded-md mb-3" />
            <div className="w-full h-5 bg-muted rounded mb-2" />
            <div className="w-3/4 h-4 bg-muted rounded mb-4" />
            <div className="w-1/2 h-4 bg-muted rounded" />
        </div>
    </div>
);

// Category filter tabs
const CATEGORIES = ['All', 'Software', 'Hardware', 'Network', 'Security', 'General'];

export const BentoKnowledgeBasePage: React.FC = () => {
    const [searchInput, setSearchInput] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');

    // Debounce search input to avoid excessive API calls
    const debouncedSearch = useDebounce(searchInput, 300);

    // Fetch articles with React Query
    const {
        data: articles = [],
        isLoading,
        error,
    } = useQuery<Article[]>({
        queryKey: ['kb-articles', debouncedSearch, selectedCategory],
        queryFn: async () => {
            const params: Record<string, string> = {};
            if (debouncedSearch) params.q = debouncedSearch;
            if (selectedCategory !== 'All') params.category = selectedCategory;

            const response = await api.get('/kb/articles', { params });
            return response.data;
        },
        staleTime: 60000, // 1 minute
        retry: 2,
    });

    // Log errors using logger utility
    if (error) {
        logger.error('Failed to fetch articles:', error);
    }

    // Group articles by category for display
    const categoryCounts = useMemo(() => {
        const counts: Record<string, number> = { All: articles.length };
        articles.forEach(article => {
            counts[article.category] = (counts[article.category] || 0) + 1;
        });
        return counts;
    }, [articles]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        // Search is already triggered by debounced value change
    };

    return (
        <div className="space-y-8 animate-fade-in-up">
            {/* Hero Section */}
            <div className="relative overflow-hidden glass-card p-8 md:p-12 text-center border-t-2 border-t-primary/20">
                {/* Action Buttons */}
                <div className="absolute top-4 right-4 md:top-6 md:right-6 flex items-center gap-2 z-20">
                    <Link
                        to="/kb/create"
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-[var(--radius-md)] text-sm font-semibold hover:bg-primary/90 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        <span className="hidden sm:inline">New Article</span>
                    </Link>
                    <Link
                        to="/kb/manage"
                        className="flex items-center gap-2 px-4 py-2 bg-background border border-border text-foreground hover:bg-muted rounded-[var(--radius-md)] text-sm font-semibold transition-colors"
                    >
                        <Settings className="w-4 h-4" />
                        <span className="hidden sm:inline">Manage</span>
                    </Link>
                </div>

                <div className="relative z-30 mt-6 md:mt-0">
                    <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-primary/20">
                        <BookOpen className="w-7 h-7 text-primary" />
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3 tracking-tight">
                        How can we help you?
                    </h1>
                    <p className="text-muted-foreground max-w-2xl mx-auto mb-8 text-base md:text-lg">
                        Search our knowledge base for answers to common questions and issues.
                    </p>

                    <div className="max-w-xl mx-auto relative z-50 text-left">
                        <ArticleSearchAutocomplete
                            placeholder="Search for articles (e.g. 'printer', 'vpn')..."
                            basePath="/kb/articles"
                            categories={CATEGORIES.filter(c => c !== 'All')}
                            className="w-full shadow-sm"
                        />
                    </div>
                </div>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-border">
                <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0 mr-1" />
                {CATEGORIES.map((category) => (
                    <button
                        key={category}
                        onClick={() => setSelectedCategory(category)}
                        className={cn(
                            "px-4 py-2 rounded-t-lg text-sm font-medium whitespace-nowrap transition-colors duration-150 border-b-2",
                            selectedCategory === category
                                ? "border-primary text-primary bg-primary/5"
                                : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                        )}
                    >
                        {category}
                        {categoryCounts[category] !== undefined && (
                            <span className={cn(
                                "ml-2 text-xs px-1.5 py-0.5 rounded-md",
                                selectedCategory === category ? "bg-primary/20" : "bg-muted"
                            )}>
                                {categoryCounts[category] || 0}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Articles Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 stagger-1">
                {isLoading ? (
                    // Show skeletons while loading
                    <>
                        <ArticleSkeleton />
                        <ArticleSkeleton />
                        <ArticleSkeleton />
                        <ArticleSkeleton />
                        <ArticleSkeleton />
                        <ArticleSkeleton />
                    </>
                ) : articles.length === 0 ? (
                    <div className="col-span-full text-center py-12">
                        <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                        <p className="text-muted-foreground text-lg font-medium">
                            {searchInput ? `No articles found for "${searchInput}"` : 'No articles found.'}
                        </p>
                        <p className="text-muted-foreground/70 text-sm mt-2">
                            Try adjusting your search or filter criteria.
                        </p>
                    </div>
                ) : (
                    articles.map((article) => (
                        <ArticleCard
                            key={article.id}
                            article={article}
                            to={`/kb/articles/${article.id}`}
                            variant="default"
                        />
                    ))
                )}
            </div>

            {/* Results count */}
            {!isLoading && articles.length > 0 && (
                <p className="text-center text-sm text-muted-foreground">
                    Showing {articles.length} article{articles.length !== 1 ? 's' : ''}
                    {searchInput && <span className="text-foreground"> for "{searchInput}"</span>}
                    {selectedCategory !== 'All' && ` in ${selectedCategory}`}
                </p>
            )}
        </div>
    );
};

export default BentoKnowledgeBasePage;
