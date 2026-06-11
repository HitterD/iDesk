import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PaginationMeta } from '@/types/admin.types';

interface AgentPaginationBarProps {
    meta: PaginationMeta;
    pageSize: number;
    pageSizeOptions: number[];
    onPageSizeChange: (size: number) => void;
    onPrev: () => void;
    onNext: () => void;
}

export function AgentPaginationBar({ meta, pageSize, pageSizeOptions, onPageSizeChange, onPrev, onNext }: AgentPaginationBarProps) {
    if (meta.totalPages <= 1) return null;

    return (
        <div className="sticky bottom-4 z-10 flex items-center justify-between bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl px-4 py-3 shadow-lg">
            <div className="text-sm text-slate-500 dark:text-slate-400">
                Showing {((meta.page - 1) * meta.limit) + 1} - {Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
            </div>
            <div className="flex items-center gap-4">
                {/* P1-2: Page Size Selector */}
                <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500 dark:text-slate-400">Show:</span>
                    <select
                        value={pageSize}
                        onChange={(e) => onPageSizeChange(Number(e.target.value))}
                        className="px-2 py-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-colors duration-150"
                    >
                        {pageSizeOptions.map(size => (
                            <option key={size} value={size}>{size}</option>
                        ))}
                    </select>
                </div>
                <div className="w-px h-6 bg-slate-200 dark:bg-slate-600" />
                {/* Page Navigation */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={onPrev}
                        disabled={!meta.hasPrevPage}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        Previous
                    </button>
                    <span className="px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg">
                        Page {meta.page} of {meta.totalPages}
                    </span>
                    <button
                        onClick={onNext}
                        disabled={!meta.hasNextPage}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        Next
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
