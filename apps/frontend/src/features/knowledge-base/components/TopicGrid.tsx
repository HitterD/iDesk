import React from 'react';
import { cn } from '@/lib/utils';
import { getCategoryMeta } from '@/components/ui/ArticleCard';

interface TopicGridProps {
    /** Categories as stored in the database (GET /kb/categories). */
    categories: string[];
    onSelect: (category: string) => void;
}

/**
 * Apple Support–style topic launcher: one round icon + label per category.
 * Categories come from the backend so the grid never points at an empty topic.
 */
export const TopicGrid: React.FC<TopicGridProps> = ({ categories, onSelect }) => {
    if (categories.length === 0) return null;

    return (
        <nav aria-label="Topik panduan" className="flex flex-wrap justify-center gap-x-2 gap-y-5 sm:gap-x-4">
            {categories.map((category) => {
                const meta = getCategoryMeta(category);
                const Icon = meta.icon;
                return (
                    <button
                        key={category}
                        type="button"
                        onClick={() => onSelect(category)}
                        className="group flex w-24 flex-col items-center gap-2 rounded-2xl p-2 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                        <span
                            className={cn(
                                'flex h-14 w-14 items-center justify-center rounded-full border',
                                'transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105 group-active:scale-95',
                                meta.colorClass,
                            )}
                            aria-hidden="true"
                        >
                            <Icon className="h-6 w-6" strokeWidth={1.5} />
                        </span>
                        <span className="text-xs font-medium text-foreground/80 group-hover:text-primary">
                            {category}
                        </span>
                    </button>
                );
            })}
        </nav>
    );
};

export default TopicGrid;
