import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Eye, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCategoryMeta } from './ArticleCard';

interface ArticleListRowProps {
    article: {
        id: string;
        title: string;
        content?: string;
        category?: string;
        viewCount?: number;
        updatedAt?: string;
        createdAt?: string;
    };
    to: string;
    className?: string;
}

const WORDS_PER_MINUTE = 200;

/** Rough reading time from the raw markdown body. */
export const readingMinutes = (content?: string): number => {
    if (!content) return 1;
    const text = content.replace(/```[\s\S]*?```/g, '').replace(/<[^>]*>/g, '');
    return Math.max(1, Math.ceil(text.trim().split(/\s+/).length / WORDS_PER_MINUTE));
};

/** "3 hari lalu" style stamp. */
export const relativeDate = (value?: string): string | null => {
    if (!value) return null;
    const then = new Date(value).getTime();
    if (Number.isNaN(then)) return null;

    const days = Math.floor((Date.now() - then) / 86_400_000);
    if (days <= 0) return 'hari ini';
    if (days === 1) return 'kemarin';
    if (days < 30) return `${days} hari lalu`;
    if (days < 365) return `${Math.floor(days / 30)} bulan lalu`;
    return `${Math.floor(days / 365)} tahun lalu`;
};

/**
 * One article as a single scannable line.
 */
export const ArticleListRow: React.FC<ArticleListRowProps> = ({ article, to, className }) => {
    const meta = useMemo(() => getCategoryMeta(article.category), [article.category]);
    const minutes = useMemo(() => readingMinutes(article.content), [article.content]);
    const updated = useMemo(
        () => relativeDate(article.updatedAt || article.createdAt),
        [article.updatedAt, article.createdAt],
    );
    const Icon = meta.icon;

    return (
        <Link
            to={to}
            className={cn(
                'group relative flex items-center gap-3.5 px-4 py-3.5 sm:px-5 sm:py-4',
                'transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]',
                'hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none',
                className,
            )}
        >
            {/* Category mark */}
            <span
                className={cn(
                    'flex w-9 h-9 rounded-xl border items-center justify-center shrink-0',
                    'transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105',
                    meta.colorClass,
                )}
                aria-hidden="true"
            >
                <Icon className="w-4 h-4" strokeWidth={1.5} />
            </span>

            <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                    {article.title}
                </span>

                {/* Metadata line */}
                <span className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                    <span className="font-medium text-foreground/70">{meta.label}</span>
                    <span aria-hidden="true">·</span>
                    <span className="whitespace-nowrap flex items-center gap-1">
                        <Clock className="w-3 h-3 text-muted-foreground/60" />
                        {minutes} mnt baca
                    </span>
                    {article.viewCount !== undefined && article.viewCount > 0 && (
                        <>
                            <span aria-hidden="true">·</span>
                            <span className="whitespace-nowrap flex items-center gap-1">
                                <Eye className="w-3 h-3 text-muted-foreground/60" />
                                {article.viewCount} views
                            </span>
                        </>
                    )}
                    {updated && (
                        <>
                            <span aria-hidden="true" className="hidden sm:inline">·</span>
                            <span className="hidden sm:inline whitespace-nowrap">{updated}</span>
                        </>
                    )}
                </span>
            </span>

            <ArrowUpRight
                className="w-4 h-4 shrink-0 text-muted-foreground/40 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                strokeWidth={1.75}
                aria-hidden="true"
            />
        </Link>
    );
};

export default ArticleListRow;
