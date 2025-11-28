import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Calendar, Tag, Share2, ThumbsUp, Edit, Eye, User } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';

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

export const BentoArticleDetailPage = () => {
    const { id } = useParams<{ id: string }>();
    const [article, setArticle] = useState<Article | null>(null);
    const [loading, setLoading] = useState(true);
    const [isHelpfulClicked, setIsHelpfulClicked] = useState(false);

    useEffect(() => {
        const fetchArticle = async () => {
            try {
                const response = await api.get(`/kb/articles/${id}`);
                setArticle(response.data);
            } catch (error) {
                console.error('Failed to fetch article:', error);
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            fetchArticle();
        }
    }, [id]);

    const handleHelpful = async () => {
        if (isHelpfulClicked) return;
        try {
            const response = await api.post(`/kb/articles/${id}/helpful`);
            setArticle(response.data);
            setIsHelpfulClicked(true);
            toast.success('Thanks for your feedback!');
        } catch (error) {
            console.error('Failed to mark as helpful:', error);
        }
    };

    const handleShare = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            toast.success('Link copied to clipboard!');
        } catch (error) {
            toast.error('Failed to copy link');
        }
    };

    if (loading) {
        return <div className="p-12 text-center text-slate-400 dark:text-slate-500">Loading article...</div>;
    }

    if (!article) {
        return <div className="p-12 text-center text-slate-400 dark:text-slate-500">Article not found.</div>;
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <Link to="/kb" className="inline-flex items-center text-slate-500 dark:text-slate-400 hover:text-primary transition-colors font-medium">
                    <ArrowLeft className="w-5 h-5 mr-2" />
                    Back to Knowledge Base
                </Link>
                <Link
                    to={`/kb/articles/${id}/edit`}
                    className="inline-flex items-center gap-2 px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl font-medium transition-colors"
                >
                    <Edit className="w-4 h-4" />
                    Edit Article
                </Link>
            </div>

            <article className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 md:p-12 shadow-sm border border-slate-100 dark:border-slate-700">
                <div className="flex flex-wrap items-center gap-3 mb-6">
                    <span className="px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-bold border border-primary/20">
                        {article.category}
                    </span>
                    {article.status !== 'published' && (
                        <span className="px-3 py-1 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs font-bold uppercase">
                            {article.status}
                        </span>
                    )}
                    {article.visibility === 'internal' && (
                        <span className="px-3 py-1 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs font-bold uppercase">
                            Internal
                        </span>
                    )}
                    <span className="flex items-center text-slate-400 dark:text-slate-500 text-sm font-medium">
                        <Calendar className="w-4 h-4 mr-1.5" />
                        {formatDate(article.updatedAt)}
                    </span>
                    <span className="flex items-center text-slate-400 dark:text-slate-500 text-sm font-medium">
                        <Eye className="w-4 h-4 mr-1.5" />
                        {article.viewCount} views
                    </span>
                </div>

                <h1 className="text-3xl md:text-4xl font-bold text-slate-800 dark:text-white mb-4 leading-tight">
                    {article.title}
                </h1>

                {article.authorName && (
                    <div className="flex items-center text-slate-500 dark:text-slate-400 text-sm mb-8">
                        <User className="w-4 h-4 mr-1.5" />
                        Written by {article.authorName}
                    </div>
                )}

                {article.featuredImage && (
                    <div className="mb-8">
                        <img
                            src={article.featuredImage}
                            alt={article.title}
                            className="w-full h-64 md:h-80 object-cover rounded-2xl"
                        />
                    </div>
                )}

                <div className="prose prose-lg prose-slate dark:prose-invert max-w-none">
                    <div className="whitespace-pre-wrap text-slate-600 dark:text-slate-300 leading-relaxed">
                        {article.content.split(/!\[([^\]]*)\]\(([^)]+)\)/).map((part, index) => {
                            // Every 3rd element starting from index 2 is the URL
                            if (index % 3 === 2) {
                                const altText = article.content.split(/!\[([^\]]*)\]\(([^)]+)\)/)[index - 1];
                                return (
                                    <img
                                        key={index}
                                        src={part}
                                        alt={altText || 'Article image'}
                                        className="my-4 rounded-xl max-w-full"
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

                {article.tags && article.tags.length > 0 && (
                    <div className="mt-12 pt-8 border-t border-slate-100 dark:border-slate-700">
                        <div className="flex flex-wrap gap-2">
                            {article.tags.map((tag) => (
                                <span key={tag} className="flex items-center px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-sm font-medium border border-slate-100 dark:border-slate-700">
                                    <Tag className="w-3 h-3 mr-1.5" />
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                <div className="mt-8 flex items-center justify-between pt-8 border-t border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-4">
                        <span className="text-slate-400 dark:text-slate-500 text-sm font-medium">
                            Was this article helpful?
                        </span>
                        {article.helpfulCount > 0 && (
                            <span className="text-xs text-slate-400 dark:text-slate-500">
                                {article.helpfulCount} found this helpful
                            </span>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={handleHelpful}
                            disabled={isHelpfulClicked}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${
                                isHelpfulClicked
                                    ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                                    : 'hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-400 hover:text-primary'
                            }`}
                        >
                            <ThumbsUp className="w-5 h-5" />
                            {isHelpfulClicked ? 'Thanks!' : 'Helpful'}
                        </button>
                        <button
                            onClick={handleShare}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-400 hover:text-primary transition-colors"
                        >
                            <Share2 className="w-5 h-5" />
                            Share
                        </button>
                    </div>
                </div>
            </article>
        </div>
    );
};
