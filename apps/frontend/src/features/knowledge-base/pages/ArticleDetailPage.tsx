import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Calendar, Tag } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';

interface Article {
    id: string;
    title: string;
    content: string;
    category: string;
    tags: string[];
    createdAt: string;
    updatedAt: string;
}

export const ArticleDetailPage = () => {
    const { id } = useParams<{ id: string }>();
    const [article, setArticle] = useState<Article | null>(null);
    const [loading, setLoading] = useState(true);

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

    if (loading) {
        return <div className="p-8 text-center text-slate-400">Loading article...</div>;
    }

    if (!article) {
        return <div className="p-8 text-center text-slate-400">Article not found.</div>;
    }

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <Link to="/kb">
                <Button variant="ghost" className="mb-6 text-slate-400 hover:text-white pl-0">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back to Knowledge Base
                </Button>
            </Link>

            <article className="bg-navy-light border border-white/10 rounded-2xl p-8 md:p-12">
                <div className="flex items-center gap-3 mb-6">
                    <span className="px-3 py-1 rounded-full bg-neon-green/10 text-neon-green text-sm font-medium border border-neon-green/20">
                        {article.category}
                    </span>
                    <span className="flex items-center text-slate-500 text-sm">
                        <Calendar className="w-4 h-4 mr-1" />
                        {formatDate(article.updatedAt)}
                    </span>
                </div>

                <h1 className="text-3xl md:text-4xl font-bold text-white mb-8 leading-tight">
                    {article.title}
                </h1>

                <div className="prose prose-invert max-w-none prose-headings:text-white prose-p:text-slate-300 prose-a:text-neon-green">
                    {/* Simple text rendering for now, could be Markdown or HTML later */}
                    <div className="whitespace-pre-wrap">{article.content}</div>
                </div>

                {article.tags && article.tags.length > 0 && (
                    <div className="mt-12 pt-8 border-t border-white/10">
                        <div className="flex flex-wrap gap-2">
                            {article.tags.map((tag) => (
                                <span key={tag} className="flex items-center px-3 py-1 rounded-md bg-white/5 text-slate-400 text-sm border border-white/5">
                                    <Tag className="w-3 h-3 mr-1.5" />
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </article>
        </div>
    );
};
