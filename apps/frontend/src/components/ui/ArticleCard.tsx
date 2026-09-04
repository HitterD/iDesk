import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    ChevronRight,
    Wifi,
    ShieldCheck,
    Printer,
    Laptop,
    HelpCircle,
    ArrowUpRight,
    Mail,
    FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Article {
    id: string;
    title: string;
    content: string;
    category?: string;
    tags?: string[];
    featuredImage?: string;
    viewCount?: number;
    createdAt: string;
    updatedAt?: string;
    author?: {
        fullName: string;
        avatarUrl?: string;
    };
}

export interface ArticleCardProps {
    article: Article;
    to: string;
    variant?: 'default' | 'compact' | 'featured';
    className?: string;
}

export const calculateReadingTime = (content: string): number => {
    const wordsPerMinute = 200;
    const text = content.replace(/<[^>]*>/g, '').replace(/```[\s\S]*?```/g, '');
    const words = text.trim().split(/\s+/).length;
    return Math.max(1, Math.ceil(words / wordsPerMinute));
};

export const getExcerpt = (content: string, maxLength: number = 115): string => {
    const text = content
        .replace(/```[\s\S]*?```/g, '')
        .replace(/#+\s*/g, '')
        .replace(/<[^>]*>/g, '')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .trim();
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength).trim() + '...';
};

// Categorization with curated cohesive tones
export function getCategoryMeta(category?: string) {
    const cat = (category || 'General').toLowerCase();
    if (cat.includes('net') || cat.includes('wifi') || cat.includes('vpn')) {
        return {
            icon: Wifi,
            colorClass: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/20',
            label: category || 'Network',
        };
    }
    if (cat.includes('sec') || cat.includes('pass') || cat.includes('auth') || cat.includes('akun')) {
        return {
            icon: ShieldCheck,
            colorClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
            label: category || 'Security',
        };
    }
    if (cat.includes('mail') || cat.includes('outlook') || cat.includes('email')) {
        return {
            icon: Mail,
            colorClass: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20',
            label: category || 'Email',
        };
    }
    if (cat.includes('hard') || cat.includes('print') || cat.includes('device')) {
        return {
            icon: Printer,
            colorClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
            label: category || 'Hardware',
        };
    }
    if (cat.includes('soft') || cat.includes('app') || cat.includes('office') || cat.includes('oracle')) {
        return {
            icon: Laptop,
            colorClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
            label: category || 'Software',
        };
    }
    if (cat.includes('form') || cat.includes('e-form') || cat.includes('access')) {
        return {
            icon: FileText,
            colorClass: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20',
            label: category || 'Access & Forms',
        };
    }
    return {
        icon: HelpCircle,
        colorClass: 'bg-muted text-muted-foreground border-border',
        label: category || 'General',
    };
}

export const ArticleCard: React.FC<ArticleCardProps> = ({
    article,
    to,
    variant = 'default',
    className,
}) => {
    const readingTime = useMemo(() => calculateReadingTime(article.content || ''), [article.content]);
    const excerpt = useMemo(() => getExcerpt(article.content || ''), [article.content]);
    const meta = useMemo(() => getCategoryMeta(article.category), [article.category]);
    const IconComponent = meta.icon;

    if (variant === 'compact') {
        return (
            <Link
                to={to}
                className={cn(
                    'group flex items-center justify-between gap-3 p-3.5 rounded-2xl',
                    'bg-card border border-border/70 hover:border-primary/40 hover:bg-muted/30',
                    'transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]',
                    'active:scale-[0.99]',
                    className,
                )}
            >
                <div className="flex items-center gap-3 min-w-0">
                    <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border transition-transform duration-300 group-hover:scale-105', meta.colorClass)}>
                        <IconComponent className="w-4 h-4" strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0">
                        <h4 className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                            {article.title}
                        </h4>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                            <span>{meta.label}</span>
                            <span>•</span>
                            <span>{readingTime} mnt baca</span>
                        </div>
                    </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
            </Link>
        );
    }

    // Linear Minimalist Card: Clean, uncluttered, focused on readability
    return (
        <Link
            to={to}
            className={cn(
                'group relative flex flex-col justify-between p-5 rounded-2xl',
                'bg-card border border-border/75 hover:border-primary/40',
                'shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:shadow-md hover:bg-muted/15',
                'transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]',
                'active:scale-[0.995]',
                className,
            )}
        >
            <div className="space-y-3">
                {/* Header: Unified Soft Category Badge & Reading Time */}
                <div className="flex items-center justify-between gap-2">
                    <span
                        className={cn(
                            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border shrink-0',
                            meta.colorClass,
                        )}
                    >
                        <IconComponent className="w-3.5 h-3.5" strokeWidth={1.75} />
                        <span>{meta.label}</span>
                    </span>

                    <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                        <span>{readingTime} mnt baca</span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                    </span>
                </div>

                {/* Title */}
                <h3 className="font-semibold text-sm sm:text-[15px] text-foreground group-hover:text-primary transition-colors duration-150 line-clamp-2 leading-snug">
                    {article.title}
                </h3>

                {/* Excerpt */}
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {excerpt}
                </p>
            </div>
        </Link>
    );
};

export const AnimatedArticleCard: React.FC<ArticleCardProps & { index?: number }> = ({
    index = 0,
    ...props
}) => {
    return <ArticleCard {...props} />;
};

export default ArticleCard;
