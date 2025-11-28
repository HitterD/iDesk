import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import api from '@/lib/api';
import { ArticleForm, ArticleFormData } from '../components/ArticleForm';

export const BentoCreateArticlePage = () => {
    const navigate = useNavigate();
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
                className="inline-flex items-center text-slate-500 dark:text-slate-400 hover:text-primary transition-colors font-medium"
            >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back to Knowledge Base
            </Link>

            <ArticleForm
                onSubmit={handleSubmit}
                onCancel={() => navigate('/kb')}
                isLoading={isLoading}
                mode="create"
            />
        </div>
    );
};
