import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, BookOpen, ChevronRight, Eye, ImageIcon, Ticket } from 'lucide-react';
import api from '@/lib/api';
import { logger } from '@/lib/logger';
import { useDebounce } from '@/hooks/useDebounce';
import { ArticleGridSkeleton } from '@/components/ui/skeletons';
import { ErrorState } from '@/components/ui/ErrorState';

interface Article {
    id: string;
    title: string;
    content: string;
    category: string;
    tags?: string[];
    viewCount: number;
    featuredImage?: string;
    createdAt: string;
    updatedAt: string;
}

export const ClientKnowledgeBasePage: React.FC = () => {
    const [query, setQuery] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);

    // Use React Query instead of useState+useEffect
    const { data: articles = [], isLoading, isError, refetch } = useQuery<Article[]>({
        queryKey: ['kb-articles', debouncedSearchTerm],
        queryFn: async () => {
            try {
                const params = debouncedSearchTerm ? { q: debouncedSearchTerm } : {};
                const response = await api.get('/kb/articles', { params });
                return response.data;
            } catch (error) {
                logger.error('Failed to fetch articles:', error);
                throw error;
            }
        },
        retry: 2,
        retryDelay: 1000,
    });

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setSearchTerm(query);
    };

    // Get unique categories - memoized
    const categories = useMemo(() => [...new Set(articles.map(a => a.category))], [articles]);

    // Popular articles - memoized
    const popularArticles = useMemo(() =>
        [...articles].sort((a, b) => b.viewCount - a.viewCount).slice(0, 5),
        [articles]
    );

    return (
        <div className="space-y-8">
            {/* Hero Section */}
            <div className="relative overflow-hidden rounded-[2rem] bg-slate-900 p-8 md:p-12 text-center shadow-xl">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-3xl animate-pulse" aria-hidden="true"></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000" aria-hidden="true"></div>

                <div className="relative z-10">
                    <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-6 border border-white/10">
                        <BookOpen className="w-8 h-8 text-primary" aria-hidden="true" />
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold text-white mb-4 tracking-tight">
                        How can we help you?
                    </h1>
                    <p className="text-slate-400 max-w-2xl mx-auto mb-8 text-lg">
                        Search our knowledge base for answers to common questions and issues.
                    </p>

                    <form onSubmit={handleSearch} className="max-w-xl mx-auto relative" role="search">
                        <label htmlFor="kb-search" className="sr-only">Search knowledge base articles</label>
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" aria-hidden="true" />
                        <input
                            id="kb-search"
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search for articles..."
                            aria-label="Search for articles"
                            className="w-full pl-14 pr-32 py-5 bg-white rounded-2xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-primary/30 shadow-lg transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out"
                        />
                        <button
                            type="submit"
                            className="absolute right-2 top-1/2 -translate-y-1/2 bg-primary text-slate-900 font-bold px-6 py-3 rounded-xl hover:bg-primary/90 transition-colors"
                        >
                            Search
                        </button>
                    </form>
                </div>
            </div>

            {/* Category Pills */}
            {categories.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Filter by category">
                    <button
                        onClick={() => setSearchTerm('')}
                        aria-pressed={searchTerm === ''}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${searchTerm === ''
                            ? 'bg-primary text-slate-900'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                            }`}
                    >
                        All Articles
                    </button>
                    {categories.map((category) => (
                        <button
                            key={category}
                            onClick={() => {
                                setQuery(category);
                                setSearchTerm(category);
                            }}
                            aria-pressed={searchTerm === category}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${searchTerm === category
                                ? 'bg-primary text-slate-900'
                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                                }`}
                        >
                            {category}
                        </button>
                    ))}
                </div>
            )}

            {/* Error State */}
            {isError && (
                <ErrorState
                    title="Gagal Memuat Artikel"
                    message="Terjadi kesalahan saat memuat artikel. Silakan coba lagi."
                    onRetry={() => refetch()}
                    compact
                />
            )}

            {/* Articles Grid */}
            {isLoading ? (
                <ArticleGridSkeleton items={6} />
            ) : articles.length === 0 && !isError ? (
                <div className="text-center py-12">
                    <BookOpen className="w-16 h-16 text-slate-200 dark:text-slate-600 mx-auto mb-4" aria-hidden="true" />
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">No articles found</h3>
                    <p className="text-slate-500 dark:text-slate-400 mb-6">
                        Try adjusting your search or browse all categories
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {articles.map((article) => (
                        <Link key={article.id} to={`/client/kb/articles/${article.id}`}>

                            <div className="h-full bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700 hover:shadow-lg hover:border-primary/30 hover:-translate-y-1 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out group cursor-pointer overflow-hidden">
                                {/* Featured Image */}
                                {article.featuredImage ? (
                                    <div className="h-40 overflow-hidden">
                                        <img
                                            src={article.featuredImage}
                                            alt={article.title}
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
                                        {article.content?.replace(/<[^>]*>/g, '').substring(0, 150)}...
                                    </p>
                                    <div className="flex items-center text-primary font-bold text-sm opacity-0 group-hover:opacity-100 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out translate-y-2 group-hover:translate-y-0">
                                        Read Article <ChevronRight className="w-4 h-4 ml-1" />
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            {/* Bottom Section */}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Popular Articles */}
                {popularArticles.length > 0 && (
                    <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-6">
                        <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2 text-lg">
                            📈 Most Popular Articles
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {popularArticles.map((article, i) => (
                                <Link
                                    key={article.id}
                                    to={`/client/kb/articles/${article.id}`}
                                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors group"
                                >
                                    <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                                        {i + 1}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-primary transition-colors line-clamp-1 block">
                                            {article.title}
                                        </span>
                                        <span className="text-xs text-slate-400 flex items-center gap-1">
                                            <Eye className="w-3 h-3" /> {article.viewCount} views
                                        </span>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-primary" />
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                {/* Still need help? */}
                <div className="bg-gradient-to-br from-primary/20 to-primary/5 dark:from-primary/10 dark:to-transparent rounded-2xl border border-primary/20 p-6 flex flex-col justify-center">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                        <Ticket className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-bold text-slate-800 dark:text-white mb-2 text-lg">Still need help?</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                        Can't find what you're looking for? Create a support ticket and our team will assist you.
                    </p>
                    <Link
                        to="/client/create"
                        className="inline-flex items-center justify-center gap-2 bg-primary text-slate-900 px-6 py-3 rounded-xl font-bold hover:bg-primary/90 transition-colors"
                    >
                        Create Support Ticket
                    </Link>
                </div>
            </div>
        </div>
    );
};
