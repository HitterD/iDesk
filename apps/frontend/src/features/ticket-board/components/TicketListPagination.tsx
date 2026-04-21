import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PaginationInfo {
    totalItems: number;
    totalPages: number;
    startIndex: number;
    endIndex: number;
    showPagination: boolean;
    currentPage: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
}

interface TicketListPaginationProps {
    paginationInfo: PaginationInfo;
    currentPage: number;
    goToPage: (page: number) => void;
    getPageNumbers: () => (number | string)[];
}

export const TicketListPagination: React.FC<TicketListPaginationProps> = ({
    paginationInfo,
    currentPage,
    goToPage,
    getPageNumbers
}) => {
    if (!paginationInfo.showPagination) return null;

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 mt-2 border-t border-[hsl(var(--border))]">
            {/* Results Info */}
            <div className="text-sm text-slate-500 dark:text-slate-400">
                Showing <span className="font-medium text-slate-700 dark:text-slate-300">{paginationInfo.startIndex + 1}</span> to{' '}
                <span className="font-medium text-slate-700 dark:text-slate-300">{paginationInfo.endIndex}</span> of{' '}
                <span className="font-medium text-slate-700 dark:text-slate-300">{paginationInfo.totalItems}</span> tickets
            </div>

            {/* Pagination Buttons */}
            <div className="flex items-center gap-1">
                {/* First Page */}
                <button
                    onClick={() => goToPage(1)}
                    disabled={!paginationInfo.hasPrevPage}
                    className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title="First page"
                >
                    <ChevronsLeft className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                </button>

                {/* Previous Page */}
                <button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={!paginationInfo.hasPrevPage}
                    className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title="Previous page"
                >
                    <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                </button>

                {/* Page Numbers */}
                <div className="flex items-center gap-1 mx-2">
                    {getPageNumbers().map((page, idx) => (
                        typeof page === 'number' ? (
                            <button
                                key={idx}
                                onClick={() => goToPage(page)}
                                className={cn(
                                    "min-w-[36px] h-9 px-3 rounded-lg text-sm transition-colors duration-150",
                                    page === currentPage
                                        ? "bg-primary text-primary-foreground font-bold shadow-sm"
                                        : "font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                )}
                            >
                                {page}
                            </button>
                        ) : (
                            <span key={idx} className="px-2 text-slate-400 select-none">...</span>
                        )
                    ))}
                </div>

                {/* Next Page */}
                <button
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={!paginationInfo.hasNextPage}
                    className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title="Next page"
                >
                    <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                </button>

                {/* Last Page */}
                <button
                    onClick={() => goToPage(paginationInfo.totalPages)}
                    disabled={!paginationInfo.hasNextPage}
                    className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title="Last page"
                >
                    <ChevronsRight className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                </button>
            </div>
        </div>
    );
};
