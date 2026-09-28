import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Check, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { readingMinutes } from './ArticleListRow';

interface FeaturedArticleCardProps {
    article: {
        id: string;
        title: string;
        content?: string;
        category?: string;
        viewCount?: number;
    };
    to: string;
    /** Whether this reader has opened the guide before (per-browser hint only). */
    isRead?: boolean;
    /** Fired when the reader opens the guide, so the caller can record it. */
    onOpen?: () => void;
    className?: string;
}

/**
 * The single "start here" guide, shown as one quiet row under the search bar.
 */
export const FeaturedArticleCard: React.FC<FeaturedArticleCardProps> = ({
    article,
    to,
    isRead,
    onOpen,
    className,
}) => {
    const minutes = useMemo(() => readingMinutes(article.content), [article.content]);

    return (
        <Link
            to={to}
            onClick={onOpen}
            className={cn(
                'group flex items-center gap-3 rounded-2xl bg-card px-4 py-3 ring-1 ring-border/60',
                'transition-colors duration-200 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                className,
            )}
        >
            <span
                className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                    isRead ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-primary/10 text-primary',
                )}
                aria-hidden="true"
            >
                {isRead ? <Check className="h-4 w-4" strokeWidth={2.5} /> : <BookOpen className="h-4 w-4" strokeWidth={1.75} />}
            </span>
            <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-medium text-muted-foreground">
                    {isRead ? 'Sudah dibaca' : 'Mulai di sini'} · {minutes} menit baca
                </span>
                <span className="block truncate text-sm font-semibold text-foreground group-hover:text-primary">
                    {article.title}
                </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" strokeWidth={2} aria-hidden="true" />
        </Link>
    );
};

export default FeaturedArticleCard;
