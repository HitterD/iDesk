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
        <nav aria-label="Pagination" className="sticky bottom-4 z-10 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl px-4 py-3 shadow-lg">
            <div role="status" className="text-sm text-slate-500 dark:text-slate-400">
                Showing {((meta.page - 1) * meta.limit) + 1} - {Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4">
                {/* P1-2: Page Size Selector */}
                <div className="flex items-center gap-2">
                    <label htmlFor="page-size" className="text-sm text-slate-500 dark:text-slate-400">Show:</label>
                    <select
                        id="page-size"
                        value={pageSize}
                        onChange={(e) => onPageSizeChange(Number(e.target.value))}
                        className="px-2 py-1.5 min-h-[44px] bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-colors duration-150"
                    >
                        {pageSizeOptions.map(size => (
                            <option key={size} value={size}>{size}</option>
                        ))}
                    </select>
                </div>
                <div className="hidden sm:block w-px h-6 bg-slate-200 dark:bg-slate-600" />
                {/* Page Navigation */}
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={onPrev}
                        disabled={!meta.hasPrevPage}
                        aria-label="Previous page"
                        className="flex items-center gap-1 px-3 py-1.5 min-h-[44px] text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                        Previous
                    </button>
                    <span className="px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg whitespace-nowrap">
                        Page {meta.page} of {meta.totalPages}
                    </span>
                    <button
                        type="button"
                        onClick={onNext}
                        disabled={!meta.hasNextPage}
                        aria-label="Next page"
                        className="flex items-center gap-1 px-3 py-1.5 min-h-[44px] text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        Next
                        <ChevronRight className="w-4 h-4" aria-hidden="true" />
                    </button>
                </div>
            </div>
        </nav>
    );
}
