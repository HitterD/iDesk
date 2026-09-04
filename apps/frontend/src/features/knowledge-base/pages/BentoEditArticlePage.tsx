import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useAuth } from '@/stores/useAuth';
import { ArticleForm, ArticleFormData } from '../components/ArticleForm';

export const BentoEditArticlePage = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
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
                    featuredImage: response.data.featuredImage || '',
                    images: response.data.images || [],
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
        <div className="space-y-6 pb-12">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <Link
                        to={`/kb/articles/${id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-border text-foreground hover:bg-muted font-semibold text-xs transition-all shadow-2xs group cursor-pointer"
                    >
                        <ArrowLeft className="w-3.5 h-3.5 text-muted-foreground group-hover:-translate-x-0.5 group-hover:text-foreground transition-all" />
                        <span>Kembali ke Detail Artikel</span>
                    </Link>
                    <Link
                        to="/kb"
                        className="text-xs text-muted-foreground hover:text-foreground font-medium hidden sm:inline"
                    >
                        / Knowledge Base
                    </Link>
                </div>

                <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-destructive hover:bg-destructive/10 rounded-lg text-xs font-semibold transition-colors cursor-pointer border border-transparent hover:border-destructive/20"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Artikel</span>
                </button>
            </div>

            <ArticleForm
                initialData={initialData}
                onSubmit={handleSubmit}
                onCancel={() => navigate(`/kb/articles/${id}`)}
                isLoading={isLoading}
                mode="edit"
                isAdmin={user?.role === 'ADMIN'}
            />

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                    <div className="bg-card rounded-2xl p-6 max-w-md w-full border border-border shadow-lg space-y-4">
                        <h3 className="text-base font-bold text-foreground">
                            Hapus Artikel Ini?
                        </h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            Apakah Anda yakin ingin menghapus artikel ini dari Knowledge Base? Tindakan ini dapat dibatalkan melalui log admin jika diperlukan.
                        </p>
                        <div className="flex items-center justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowDeleteConfirm(false)}
                                className="px-3.5 py-1.5 text-muted-foreground hover:text-foreground text-xs font-semibold rounded-lg hover:bg-muted transition-colors cursor-pointer"
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={handleDelete}
                                disabled={isLoading}
                                className="px-4 py-1.5 bg-destructive text-destructive-foreground rounded-lg text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
                            >
                                {isLoading ? 'Menghapus...' : 'Ya, Hapus'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
