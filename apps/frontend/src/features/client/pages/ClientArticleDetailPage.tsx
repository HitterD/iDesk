import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, Clock, Eye, Tag, ThumbsUp, ThumbsDown, BookOpen, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { ErrorState } from '@/components/ui/ErrorState';

interface Article {
    id: string;
    title: string;
    content: string;
    category: string;
    tags?: string[];
    viewCount: number;
    createdAt: string;
    updatedAt: string;
    author?: { fullName: string };
    featuredImage?: string;
    images?: string[];
}

/**
 * Resolve image URL - handles both relative and absolute URLs
 */
const getImageUrl = (url: string): string => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
        return url;
    }
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5050';
    return `${apiUrl}${url.startsWith('/') ? '' : '/'}${url}`;
};

export const ClientArticleDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [feedback, setFeedback] = useState<'helpful' | 'not-helpful' | null>(null);

    const { data: article, isLoading, isError, refetch } = useQuery<Article>({
        queryKey: ['kb-article', id],
        queryFn: async () => {
            const res = await api.get(`/kb/articles/${id}`);
            return res.data;
        },
        enabled: !!id,
        retry: 2,
        retryDelay: 1000,
    });

    // Feedback mutation
    const feedbackMutation = useMutation({
        mutationFn: async (isHelpful: boolean) => {
            return api.post(`/kb/articles/${id}/feedback`, { isHelpful });
        },
        onSuccess: (_, isHelpful) => {
            setFeedback(isHelpful ? 'helpful' : 'not-helpful');
            toast.success('Terima kasih atas feedback Anda!');
        },
        onError: () => {
            toast.error('Gagal mengirim feedback. Silakan coba lagi.');
        },
    });

    // Track view
    useEffect(() => {
        if (id) {
            api.post(`/kb/articles/${id}/view`).catch(() => { });
        }
    }, [id]);

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
        });
    };

    if (isLoading) {
        return (
            <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
                <div className="h-6 w-40 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-8 md:p-12 shadow-sm border border-slate-100 dark:border-slate-700">
                    <div className="flex gap-3 mb-6">
                        <div className="h-8 w-24 bg-slate-200 dark:bg-slate-700 rounded-full" />
                        <div className="h-6 w-32 bg-slate-100 dark:bg-slate-800 rounded" />
                        <div className="h-6 w-24 bg-slate-100 dark:bg-slate-800 rounded" />
                    </div>
                    <div className="h-10 w-3/4 bg-slate-200 dark:bg-slate-700 rounded mb-6" />
                    <div className="h-48 w-full bg-slate-200 dark:bg-slate-700 rounded-2xl mb-8" />
                    <div className="space-y-4">
                        <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 rounded" />
                        <div className="h-4 w-5/6 bg-slate-100 dark:bg-slate-800 rounded" />
                        <div className="h-4 w-4/5 bg-slate-100 dark:bg-slate-800 rounded" />
                        <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 rounded" />
                    </div>
                </div>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="max-w-4xl mx-auto">
                <ErrorState
                    title="Gagal Memuat Artikel"
                    message="Terjadi kesalahan saat memuat artikel. Silakan coba lagi."
                    onRetry={() => refetch()}
                />
            </div>
        );
    }



    if (!article) {
        return (
            <div className="text-center py-12">
                <BookOpen className="w-16 h-16 text-slate-200 dark:text-slate-600 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Article not found</h2>
                <Link to="/client/kb" className="text-primary hover:underline">Back to Help Center</Link>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Back Button */}
            <button
                onClick={() => navigate('/client/kb')}
                className="inline-flex items-center gap-2 text-slate-500 hover:text-primary transition-colors font-medium"
            >
                <ArrowLeft className="w-5 h-5" />
                Back to Help Center
            </button>

            {/* Article Card */}
            <article className="bg-white dark:bg-slate-800 rounded-[2rem] p-8 md:p-12 shadow-sm border border-slate-100 dark:border-slate-700">
                {/* Meta */}
                <div className="flex flex-wrap items-center gap-3 mb-6">
                    <span className="px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-bold border border-primary/20 flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        {article.category}
                    </span>
                    <span className="flex items-center text-slate-400 dark:text-slate-500 text-sm font-medium">
                        <Clock className="w-4 h-4 mr-1.5" />
                        {formatDate(article.updatedAt)}
                    </span>
                    <span className="flex items-center text-slate-400 dark:text-slate-500 text-sm font-medium">
                        <Eye className="w-4 h-4 mr-1.5" />
                        {article.viewCount} views
                    </span>
                </div>

                {/* Title */}
                <h1 className="text-3xl md:text-4xl font-bold text-slate-800 dark:text-white mb-6 leading-tight">
                    {article.title}
                </h1>

                {/* Featured Image */}
                {article.featuredImage && (
                    <div className="mb-6">
                        <img
                            src={getImageUrl(article.featuredImage)}
                            alt={article.title}
                            className="w-full max-h-96 object-cover rounded-2xl"
                            onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                            }}
                        />
                    </div>
                )}

                {/* Images Gallery */}
                {article.images && article.images.length > 0 && (
                    <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {article.images.map((imageUrl, index) => (
                            <img
                                key={index}
                                src={getImageUrl(imageUrl)}
                                alt={`Article image ${index + 1}`}
                                className="w-full h-48 object-cover rounded-xl cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() => window.open(getImageUrl(imageUrl), '_blank')}
                                onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                }}
                            />
                        ))}
                    </div>
                )}

                {/* Content */}
                <div className="prose prose-lg prose-slate dark:prose-invert max-w-none">
                    <div className="whitespace-pre-wrap text-slate-600 dark:text-slate-300 leading-relaxed text-base">
                        {article.content.split(/!\[([^\]]*)\]\(([^)]+)\)/).map((part, index) => {
                            // Every 3rd element starting from index 2 is the URL
                            if (index % 3 === 2) {
                                const altText = article.content.split(/!\[([^\]]*)\]\(([^)]+)\)/)[index - 1];
                                return (
                                    <img
                                        key={index}
                                        src={getImageUrl(part)}
                                        alt={altText || 'Article image'}
                                        className="my-4 rounded-xl max-w-full"
                                        onError={(e) => {
                                            const target = e.target as HTMLImageElement;
                                            target.style.display = 'none';
                                        }}
                                    />
                                );
                            }
                            // Skip alt text parts (index % 3 === 1)
                            if (index % 3 === 1) return null;
                            // Render text parts
                            return part;
                        })}
                    </div>
                </div>

                {/* Tags */}
                {article.tags && article.tags.length > 0 && (
                    <div className="mt-12 pt-8 border-t border-slate-100 dark:border-slate-700">
                        <div className="flex flex-wrap gap-2">
                            {article.tags.map((tag, i) => (
                                <span
                                    key={i}
                                    className="flex items-center px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-sm font-medium border border-slate-100 dark:border-slate-700"
                                >
                                    <Tag className="w-3 h-3 mr-1.5" />
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Feedback */}
                <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <span className="text-slate-400 dark:text-slate-500 text-sm font-medium">
                        Was this article helpful?
                    </span>
                    <div className="flex gap-3" role="group" aria-label="Article feedback">
                        <button
                            onClick={() => feedbackMutation.mutate(true)}
                            disabled={feedback !== null || feedbackMutation.isPending}
                            aria-pressed={feedback === 'helpful'}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${feedback === 'helpful'
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 font-medium'
                                    : feedback !== null
                                        ? 'opacity-50 cursor-not-allowed text-slate-300 dark:text-slate-600'
                                        : 'hover:bg-green-50 dark:hover:bg-green-900/20 text-slate-400 hover:text-green-600'
                                }`}
                        >
                            {feedbackMutation.isPending && feedbackMutation.variables === true ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <ThumbsUp className="w-5 h-5" />
                            )}
                            Helpful
                        </button>
                        <button
                            onClick={() => feedbackMutation.mutate(false)}
                            disabled={feedback !== null || feedbackMutation.isPending}
                            aria-pressed={feedback === 'not-helpful'}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${feedback === 'not-helpful'
                                    ? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium'
                                    : feedback !== null
                                        ? 'opacity-50 cursor-not-allowed text-slate-300 dark:text-slate-600'
                                        : 'hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                                }`}
                        >
                            {feedbackMutation.isPending && feedbackMutation.variables === false ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <ThumbsDown className="w-5 h-5" />
                            )}
                            Not helpful
                        </button>
                    </div>
                </div>
            </article>


            {/* Still need help? */}
            <div className="bg-gradient-to-br from-primary/20 to-primary/5 dark:from-primary/10 dark:to-transparent rounded-2xl border border-primary/20 p-6 text-center">
                <h3 className="font-bold text-slate-800 dark:text-white mb-2">Still have questions?</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                    Our support team is here to help you
                </p>
                <Link
                    to="/client/create"
                    className="inline-flex items-center gap-2 bg-primary text-slate-900 px-6 py-3 rounded-xl font-bold hover:bg-primary/90 transition-colors"
                >
                    Contact Support
                </Link>
            </div>
        </div>
    );
};
