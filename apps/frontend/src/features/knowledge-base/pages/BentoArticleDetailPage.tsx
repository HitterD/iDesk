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

/**
 * Resolve image URL - handles both relative and absolute URLs
 */
const getImageUrl = (url: string): string => {
    if (!url) return '';
    // Already a full URL
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
        return url;
    }
    // Relative path - prepend API URL
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5050';
    return `${apiUrl}${url.startsWith('/') ? '' : '/'}${url}`;
};

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
                <Link to="/kb" className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors font-medium text-sm">
                    <ArrowLeft className="w-4 h-4 mr-1.5" />
                    Back to Knowledge Base
                </Link>
                <Link
                    to={`/kb/articles/${id}/edit`}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-background border border-border text-foreground hover:bg-muted font-medium transition-colors rounded-[var(--radius-md)] text-sm shadow-sm"
                >
                    <Edit className="w-4 h-4" />
                    Edit Article
                </Link>
            </div>

            <article className="glass-card p-6 md:p-10 border-t-2 border-t-primary/20">
                <div className="flex flex-wrap items-center gap-3 mb-6">
                    <span className="px-2.5 py-1 rounded-[var(--radius-sm)] bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
                        {article.category}
                    </span>
                    {article.status !== 'published' && (
                        <span className="px-2.5 py-1 rounded-[var(--radius-sm)] bg-warning/10 text-warning text-xs font-bold uppercase tracking-wider">
                            {article.status}
                        </span>
                    )}
                    {article.visibility === 'internal' && (
                        <span className="px-2.5 py-1 rounded-[var(--radius-sm)] bg-info/10 text-info text-xs font-bold uppercase tracking-wider">
                            Internal
                        </span>
                    )}
                    <span className="flex items-center text-muted-foreground text-sm font-medium">
                        <Calendar className="w-4 h-4 mr-1.5" />
                        {formatDate(article.updatedAt)}
                    </span>
                    <span className="flex items-center text-muted-foreground text-sm font-medium">
                        <Eye className="w-4 h-4 mr-1.5" />
                        {article.viewCount} views
                    </span>
                </div>

                <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4 leading-tight tracking-tight">
                    {article.title}
                </h1>

                {article.authorName && (
                    <div className="flex items-center text-muted-foreground text-sm mb-8 font-medium">
                        <User className="w-4 h-4 mr-1.5" />
                        Written by {article.authorName}
                    </div>
                )}

                {article.featuredImage && (
                    <div className="mb-8">
                        <img
                            src={getImageUrl(article.featuredImage)}
                            alt={article.title}
                            className="w-full h-64 md:h-80 object-cover rounded-[var(--radius-lg)] border border-border shadow-sm"
                            onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                            }}
                        />
                    </div>
                )}

                {/* Images Gallery */}
                {article.images && article.images.length > 0 && (
                    <div className="mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {article.images.map((imageUrl, index) => (
                            <img
                                key={index}
                                src={getImageUrl(imageUrl)}
                                alt={`Article image ${index + 1}`}
                                className="w-full h-48 object-cover rounded-xl cursor-pointer hover:opacity-90 transition-opacity border border-slate-100 dark:border-slate-700"
                                onClick={() => window.open(getImageUrl(imageUrl), '_blank')}
                                onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                }}
                            />
                        ))}
                    </div>
                )}

                <div className="prose prose-lg prose-slate dark:prose-invert max-w-none prose-headings:text-foreground prose-a:text-primary prose-p:text-muted-foreground prose-strong:text-foreground">
                    <div className="whitespace-pre-wrap leading-relaxed">
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
                                            console.warn('Failed to load image:', part);
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

                {article.tags && article.tags.length > 0 && (
                    <div className="mt-12 pt-8 border-t border-border">
                        <div className="flex flex-wrap gap-2">
                            {article.tags.map((tag) => (
                                <span key={tag} className="flex items-center px-3 py-1.5 rounded-[var(--radius-md)] bg-muted/50 text-muted-foreground text-sm font-medium border border-border">
                                    <Tag className="w-3.5 h-3.5 mr-1.5" />
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                <div className="mt-8 flex items-center justify-between pt-8 border-t border-border">
                    <div className="flex flex-col gap-1">
                        <span className="text-foreground text-sm font-semibold">
                            Was this article helpful?
                        </span>
                        {article.helpfulCount > 0 && (
                            <span className="text-xs text-muted-foreground font-medium">
                                {article.helpfulCount} people found this helpful
                            </span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleHelpful}
                            disabled={isHelpfulClicked}
                            className={`flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] text-sm font-semibold transition-colors border ${isHelpfulClicked
                                ? 'bg-success/10 text-success border-success/20'
                                : 'bg-background text-foreground border-border hover:bg-muted'
                                }`}
                        >
                            <ThumbsUp className="w-4 h-4" />
                            {isHelpfulClicked ? 'Thanks!' : 'Helpful'}
                        </button>
                        <button
                            onClick={handleShare}
                            className="flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] text-sm font-semibold bg-background text-foreground border border-border hover:bg-muted transition-colors"
                        >
                            <Share2 className="w-4 h-4" />
                            Share
                        </button>
                    </div>
                </div>
            </article>
        </div>
    );
};
