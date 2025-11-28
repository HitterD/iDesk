import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { ArticleForm, ArticleFormData } from '../components/ArticleForm';

export const BentoEditArticlePage = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(true);
    const [initialData, setInitialData] = useState<Partial<ArticleFormData> | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    useEffect(() => {
        const fetchArticle = async () => {
            try {
                const response = await api.get(`/kb/articles/${id}`);
                setInitialData({
                    title: response.data.title,
                    content: response.data.content,
                    category: response.data.category,
                    tags: response.data.tags || [],
                    status: response.data.status,
                    visibility: response.data.visibility,
                });
            } catch (error) {
                console.error('Failed to fetch article:', error);
                toast.error('Failed to load article');
                navigate('/kb');
            } finally {
                setIsFetching(false);
            }
        };

        if (id) {
            fetchArticle();
        }
    }, [id, navigate]);

    const handleSubmit = async (data: ArticleFormData) => {
        setIsLoading(true);
        try {
            await api.put(`/kb/articles/${id}`, data);
            toast.success('Article updated successfully!');
            navigate(`/kb/articles/${id}`);
        } catch (error: any) {
            console.error('Failed to update article:', error);
            toast.error(error.response?.data?.message || 'Failed to update article');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        setIsLoading(true);
        try {
            await api.delete(`/kb/articles/${id}`);
            toast.success('Article deleted successfully!');
            navigate('/kb');
        } catch (error: any) {
            console.error('Failed to delete article:', error);
            toast.error(error.response?.data?.message || 'Failed to delete article');
        } finally {
            setIsLoading(false);
            setShowDeleteConfirm(false);
        }
    };

    if (isFetching) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-slate-400 dark:text-slate-500">Loading article...</div>
            </div>
        );
    }

    if (!initialData) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-slate-400 dark:text-slate-500">Article not found</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <Link
                    to={`/kb/articles/${id}`}
                    className="inline-flex items-center text-slate-500 dark:text-slate-400 hover:text-primary transition-colors font-medium"
                >
                    <ArrowLeft className="w-5 h-5 mr-2" />
                    Back to Article
                </Link>

                <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl font-medium transition-colors"
                >
                    <Trash2 className="w-4 h-4" />
                    Delete Article
                </button>
            </div>

            <ArticleForm
                initialData={initialData}
                onSubmit={handleSubmit}
                onCancel={() => navigate(`/kb/articles/${id}`)}
                isLoading={isLoading}
                mode="edit"
            />

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-8 max-w-md w-full mx-4 shadow-2xl">
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-4">
                            Delete Article?
                        </h3>
                        <p className="text-slate-500 dark:text-slate-400 mb-6">
                            Are you sure you want to delete this article? This action can be undone by an administrator.
                        </p>
                        <div className="flex items-center justify-end gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="px-6 py-3 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={isLoading}
                                className="px-6 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
                            >
                                {isLoading ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
