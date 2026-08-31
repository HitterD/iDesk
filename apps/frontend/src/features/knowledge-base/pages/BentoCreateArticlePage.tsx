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
        <div className="space-y-6">
            <Link
                to="/kb"
                className="inline-flex items-center text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors group cursor-pointer"
            >
                <ArrowLeft className="w-4 h-4 mr-1.5 group-hover:-translate-x-0.5 transition-transform" />
                <span>Kembali ke Knowledge Base</span>
            </Link>

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
