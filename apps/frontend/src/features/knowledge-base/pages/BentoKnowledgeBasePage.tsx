import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, ChevronRight, BookOpen, Plus, Settings, Eye, ImageIcon, Loader2, Filter } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { logger } from '@/lib/logger';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';

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
    <div className="h-full bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 overflow-hidden animate-pulse">
        <div className="h-40 bg-slate-200 dark:bg-slate-700" />
        <div className="p-6">
            <div className="w-20 h-6 bg-slate-200 dark:bg-slate-700 rounded-lg mb-3" />
            <div className="w-full h-6 bg-slate-200 dark:bg-slate-700 rounded mb-2" />
            <div className="w-3/4 h-4 bg-slate-200 dark:bg-slate-700 rounded mb-4" />
            <div className="w-1/2 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
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
        <div className="space-y-8">
            {/* Hero Section */}
            <div className="relative overflow-hidden rounded-[3rem] bg-slate-900 p-12 text-center shadow-xl">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000" />

                {/* Action Buttons */}
                <div className="absolute top-6 right-6 flex items-center gap-3 z-20">
                    <Link
                        to="/kb/create"
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-slate-900 rounded-xl font-bold hover:bg-primary/90 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        New Article
                    </Link>
                    <Link
                        to="/kb/manage"
                        className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md text-white rounded-xl font-medium hover:bg-white/20 transition-colors border border-white/10"
                    >
                        <Settings className="w-4 h-4" />
                        Manage
                    </Link>
                </div>

                <div className="relative z-10">
                    <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-6 border border-white/10">
                        <BookOpen className="w-8 h-8 text-primary" />
                    </div>
                    <h1 className="text-4xl font-bold text-white mb-4 tracking-tight">
                        How can we help you?
                    </h1>
                    <p className="text-slate-400 max-w-2xl mx-auto mb-8 text-lg">
                        Search our knowledge base for answers to common questions and issues.
                    </p>

                    <form onSubmit={handleSearch} className="max-w-xl mx-auto relative">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="Search for articles (e.g. 'printer', 'vpn')..."
                            className="w-full pl-14 pr-32 py-5 bg-white rounded-2xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-primary/30 shadow-lg transition-all"
                        />
                        {isLoading && debouncedSearch && (
                            <div className="absolute right-24 top-1/2 -translate-y-1/2">
                                <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                            </div>
                        )}
                        <button
                            type="submit"
                            className="absolute right-2 top-1/2 -translate-y-1/2 bg-primary text-slate-900 font-bold px-6 py-3 rounded-xl hover:bg-primary/90 transition-colors"
                        >
                            Search
                        </button>
                    </form>
                </div>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
                <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
                {CATEGORIES.map((category) => (
                    <button
                        key={category}
                        onClick={() => setSelectedCategory(category)}
                        className={cn(
                            "px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all",
                            selectedCategory === category
                                ? "bg-primary text-slate-900"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                        )}
                    >
                        {category}
                        {categoryCounts[category] !== undefined && (
                            <span className="ml-2 text-xs opacity-70">({categoryCounts[category] || 0})</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Articles Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                        <BookOpen className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                        <p className="text-slate-500 dark:text-slate-400 text-lg">
                            {searchInput ? `No articles found for "${searchInput}"` : 'No articles found.'}
                        </p>
                        <p className="text-slate-400 dark:text-slate-500 text-sm mt-2">
                            Try adjusting your search or filter criteria.
                        </p>
                    </div>
                ) : (
                    articles.map((article) => (
                        <Link key={article.id} to={`/kb/articles/${article.id}`}>
                            <div className="h-full bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 hover:shadow-lg hover:border-primary/30 hover:-translate-y-1 transition-all duration-300 group cursor-pointer overflow-hidden">
                                {/* Featured Image */}
                                {article.featuredImage ? (
                                    <div className="h-40 overflow-hidden">
                                        <img
                                            src={article.featuredImage}
                                            alt={article.title}
                                            loading="lazy"
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        />
                                    </div>
                                ) : (
                                    <div className="h-40 bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center">
                                        <ImageIcon className="w-12 h-12 text-slate-300 dark:text-slate-600" />
                                    </div>
                                )}
                                <div className="p-6">
                                    <div className="flex justify-between items-start mb-3">
                                        <span className="px-3 py-1 rounded-lg bg-slate-50 dark:bg-slate-900 text-xs font-bold text-slate-500 dark:text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                            {article.category}
                                        </span>
                                        {article.viewCount > 0 && (
                                            <span className="flex items-center text-xs text-slate-400 dark:text-slate-500">
                                                <Eye className="w-3 h-3 mr-1" />
                                                {article.viewCount}
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                                        {article.title}
                                    </h3>
                                    <p className="text-slate-500 dark:text-slate-400 line-clamp-2 text-sm mb-4 leading-relaxed">
                                        {article.content.replace(/<[^>]*>/g, '')}
                                    </p>
                                    <div className="flex items-center text-primary font-bold text-sm opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                                        Read Article <ChevronRight className="w-4 h-4 ml-1" />
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))
                )}
            </div>

            {/* Results count */}
            {!isLoading && articles.length > 0 && (
                <p className="text-center text-sm text-slate-500 dark:text-slate-400">
                    Showing {articles.length} article{articles.length !== 1 ? 's' : ''}
                    {searchInput && ` for "${searchInput}"`}
                    {selectedCategory !== 'All' && ` in ${selectedCategory}`}
                </p>
            )}
        </div>
    );
};

export default BentoKnowledgeBasePage;
