import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Check, Clock, Compass } from 'lucide-react';
import { cn } from '@/lib/utils';
import { readingMinutes } from './ArticleListRow';
import { getCategoryMeta } from './ArticleCard';

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
 * The single "start here" spotlight guide, pinned above the article feed.
 *
 * Designed as a high-impact Bento Spotlight Tile with ambient glow,
 * reading status, category indicator, and interactive hover feedback.
 */
export const FeaturedArticleCard: React.FC<FeaturedArticleCardProps> = ({
    article,
    to,
    isRead,
    onOpen,
    className,
}) => {
    const minutes = useMemo(() => readingMinutes(article.content), [article.content]);
    const meta = useMemo(() => getCategoryMeta(article.category), [article.category]);

    return (
        <Link
            to={to}
            onClick={onOpen}
            className={cn(
                'group relative block overflow-hidden rounded-[1.75rem] p-[1px]',
                'bg-gradient-to-r from-primary/30 via-primary/10 to-border/40',
                'shadow-[0_4px_20px_rgba(0,0,0,0.04)] hover:shadow-2xl hover:shadow-primary/10',
                'transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
                'active:scale-[0.995]',
                className,
            )}
        >
            <div
                className={cn(
                    'relative overflow-hidden rounded-[calc(1.75rem-1px)] bg-card px-6 py-6 sm:px-8 sm:py-7',
                    'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.7)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]',
                )}
            >
                {/* Ambient Corner Glow */}
                <div
                    className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl transition-opacity duration-500 group-hover:opacity-100 group-hover:scale-125"
                    aria-hidden="true"
                />

                <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
                    <div className="min-w-0 space-y-3">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span
                                className={cn(
                                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide border',
                                    isRead
                                        ? 'bg-muted/80 text-muted-foreground border-border'
                                        : 'bg-primary/10 text-primary border-primary/20',
                                )}
                            >
                                {isRead ? (
                                    <>
                                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
                                        <span>Sudah dibaca</span>
                                    </>
                                ) : (
                                    <>
                                        <BookOpen className="w-3.5 h-3.5" strokeWidth={1.75} />
                                        <span>Spotlight Panduan Utama</span>
                                    </>
                                )}
                            </span>

                            <span className={cn('px-2.5 py-0.5 rounded-full text-[10px] font-medium border', meta.colorClass)}>
                                {meta.label}
                            </span>
                        </div>

                        <h2 className="text-lg sm:text-2xl font-bold leading-snug tracking-tight text-foreground text-balance group-hover:text-primary transition-colors duration-300">
                            {article.title}
                        </h2>

                        <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                            <span>Panduan resmi untuk mengenal fitur & alur iDesk Enterprise</span>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1 font-medium">
                                <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />
                                {minutes} menit baca
                            </span>
                        </div>
                    </div>

                    {/* Interactive Action Button */}
                    <span
                        className={cn(
                            'inline-flex shrink-0 items-center gap-2.5 self-start sm:self-auto',
                            'rounded-full bg-primary py-2.5 pl-5 pr-2.5 text-xs font-semibold text-primary-foreground',
                            'shadow-md shadow-primary/20 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
                            'group-hover:shadow-lg group-hover:shadow-primary/30 group-hover:scale-[1.02]',
                        )}
                    >
                        <span>Baca Sekarang</span>
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5">
                            <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
                        </span>
                    </span>
                </div>
            </div>
        </Link>
    );
};

export default FeaturedArticleCard;
