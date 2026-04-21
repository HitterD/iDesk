import { cn } from '@/lib/utils';

interface TableSkeletonProps {
    rows?: number;
    cols?: number;
    className?: string;
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({
    rows = 5,
    cols = 4,
    className
}) => (
    <div className={cn(
        "bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden",
        className
    )}>
        <div className="animate-pulse">
            {/* Header */}
            <div className="bg-slate-50 dark:bg-slate-900 p-4 border-b border-slate-200 dark:border-slate-700">
                <div className="flex gap-4">
                    {Array(cols).fill(0).map((_, i) => (
                        <div key={i} className="h-4 bg-slate-200 dark:bg-slate-700 rounded flex-1" />
                    ))}
                </div>
            </div>
            {/* Rows */}
            {Array(rows).fill(0).map((_, i) => (
                <div key={i} className="p-4 border-b border-slate-100 dark:border-slate-800 last:border-b-0">
                    <div className="flex gap-4">
                        {Array(cols).fill(0).map((_, j) => (
                            <div key={j} className="h-4 bg-slate-100 dark:bg-slate-800 rounded flex-1" />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    </div>
);

interface CardSkeletonProps {
    className?: string;
}

export const CardSkeleton: React.FC<CardSkeletonProps> = ({ className }) => (
    <div className={cn(
        "bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6",
        className
    )}>
        <div className="animate-pulse space-y-4">
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
            <div className="h-8 bg-slate-100 dark:bg-slate-800 rounded w-1/2" />
            <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-2/3" />
        </div>
    </div>
);

interface ListSkeletonProps {
    items?: number;
    className?: string;
}

export const ListSkeleton: React.FC<ListSkeletonProps> = ({ items = 5, className }) => (
    <div className={cn("space-y-3", className)}>
        {Array(items).fill(0).map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                <div className="animate-pulse flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-full" />
                    <div className="flex-1 space-y-2">
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
                        <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-2/3" />
                    </div>
                </div>
            </div>
        ))}
    </div>
);
