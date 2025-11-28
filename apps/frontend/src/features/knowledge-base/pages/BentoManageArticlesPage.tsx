import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';

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
    draft: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    published: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    archived: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400',
};

export const BentoManageArticlesPage = () => {
    const [articles, setArticles] = useState<Article[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [categoryFilter, setCategoryFilter] = useState<string>('');
    const [categories, setCategories] = useState<string[]>([]);
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const params: Record<string, string> = { all: 'true' };
            if (searchQuery) params.q = searchQuery;
            if (statusFilter) params.status = statusFilter;
            if (categoryFilter) params.category = categoryFilter;

            const [articlesRes, statsRes, categoriesRes] = await Promise.all([
                api.get('/kb/articles', { params }),
                api.get('/kb/stats'),
                api.get('/kb/categories'),
            ]);

            setArticles(articlesRes.data);
            setStats(statsRes.data);
            setCategories(categoriesRes.data);
        } catch (error) {
            console.error('Failed to fetch data:', error);
            toast.error('Failed to load articles');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [statusFilter, categoryFilter]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchData();
    };

    const handleUpdateStatus = async (id: string, status: string) => {
        try {
            await api.patch(`/kb/articles/${id}/status`, { status });
            toast.success(`Article ${status === 'published' ? 'published' : status === 'archived' ? 'archived' : 'saved as draft'}`);
            fetchData();
        } catch (error) {
            toast.error('Failed to update status');
        }
        setOpenDropdown(null);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this article?')) return;
        try {
            await api.delete(`/kb/articles/${id}`);
            toast.success('Article deleted');
            fetchData();
        } catch (error) {
            toast.error('Failed to delete article');
        }
        setOpenDropdown(null);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
                        Manage Articles
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        Create, edit, and manage knowledge base articles
                    </p>
                </div>
                <Link
                    to="/kb/create"
                    className="flex items-center gap-2 px-6 py-3 bg-primary text-slate-900 rounded-xl font-bold hover:bg-primary/90 transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    New Article
                </Link>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-800 dark:text-white">
                                    {stats.totalArticles}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Total Articles</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                <Send className="w-5 h-5 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-800 dark:text-white">
                                    {stats.byStatus.published}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Published</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                                <Eye className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-800 dark:text-white">
                                    {stats.totalViews}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Total Views</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                <BarChart3 className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-800 dark:text-white">
                                    {stats.byStatus.draft}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Drafts</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Filters & Search */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700">
                <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-4">
                    <div className="flex-1 min-w-[200px] relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search articles..."
                            className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                    </div>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                        <option value="">All Status</option>
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                        <option value="archived">Archived</option>
                    </select>
                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
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
                        className="px-6 py-3 bg-primary text-slate-900 rounded-xl font-bold hover:bg-primary/90 transition-colors"
                    >
                        <Filter className="w-5 h-5" />
                    </button>
                </form>
            </div>

            {/* Articles Table */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                {loading ? (
                    <div className="p-12 text-center text-slate-400 dark:text-slate-500">
                        Loading articles...
                    </div>
                ) : articles.length === 0 ? (
                    <div className="p-12 text-center">
                        <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                        <p className="text-slate-500 dark:text-slate-400 mb-4">No articles found</p>
                        <Link
                            to="/kb/create"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-slate-900 rounded-xl font-bold hover:bg-primary/90 transition-colors"
                        >
                            <Plus className="w-5 h-5" />
                            Create First Article
                        </Link>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50 dark:bg-slate-900/50">
                                <tr>
                                    <th className="text-left px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-16">
                                        Image
                                    </th>
                                    <th className="text-left px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        Title
                                    </th>
                                    <th className="text-left px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        Category
                                    </th>
                                    <th className="text-left px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="text-left px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        Views
                                    </th>
                                    <th className="text-left px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        Updated
                                    </th>
                                    <th className="text-right px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {articles.map((article) => (
                                    <tr
                                        key={article.id}
                                        className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors"
                                    >
                                        <td className="px-6 py-4">
                                            {article.featuredImage ? (
                                                <img
                                                    src={article.featuredImage}
                                                    alt={article.title}
                                                    className="w-12 h-12 rounded-lg object-cover"
                                                />
                                            ) : (
                                                <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                                                    <ImageIcon className="w-5 h-5 text-slate-400" />
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <Link
                                                to={`/kb/articles/${article.id}`}
                                                className="font-medium text-slate-800 dark:text-white hover:text-primary transition-colors line-clamp-1"
                                            >
                                                {article.title}
                                            </Link>
                                            {article.authorName && (
                                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                                                    by {article.authorName}
                                                </p>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium">
                                                {article.category}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span
                                                className={`px-3 py-1 rounded-lg text-sm font-bold ${STATUS_STYLES[article.status]}`}
                                            >
                                                {article.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                            {article.viewCount}
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-sm">
                                            {formatDate(article.updatedAt)}
                                        </td>
                                        <td className="px-6 py-4 text-right relative">
                                            <button
                                                onClick={() =>
                                                    setOpenDropdown(
                                                        openDropdown === article.id ? null : article.id
                                                    )
                                                }
                                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                            >
                                                <MoreVertical className="w-5 h-5 text-slate-400" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Dropdown Menu Portal */}
            {openDropdown && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setOpenDropdown(null)}
                    />
                    {(() => {
                        const article = articles.find(a => a.id === openDropdown);
                        if (!article) return null;
                        return (
                            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 py-3 z-50">
                                <div className="px-4 pb-3 mb-2 border-b border-slate-100 dark:border-slate-700">
                                    <p className="font-bold text-slate-800 dark:text-white text-sm line-clamp-1">
                                        {article.title}
                                    </p>
                                    <p className="text-xs text-slate-400 mt-1">Select an action</p>
                                </div>
                                <Link
                                    to={`/kb/articles/${article.id}`}
                                    className="flex items-center gap-3 px-4 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                                >
                                    <Eye className="w-4 h-4" />
                                    View Article
                                </Link>
                                <Link
                                    to={`/kb/articles/${article.id}/edit`}
                                    className="flex items-center gap-3 px-4 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                                >
                                    <Edit className="w-4 h-4" />
                                    Edit Article
                                </Link>
                                <div className="border-t border-slate-100 dark:border-slate-700 my-2" />
                                {article.status !== 'published' && (
                                    <button
                                        onClick={() => handleUpdateStatus(article.id, 'published')}
                                        className="flex items-center gap-3 w-full px-4 py-2.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                                    >
                                        <Send className="w-4 h-4" />
                                        Publish
                                    </button>
                                )}
                                {article.status !== 'draft' && (
                                    <button
                                        onClick={() => handleUpdateStatus(article.id, 'draft')}
                                        className="flex items-center gap-3 w-full px-4 py-2.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                                    >
                                        <RotateCcw className="w-4 h-4" />
                                        Unpublish
                                    </button>
                                )}
                                {article.status !== 'archived' && (
                                    <button
                                        onClick={() => handleUpdateStatus(article.id, 'archived')}
                                        className="flex items-center gap-3 w-full px-4 py-2.5 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                                    >
                                        <Archive className="w-4 h-4" />
                                        Archive
                                    </button>
                                )}
                                <div className="border-t border-slate-100 dark:border-slate-700 my-2" />
                                <button
                                    onClick={() => handleDelete(article.id)}
                                    className="flex items-center gap-3 w-full px-4 py-2.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Delete Article
                                </button>
                            </div>
                        );
                    })()}
                </>
            )}
        </div>
    );
};
