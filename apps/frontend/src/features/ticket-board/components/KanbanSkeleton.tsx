import React from 'react';

/**
 * Skeleton loading components for Kanban Board
 * Extracted to separate file to prevent reconciliation issues
 */

export const SkeletonCard: React.FC = () => (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-pulse">
        <div className="h-2.5 bg-slate-200 dark:bg-slate-700" />
        <div className="p-3 space-y-3">
            <div className="flex justify-between">
                <div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="h-4 w-4 bg-slate-200 dark:bg-slate-700 rounded" />
            </div>
            <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="flex gap-2">
                <div className="h-5 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="h-5 w-12 bg-slate-200 dark:bg-slate-700 rounded" />
            </div>
            <div className="flex justify-between pt-2 border-t border-slate-100 dark:border-slate-700">
                <div className="flex gap-1">
                    <div className="h-6 w-6 bg-slate-200 dark:bg-slate-700 rounded-full" />
                    <div className="h-6 w-6 bg-slate-200 dark:bg-slate-700 rounded-full" />
                </div>
                <div className="h-4 w-8 bg-slate-200 dark:bg-slate-700 rounded" />
            </div>
        </div>
    </div>
);

export const SkeletonColumn: React.FC = () => (
    <div className="flex-1 min-w-[300px] flex flex-col bg-slate-50 dark:bg-slate-900/50 rounded-2xl overflow-hidden">
        <div className="p-4 bg-white dark:bg-slate-800 border-b-[3px] border-slate-300">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
                <div className="space-y-2">
                    <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                    <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                </div>
            </div>
        </div>
        <div className="flex-1 p-2 space-y-2">
            {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
    </div>
);

export const KanbanBoardSkeleton: React.FC = () => (
    <div className="h-full flex flex-col space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-2xl animate-pulse" />
                <div className="space-y-2">
                    <div className="h-6 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                    <div className="h-4 w-48 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                </div>
            </div>
        </div>
        {/* Stats Skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="bg-white dark:bg-slate-800 rounded-xl px-5 py-4 border border-slate-200 dark:border-slate-700 animate-pulse">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 bg-slate-200 dark:bg-slate-700 rounded-xl" />
                        <div className="space-y-2">
                            <div className="h-6 w-8 bg-slate-200 dark:bg-slate-700 rounded" />
                            <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
        {/* Columns Skeleton */}
        <div className="flex-1 flex gap-3 p-4 overflow-hidden">
            {[1, 2, 3, 4].map(i => <SkeletonColumn key={i} />)}
        </div>
    </div>
);
