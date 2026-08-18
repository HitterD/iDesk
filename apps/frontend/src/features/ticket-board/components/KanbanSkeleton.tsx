import React from 'react';

/**
 * Skeleton loading components for Kanban Board
 */

export const SkeletonCard: React.FC = () => (
    <div className="bg-card rounded-xl border border-border overflow-hidden animate-pulse p-3 space-y-2.5">
        <div className="flex justify-between items-center">
            <div className="h-4 w-20 bg-muted rounded" />
            <div className="h-4 w-12 bg-muted rounded" />
        </div>
        <div className="h-4 w-full bg-muted rounded" />
        <div className="h-4 w-3/4 bg-muted rounded" />
        <div className="flex justify-between items-center pt-2 border-t border-border/60">
            <div className="flex items-center gap-1.5">
                <div className="h-6 w-6 bg-muted rounded-full" />
                <div className="h-6 w-6 bg-muted rounded-full" />
            </div>
            <div className="h-4 w-8 bg-muted rounded" />
        </div>
    </div>
);

export const SkeletonColumn: React.FC = () => (
    <div className="flex-1 min-w-[290px] max-w-[370px] h-full flex flex-col bg-card/60 rounded-2xl border border-border overflow-hidden">
        <div className="p-3.5 bg-card border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2.5">
                <div className="w-3 h-3 bg-muted rounded-full animate-pulse" />
                <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                <div className="h-4 w-6 bg-muted rounded-full animate-pulse" />
            </div>
        </div>
        <div className="flex-1 p-2 space-y-2.5">
            {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
    </div>
);

export const KanbanBoardSkeleton: React.FC = () => (
    <div className="h-full flex flex-col space-y-4">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
            <div className="space-y-1.5">
                <div className="h-7 w-40 bg-muted rounded-lg animate-pulse" />
                <div className="h-3.5 w-64 bg-muted rounded animate-pulse" />
            </div>
            <div className="flex items-center gap-2">
                <div className="h-9 w-28 bg-muted rounded-xl animate-pulse" />
                <div className="h-9 w-32 bg-muted rounded-xl animate-pulse" />
            </div>
        </div>

        {/* Stats Skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="bg-card rounded-xl p-3 border border-border animate-pulse flex items-center justify-between">
                    <div className="space-y-1.5 flex-1">
                        <div className="h-3 w-12 bg-muted rounded" />
                        <div className="h-6 w-8 bg-muted rounded" />
                    </div>
                    <div className="w-8 h-8 bg-muted rounded-lg" />
                </div>
            ))}
        </div>

        {/* Search Bar Skeleton */}
        <div className="h-12 bg-card rounded-2xl border border-border animate-pulse" />

        {/* Columns Skeleton */}
        <div className="flex-1 min-h-0 flex gap-3.5 pb-1 overflow-hidden">
            {[1, 2, 3, 4].map(i => <SkeletonColumn key={i} />)}
        </div>
    </div>
);
