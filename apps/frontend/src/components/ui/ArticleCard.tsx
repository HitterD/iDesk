import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, Eye, BookOpen, Calendar, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { OptimizedImage } from './OptimizedImage';

interface Article {
    id: string;
    title: string;
    content: string;
    category?: string;
    featuredImage?: string;
    viewCount?: number;
    createdAt: string;
    author?: {
        fullName: string;
        avatarUrl?: string;
    };
}

interface ArticleCardProps {
    article: Article;
    to: string;
    variant?: 'default' | 'compact' | 'featured';
    className?: string;
}

// Utility to calculate reading time
const calculateReadingTime = (content: string): number => {
    const wordsPerMinute = 200;
    const text = content.replace(/<[^>]*>/g, ''); // Strip HTML tags
    const words = text.trim().split(/\s+/).length;
    return Math.max(1, Math.ceil(words / wordsPerMinute));
};

// Utility to strip HTML and get excerpt
const getExcerpt = (content: string, maxLength: number = 150): string => {
    const text = content.replace(/<[^>]*>/g, '').trim();
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength).trim() + '...';
};

export const ArticleCard: React.FC<ArticleCardProps> = ({
    article,
    to,
    variant = 'default',
    className,
}) => {
    const readingTime = useMemo(() => calculateReadingTime(article.content), [article.content]);
    const excerpt = useMemo(() => getExcerpt(article.content), [article.content]);

    if (variant === 'compact') {
        return (
            <Link
                to={to}
                className={cn(
                    "group flex items-start gap-4 p-4 rounded-xl",
                    "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700",
                    "hover:shadow-lg hover:border-primary/30 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out",
                    className
                )}
            >
                {/* Thumbnail */}
                {article.featuredImage && (
                    <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-700">
                        <OptimizedImage
                            src={article.featuredImage}
                            alt={article.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            lazy={true}
                        />
                    </div>
                )}
                
                <div className="flex-1 min-w-0">
                    {article.category && (
                        <span className="inline-block px-2 py-0.5 text-[10px] font-medium bg-primary/10 text-primary rounded-full mb-1">
                            {article.category}
                        </span>
                    )}
                    <h3 className="font-semibold text-slate-800 dark:text-white line-clamp-2 group-hover:text-primary transition-colors">
                        {article.title}
                    </h3>
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {readingTime} min
                        </span>
                        {article.viewCount !== undefined && (
                            <span className="flex items-center gap-1">
                                <Eye className="w-3 h-3" />
                                {article.viewCount}
                            </span>
                        )}
                    </div>
                </div>
                
                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-primary group-hover:translate-x-1 transition-[color,transform] duration-150 shrink-0" />
            </Link>
        );
    }

    if (variant === 'featured') {
        return (
            <Link
                to={to}
                className={cn(
                    "group relative block overflow-hidden rounded-3xl",
                    "bg-gradient-to-br from-primary/20 to-blue-500/20",
                    "hover:shadow-2xl transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out",
                    className
                )}
            >
                {/* Background Image */}
                {article.featuredImage ? (
                    <div className="absolute inset-0">
                        <OptimizedImage
                            src={article.featuredImage}
                            alt={article.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            lazy={true}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                    </div>
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <BookOpen className="w-24 h-24 text-primary/20" />
                    </div>
                )}
                
                {/* Content */}
                <div className="relative p-6 h-64 flex flex-col justify-end">
                    {article.category && (
                        <span className="inline-block px-3 py-1 text-xs font-bold bg-white/90 dark:bg-slate-800/90 backdrop-blur text-primary rounded-full mb-3 w-fit">
                            {article.category}
                        </span>
                    )}
                    
                    <h3 className="font-bold text-xl text-white mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                        {article.title}
                    </h3>
                    
                    <p className="text-sm text-white/80 line-clamp-2 mb-4">
                        {excerpt}
                    </p>
                    
                    <div className="flex items-center justify-between text-xs text-white/70">
                        <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                {readingTime} min read
                            </span>
                            {article.viewCount !== undefined && (
                                <span className="flex items-center gap-1">
                                    <Eye className="w-3.5 h-3.5" />
                                    {article.viewCount} views
                                </span>
                            )}
                        </div>
                        <span>{format(new Date(article.createdAt), 'MMM d, yyyy')}</span>
                    </div>
                </div>
            </Link>
        );
    }

    // Default variant
    return (
        <Link
            to={to}
            className={cn(
                "group block bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden",
                "hover:shadow-xl hover:-translate-y-1 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out",
                className
            )}
        >
            {/* Featured Image */}
            <div className="relative h-48 bg-gradient-to-br from-primary/10 to-blue-500/10 overflow-hidden">
                {article.featuredImage ? (
                    <OptimizedImage
                        src={article.featuredImage}
                        alt={article.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        lazy={true}
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <BookOpen className="w-16 h-16 text-primary/30" />
                    </div>
                )}
                
                {/* Category Badge */}
                {article.category && (
                    <div className="absolute top-4 left-4">
                        <span className="px-3 py-1 bg-white/90 dark:bg-slate-800/90 backdrop-blur rounded-full text-xs font-bold text-primary">
                            {article.category}
                        </span>
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="p-5">
                <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-2 group-hover:text-primary transition-colors line-clamp-2">
                    {article.title}
                </h3>
                
                <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-4">
                    {excerpt}
                </p>

                {/* Meta Info */}
                <div className="flex items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {readingTime} min read
                        </span>
                        {article.viewCount !== undefined && (
                            <span className="flex items-center gap-1">
                                <Eye className="w-3.5 h-3.5" />
                                {article.viewCount} views
                            </span>
                        )}
                    </div>
                    <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {format(new Date(article.createdAt), 'MMM d')}
                    </span>
                </div>
            </div>
        </Link>
    );
};

// Animated version with stagger
interface AnimatedArticleCardProps extends ArticleCardProps {
    index?: number;
}

export const AnimatedArticleCard: React.FC<AnimatedArticleCardProps> = ({
    index = 0,
    ...props
}) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                duration: 0.4,
                delay: index * 0.08,
                ease: [0.25, 0.1, 0.25, 1],
            }}
        >
            <ArticleCard {...props} />
        </motion.div>
    );
};

export default ArticleCard;
