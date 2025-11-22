import { useState, useEffect } from 'react';
import { Search, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Article {
    id: string;
    title: string;
    content: string;
    category: string;
    tags: string[];
    createdAt: string;
}

export const KnowledgeBasePage = () => {
    const [query, setQuery] = useState('');
    const [articles, setArticles] = useState<Article[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchArticles = async (searchQuery?: string) => {
        setLoading(true);
        try {
            const params = searchQuery ? { q: searchQuery } : {};
            const response = await api.get('/kb/articles', { params });
            setArticles(response.data);
        } catch (error) {
            console.error('Failed to fetch articles:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchArticles();
    }, []);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchArticles(query);
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8">
            <div className="text-center space-y-4 py-12 bg-gradient-to-r from-navy-light to-navy-main rounded-3xl border border-white/10 relative overflow-hidden">
                <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:20px_20px]" />
                <h1 className="text-4xl font-bold text-white relative z-10">
                    How can we help you?
                </h1>
                <p className="text-slate-400 max-w-2xl mx-auto relative z-10">
                    Search our knowledge base for answers to common questions and issues.
                </p>

                <form onSubmit={handleSearch} className="max-w-xl mx-auto relative z-10 px-4">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search for articles (e.g. 'printer', 'vpn')..."
                            className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-neon-green/50 transition-all"
                        />
                        <Button
                            type="submit"
                            className="absolute right-2 top-1/2 -translate-y-1/2 bg-neon-green text-navy-dark hover:bg-neon-green/90"
                        >
                            Search
                        </Button>
                    </div>
                </form>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <p className="text-slate-400 col-span-full text-center">Loading articles...</p>
                ) : articles.length === 0 ? (
                    <p className="text-slate-400 col-span-full text-center">No articles found.</p>
                ) : (
                    articles.map((article) => (
                        <Link key={article.id} to={`/kb/articles/${article.id}`}>
                            <Card className="h-full hover:border-neon-green/50 transition-all cursor-pointer group bg-navy-light border-white/10">
                                <CardHeader>
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="px-2 py-1 rounded-md bg-white/5 text-xs font-medium text-neon-green border border-neon-green/20">
                                            {article.category}
                                        </span>
                                    </div>
                                    <CardTitle className="text-xl text-white group-hover:text-neon-green transition-colors">
                                        {article.title}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-slate-400 line-clamp-3 text-sm">
                                        {article.content}
                                    </p>
                                    <div className="mt-4 flex items-center text-neon-green text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                        Read Article <ChevronRight className="w-4 h-4 ml-1" />
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    ))
                )}
            </div>
        </div>
    );
};
