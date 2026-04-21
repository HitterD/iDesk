import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Plus,
    Search,
    Edit,
    Trash2,
    Eye,
    MoreVertical,
    FileText,
    Archive,
    Send,
    RotateCcw,
    Filter,
    BarChart3,
    ImageIcon,
    Loader2,
    ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ConfirmDialog } from '@/features/admin/components/ConfirmDialog';

interface Article {
    id: string;
    title: string;
    content: string;
    category: string;
    tags: string[];
    status: 'draft' | 'published' | 'archived';
    visibility: 'public' | 'internal' | 'private';
    viewCount: number;
    helpfulCount: number;
    authorName: string;
    featuredImage?: string;
    createdAt: string;
    updatedAt: string;
}

interface Stats {
    totalArticles: number;
    totalViews: number;
    totalHelpful: number;
    byStatus: {
        draft: number;
        published: number;
        archived: number;
    };
}

const STATUS_STYLES = {
    draft: 'bg-warning/10 text-warning',
    published: 'bg-success/10 text-success',
    archived: 'bg-muted text-muted-foreground',
};

export const BentoManageArticlesPage = () => {
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchTerm, setSearchTerm] = useState(''); // Debounced search
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [categoryFilter, setCategoryFilter] = useState<string>('');
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [articleToDelete, setArticleToDelete] = useState<string | null>(null);

    // Fetch articles with TanStack Query
    const { data: articles = [], isLoading: articlesLoading } = useQuery<Article[]>({
        queryKey: ['kb-articles', searchTerm, statusFilter, categoryFilter],
        queryFn: async () => {
            const params: Record<string, string> = { all: 'true' };
            if (searchTerm) params.q = searchTerm;
            if (statusFilter) params.status = statusFilter;
            if (categoryFilter) params.category = categoryFilter;
            const res = await api.get('/kb/articles', { params });
            return res.data;
        },
        staleTime: 30000, // Cache for 30 seconds
    });

    // Fetch stats with TanStack Query
    const { data: stats } = useQuery<Stats>({
        queryKey: ['kb-stats'],
        queryFn: async () => {
            const res = await api.get('/kb/stats');
            return res.data;
        },
        staleTime: 60000, // Cache for 1 minute
    });

    // Fetch categories with TanStack Query
    const { data: categories = [] } = useQuery<string[]>({
        queryKey: ['kb-categories'],
        queryFn: async () => {
            const res = await api.get('/kb/categories');
            return res.data;
        },
        staleTime: 300000, // Cache for 5 minutes
    });

    // Update status mutation
    const updateStatusMutation = useMutation({
        mutationFn: async ({ id, status }: { id: string; status: string }) => {
            await api.patch(`/kb/articles/${id}/status`, { status });
            return status;
        },
        onSuccess: (status) => {
            toast.success(`Article ${status === 'published' ? 'published' : status === 'archived' ? 'archived' : 'saved as draft'}`);
            queryClient.invalidateQueries({ queryKey: ['kb-articles'] });
            queryClient.invalidateQueries({ queryKey: ['kb-stats'] });
            setOpenDropdown(null);
        },
        onError: () => {
            toast.error('Failed to update status');
        },
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/kb/articles/${id}`);
        },
        onSuccess: () => {
            toast.success('Article deleted');
            queryClient.invalidateQueries({ queryKey: ['kb-articles'] });
            queryClient.invalidateQueries({ queryKey: ['kb-stats'] });
            setDeleteConfirmOpen(false);
            setArticleToDelete(null);
            setOpenDropdown(null);
        },
        onError: () => {
            toast.error('Failed to delete article');
        },
    });

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setSearchTerm(searchQuery); // Trigger query refetch
    };

    const handleUpdateStatus = (id: string, status: string) => {
        updateStatusMutation.mutate({ id, status });
    };

    const handleDeleteClick = (id: string) => {
        setArticleToDelete(id);
        setDeleteConfirmOpen(true);
        setOpenDropdown(null);
    };

    const handleDeleteConfirm = () => {
        if (articleToDelete) {
            deleteMutation.mutate(articleToDelete);
        }
    };

    return (
        <div className="space-y-6">
            <Link
                to="/kb"
                className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors font-medium text-sm mb-2"
            >
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Back to Knowledge Base
            </Link>

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">
                        Manage Articles
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Create, edit, and manage knowledge base articles
                    </p>
                </div>
                <Link
                    to="/kb/create"
                    className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-[var(--radius-md)] text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    New Article
                </Link>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="glass-card p-5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-[var(--radius-md)] bg-info/10 flex items-center justify-center shrink-0">
                                <FileText className="w-5 h-5 text-info" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-foreground font-mono">
                                    {stats.totalArticles}
                                </p>
                                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Articles</p>
                            </div>
                        </div>
                    </div>
                    <div className="glass-card p-5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-[var(--radius-md)] bg-success/10 flex items-center justify-center shrink-0">
                                <Send className="w-5 h-5 text-success" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-foreground font-mono">
                                    {stats.byStatus.published}
                                </p>
                                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Published</p>
                            </div>
                        </div>
                    </div>
                    <div className="glass-card p-5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-[var(--radius-md)] bg-primary/10 flex items-center justify-center shrink-0">
                                <Eye className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-foreground font-mono">
                                    {stats.totalViews}
                                </p>
                                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Views</p>
                            </div>
                        </div>
                    </div>
                    <div className="glass-card p-5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-[var(--radius-md)] bg-warning/10 flex items-center justify-center shrink-0">
                                <BarChart3 className="w-5 h-5 text-warning" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-foreground font-mono">
                                    {stats.byStatus.draft}
                                </p>
                                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Drafts</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Filters & Search */}
            <div className="glass-card p-4">
                <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-4">
                    <div className="flex-1 min-w-[200px] relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search articles..."
                            className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-[var(--radius-md)] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors"
                        />
                    </div>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3 py-2 bg-background border border-border rounded-[var(--radius-md)] text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors"
                    >
                        <option value="">All Status</option>
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                        <option value="archived">Archived</option>
                    </select>
                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="px-3 py-2 bg-background border border-border rounded-[var(--radius-md)] text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors"
                    >
                        <option value="">All Categories</option>
                        {categories.map((cat) => (
                            <option key={cat} value={cat}>
                                {cat}
                            </option>
                        ))}
                    </select>
                    <button
                        type="submit"
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-[var(--radius-md)] text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
                    >
                        <Filter className="w-4 h-4" />
                    </button>
                </form>
            </div>

            {/* Articles Table */}
            <div className="glass-card overflow-hidden">
                {articlesLoading ? (
                    <div className="p-12 text-center text-muted-foreground flex items-center justify-center gap-3">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Loading articles...
                    </div>
                ) : articles.length === 0 ? (
                    <div className="p-12 text-center">
                        <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="text-muted-foreground font-medium mb-4">No articles found</p>
                        <Link
                            to="/kb/create"
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-[var(--radius-md)] text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
                        >
                            <Plus className="w-4 h-4" />
                            Create First Article
                        </Link>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-muted/30 border-b border-border">
                                <tr>
                                    <th className="text-left px-5 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider w-16">
                                        Image
                                    </th>
                                    <th className="text-left px-5 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                        Title & Author
                                    </th>
                                    <th className="text-left px-5 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                        Category
                                    </th>
                                    <th className="text-left px-5 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="text-left px-5 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                        Last Updated
                                    </th>
                                    <th className="text-left px-5 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                        Views
                                    </th>
                                    <th className="text-right px-5 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {articles.map((article) => (
                                    <tr
                                        key={article.id}
                                        className="hover:bg-muted/30 transition-colors"
                                    >
                                        <td className="px-5 py-4">
                                            {article.featuredImage ? (
                                                <img
                                                    src={article.featuredImage}
                                                    alt={article.title}
                                                    className="w-10 h-10 rounded-[var(--radius-md)] object-cover border border-border"
                                                />
                                            ) : (
                                                <div className="w-10 h-10 rounded-[var(--radius-md)] bg-muted/50 flex items-center justify-center border border-border">
                                                    <ImageIcon className="w-4 h-4 text-muted-foreground" />
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-5 py-4">
                                            <Link
                                                to={`/kb/articles/${article.id}`}
                                                className="font-semibold text-foreground hover:text-primary transition-colors line-clamp-1"
                                            >
                                                {article.title}
                                            </Link>
                                            {article.authorName && (
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    by {article.authorName}
                                                </p>
                                            )}
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className="px-2.5 py-1 rounded-[var(--radius-sm)] bg-muted text-muted-foreground text-xs font-medium">
                                                {article.category}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span
                                                className={`px-2.5 py-1 rounded-[var(--radius-sm)] text-xs font-semibold capitalize ${STATUS_STYLES[article.status]}`}
                                            >
                                                {article.status}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 text-sm text-muted-foreground">
                                            {new Date(article.updatedAt || article.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="px-5 py-4 text-sm text-muted-foreground">
                                            {article.viewCount || 0}
                                        </td>
                                        <td className="px-5 py-4 text-right relative">
                                            <button
                                                onClick={() =>
                                                    setOpenDropdown(
                                                        openDropdown === article.id ? null : article.id
                                                    )
                                                }
                                                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-[var(--radius-md)] transition-colors"
                                            >
                                                <MoreVertical className="w-4 h-4" />
                                            </button>
                                            
                                            {/* Dropdown Menu (Inline) */}
                                            {openDropdown === article.id && (
                                                <>
                                                    <div 
                                                        className="fixed inset-0 z-40" 
                                                        onClick={() => setOpenDropdown(null)} 
                                                    />
                                                    <div className="absolute right-8 top-10 w-48 glass-card border-border shadow-md py-1 z-50 rounded-[var(--radius-md)] text-left">
                                                        <Link
                                                            to={`/kb/articles/${article.id}`}
                                                            className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted text-xs font-medium text-foreground transition-colors w-full"
                                                        >
                                                            <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                                                            View Article
                                                        </Link>
                                                        <Link
                                                            to={`/kb/articles/${article.id}/edit`}
                                                            className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted text-xs font-medium text-foreground transition-colors w-full"
                                                        >
                                                            <Edit className="w-3.5 h-3.5 text-muted-foreground" />
                                                            Edit Article
                                                        </Link>
                                                        
                                                        {article.status !== 'published' && (
                                                            <button
                                                                onClick={() => {
                                                                    handleUpdateStatus(article.id, 'published');
                                                                    setOpenDropdown(null);
                                                                }}
                                                                className="flex items-center gap-2 px-3 py-1.5 hover:bg-success/10 text-xs font-medium text-success transition-colors w-full text-left"
                                                            >
                                                                <Send className="w-3.5 h-3.5" />
                                                                Publish Article
                                                            </button>
                                                        )}

                                                        {article.status !== 'draft' && (
                                                            <button
                                                                onClick={() => {
                                                                    handleUpdateStatus(article.id, 'draft');
                                                                    setOpenDropdown(null);
                                                                }}
                                                                className="flex items-center gap-2 px-3 py-1.5 hover:bg-amber-50 text-xs font-medium text-amber-600 transition-colors w-full text-left"
                                                            >
                                                                <RotateCcw className="w-3.5 h-3.5" />
                                                                Unpublish
                                                            </button>
                                                        )}

                                                        {article.status !== 'archived' && (
                                                            <button
                                                                onClick={() => {
                                                                    handleUpdateStatus(article.id, 'archived');
                                                                    setOpenDropdown(null);
                                                                }}
                                                                className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted text-xs font-medium text-muted-foreground transition-colors w-full text-left"
                                                            >
                                                                <Archive className="w-3.5 h-3.5" />
                                                                Archive Article
                                                            </button>
                                                        )}

                                                        <div className="h-px bg-border my-1 mx-2" />

                                                        <button
                                                            onClick={() => {
                                                                handleDeleteClick(article.id);
                                                            }}
                                                            className="flex items-center gap-2 px-3 py-1.5 hover:bg-destructive/10 text-xs font-medium text-destructive transition-colors w-full text-left"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                            Delete Article
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Delete Confirmation Dialog */}
            <ConfirmDialog
                isOpen={deleteConfirmOpen}
                onClose={() => {
                    setDeleteConfirmOpen(false);
                    setArticleToDelete(null);
                }}
                onConfirm={handleDeleteConfirm}
                title="Delete Article"
                message="Are you sure you want to delete this article? This action cannot be undone."
                confirmText="Delete"
                variant="danger"
                isLoading={deleteMutation.isPending}
            />
        </div>
    );
};
