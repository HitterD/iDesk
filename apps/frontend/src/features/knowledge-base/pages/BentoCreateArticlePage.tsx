import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useAuth } from '@/stores/useAuth';
import { ArticleForm, ArticleFormData } from '../components/ArticleForm';

export const BentoCreateArticlePage = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (data: ArticleFormData) => {
        setIsLoading(true);
        try {
            const response = await api.post('/kb/articles', data);
            toast.success('Article created successfully!');
            navigate(`/kb/articles/${response.data.id}`);
        } catch (error: any) {
            console.error('Failed to create article:', error);
            toast.error(error.response?.data?.message || 'Failed to create article');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6 pb-12">
            <div className="flex items-center justify-between gap-4">
                <Link
                    to="/kb"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-border text-foreground hover:bg-muted font-semibold text-xs transition-all shadow-2xs group cursor-pointer"
                >
                    <ArrowLeft className="w-3.5 h-3.5 text-muted-foreground group-hover:-translate-x-0.5 group-hover:text-foreground transition-all" />
                    <span>Kembali ke Knowledge Base</span>
                </Link>
            </div>

            <ArticleForm
                onSubmit={handleSubmit}
                onCancel={() => navigate('/kb')}
                isLoading={isLoading}
                mode="create"
                isAdmin={user?.role === 'ADMIN'}
            />
        </div>
    );
};
