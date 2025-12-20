import React from 'react';
import { cn } from '@/lib/utils';

interface TicketListSkeletonProps {
    rows?: number;
    className?: string;
}

/**
 * Loading skeleton for ticket list pages
 * Provides a better UX than a simple spinner
 */
export const TicketListSkeleton: React.FC<TicketListSkeletonProps> = ({
    rows = 5,
    className,
}) => {
    return (
        <div className={cn("space-y-6", className)}>
            {/* Header Skeleton */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-200 dark:bg-slate-700 animate-pulse" />
                    <div className="space-y-2">
                        <div className="h-6 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                        <div className="h-4 w-48 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                    </div>
                </div>
                <div className="h-12 w-36 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
            </div>

            {/* Stats Skeleton */}
            <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="glass-card rounded-2xl p-4">
                        <div className="flex items-center gap-3 animate-pulse">
                            <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-700" />
                            <div className="space-y-2">
                                <div className="h-6 w-8 bg-slate-200 dark:bg-slate-700 rounded" />
                                <div className="h-3 w-16 bg-slate-100 dark:bg-slate-800 rounded" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Table Skeleton */}
            <div className="glass-card overflow-hidden rounded-2xl">
                {/* Search Bar Skeleton */}
                <div className="p-4 border-b border-white/20 dark:border-white/10 flex flex-col md:flex-row gap-4 bg-white/40 dark:bg-slate-900/40">
                    <div className="flex-1 h-10 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
                    <div className="flex gap-2">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="h-10 w-20 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
                        ))}
                    </div>
                </div>

                {/* Table Header Skeleton */}
                <div className="hidden md:flex items-center px-6 py-3 bg-slate-50/50 dark:bg-slate-900/30 border-b border-white/20 dark:border-white/10">
                    <div className="w-48 h-3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                    <div className="flex-1 h-3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mx-4" />
                    <div className="w-32 h-3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                    <div className="w-40 h-3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mx-4" />
                    <div className="w-32 h-3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                    <div className="w-24 h-3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                </div>

                {/* Rows Skeleton */}
                <div className="divide-y divide-white/20 dark:divide-white/10">
                    {Array(rows).fill(0).map((_, index) => (
                        <div
                            key={index}
                            className="flex flex-col md:flex-row md:items-center px-6 py-4 gap-4 md:gap-0 animate-pulse"
                            style={{ animationDelay: `${index * 0.05}s` }}
                        >
                            {/* Status & ID */}
                            <div className="md:w-48 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700" />
                                <div className="space-y-1.5">
                                    <div className="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
                                    <div className="h-2.5 w-16 bg-slate-100 dark:bg-slate-800 rounded" />
                                </div>
                            </div>

                            {/* Details */}
                            <div className="flex-1 min-w-0 pr-4 space-y-2">
                                <div className="h-4 w-48 bg-slate-200 dark:bg-slate-700 rounded" />
                                <div className="h-3 w-24 bg-slate-100 dark:bg-slate-800 rounded" />
                            </div>

                            {/* Priority */}
                            <div className="md:w-32">
                                <div className="h-6 w-20 bg-slate-200 dark:bg-slate-700 rounded-full" />
                            </div>

                            {/* Assignee */}
                            <div className="md:w-40 flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700" />
                                <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
                            </div>

                            {/* Time */}
                            <div className="md:w-32">
                                <div className="h-3 w-20 bg-slate-100 dark:bg-slate-800 rounded" />
                            </div>

                            {/* Action */}
                            <div className="md:w-24 flex justify-end">
                                <div className="h-4 w-12 bg-slate-100 dark:bg-slate-800 rounded" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

/**
 * Loading skeleton for knowledge base articles grid
 */
export const ArticleGridSkeleton: React.FC<{ items?: number; className?: string }> = ({
    items = 6,
    className,
}) => {
    return (
        <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6", className)}>
            {Array(items).fill(0).map((_, i) => (
                <div
                    key={i}
                    className="h-full bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700 overflow-hidden animate-pulse"
                >
                    <div className="h-40 bg-slate-200 dark:bg-slate-700" />
                    <div className="p-6 space-y-3">
                        <div className="flex justify-between">
                            <div className="h-6 w-20 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                            <div className="h-4 w-12 bg-slate-100 dark:bg-slate-800 rounded" />
                        </div>
                        <div className="h-5 w-3/4 bg-slate-200 dark:bg-slate-700 rounded" />
                        <div className="space-y-2">
                            <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded" />
                            <div className="h-3 w-2/3 bg-slate-100 dark:bg-slate-800 rounded" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

/**
 * Loading skeleton for notification list
 */
export const NotificationListSkeleton: React.FC<{ items?: number; className?: string }> = ({
    items = 5,
    className,
}) => {
    return (
        <div className={cn("divide-y divide-slate-100 dark:divide-slate-700/50", className)}>
            {Array(items).fill(0).map((_, i) => (
                <div key={i} className="p-4 animate-pulse">
                    <div className="flex gap-4">
                        <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-700 shrink-0" />
                        <div className="flex-1 space-y-2">
                            <div className="h-4 w-1/3 bg-slate-200 dark:bg-slate-700 rounded" />
                            <div className="h-3 w-2/3 bg-slate-100 dark:bg-slate-800 rounded" />
                            <div className="h-3 w-16 bg-slate-100 dark:bg-slate-800 rounded" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

/**
 * Loading skeleton for profile page
 */
export const ProfileSkeleton: React.FC<{ className?: string }> = ({ className }) => {
    return (
        <div className={cn("max-w-2xl mx-auto space-y-6", className)}>
            {/* Header */}
            <div className="animate-pulse space-y-2">
                <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="h-4 w-64 bg-slate-100 dark:bg-slate-800 rounded" />
            </div>

            {/* Profile Card */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 animate-pulse">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-20 h-20 rounded-full bg-slate-200 dark:bg-slate-700" />
                    <div className="space-y-2">
                        <div className="h-6 w-40 bg-slate-200 dark:bg-slate-700 rounded" />
                        <div className="h-4 w-48 bg-slate-100 dark:bg-slate-800 rounded" />
                        <div className="h-3 w-32 bg-slate-100 dark:bg-slate-800 rounded" />
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-10 w-24 bg-slate-100 dark:bg-slate-800 rounded-xl" />
                    ))}
                </div>

                {/* Form fields */}
                <div className="space-y-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="space-y-2">
                            <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
                            <div className="h-12 w-full bg-slate-100 dark:bg-slate-800 rounded-xl" />
                        </div>
                    ))}
                    <div className="h-12 w-full bg-slate-200 dark:bg-slate-700 rounded-xl" />
                </div>
            </div>
        </div>
    );
};
