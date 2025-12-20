import React from 'react';

/**
 * Skeleton loading component for the Ticket Detail page
 * Displays a content-aware skeleton that matches the actual layout
 */
export const TicketDetailSkeleton: React.FC = () => {
    return (
        <div className="space-y-6 min-h-screen animate-pulse">
            {/* Header Skeleton */}
            <div className="flex items-center justify-between p-4 glass-card">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-xl" />
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <div className="w-24 h-5 bg-slate-200 dark:bg-slate-700 rounded" />
                            <div className="w-16 h-5 bg-slate-200 dark:bg-slate-700 rounded-full" />
                            <div className="w-14 h-5 bg-slate-200 dark:bg-slate-700 rounded-full" />
                        </div>
                        <div className="w-64 h-6 bg-slate-200 dark:bg-slate-700 rounded" />
                    </div>
                </div>
                <div className="w-32 h-10 bg-primary/20 rounded-xl" />
            </div>

            {/* 3-Column Layout Skeleton */}
            <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-180px)]">
                {/* Left Column: SLA + Sidebar */}
                <div className="w-full lg:w-1/4 space-y-4">
                    {/* SLA Status Card Skeleton */}
                    <div className="glass-card p-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
                            <div className="w-20 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
                        </div>
                        <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl space-y-2">
                            <div className="w-24 h-3 bg-slate-200 dark:bg-slate-700 rounded" />
                            <div className="w-20 h-6 bg-slate-200 dark:bg-slate-700 rounded" />
                            <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full" />
                        </div>
                        <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl space-y-2">
                            <div className="w-20 h-3 bg-slate-200 dark:bg-slate-700 rounded" />
                            <div className="w-32 h-5 bg-slate-200 dark:bg-slate-700 rounded" />
                        </div>
                    </div>

                    {/* Assignment Section Skeleton */}
                    <div className="glass-card p-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
                            <div className="w-24 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
                        </div>
                        <div className="w-full h-10 bg-slate-100 dark:bg-slate-800 rounded-lg" />
                    </div>

                    {/* Properties Section Skeleton */}
                    <div className="glass-card p-4 space-y-4">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
                            <div className="w-20 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
                        </div>
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="space-y-2">
                                <div className="w-16 h-3 bg-slate-200 dark:bg-slate-700 rounded" />
                                <div className="w-full h-10 bg-slate-100 dark:bg-slate-800 rounded-lg" />
                            </div>
                        ))}
                    </div>

                    {/* Requester Section Skeleton */}
                    <div className="glass-card p-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
                            <div className="w-20 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-full" />
                            <div className="space-y-2">
                                <div className="w-32 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
                                <div className="w-40 h-3 bg-slate-200 dark:bg-slate-700 rounded" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Middle Column: Chat */}
                <div className="flex-1 glass-card overflow-hidden flex flex-col">
                    {/* Chat Header */}
                    <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                            <div className="w-32 h-5 bg-slate-200 dark:bg-slate-700 rounded" />
                        </div>
                        <div className="flex gap-2">
                            <div className="w-16 h-6 bg-slate-200 dark:bg-slate-700 rounded-full" />
                            <div className="w-20 h-6 bg-slate-200 dark:bg-slate-700 rounded-full" />
                        </div>
                    </div>

                    {/* Chat Messages Skeleton */}
                    <div className="flex-1 p-4 space-y-4">
                        {/* Message 1 - Left */}
                        <div className="flex gap-3">
                            <div className="w-9 h-9 bg-slate-200 dark:bg-slate-700 rounded-full shrink-0" />
                            <div className="max-w-[60%] space-y-2">
                                <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl space-y-2">
                                    <div className="w-48 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
                                    <div className="w-32 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
                                </div>
                                <div className="flex gap-2">
                                    <div className="w-16 h-3 bg-slate-200 dark:bg-slate-700 rounded" />
                                    <div className="w-12 h-3 bg-slate-200 dark:bg-slate-700 rounded" />
                                </div>
                            </div>
                        </div>

                        {/* Message 2 - Right */}
                        <div className="flex gap-3 flex-row-reverse">
                            <div className="w-9 h-9 bg-primary/20 rounded-full shrink-0" />
                            <div className="max-w-[60%] space-y-2">
                                <div className="p-4 bg-primary/20 rounded-2xl space-y-2">
                                    <div className="w-56 h-4 bg-primary/30 rounded" />
                                    <div className="w-40 h-4 bg-primary/30 rounded" />
                                    <div className="w-24 h-4 bg-primary/30 rounded" />
                                </div>
                                <div className="flex gap-2 justify-end">
                                    <div className="w-16 h-3 bg-slate-200 dark:bg-slate-700 rounded" />
                                    <div className="w-12 h-3 bg-slate-200 dark:bg-slate-700 rounded" />
                                </div>
                            </div>
                        </div>

                        {/* Message 3 - Left */}
                        <div className="flex gap-3">
                            <div className="w-9 h-9 bg-slate-200 dark:bg-slate-700 rounded-full shrink-0" />
                            <div className="max-w-[60%] space-y-2">
                                <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl">
                                    <div className="w-36 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Chat Input Skeleton */}
                    <div className="p-4 border-t border-slate-200 dark:border-slate-700">
                        <div className="flex gap-3">
                            <div className="flex-1 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl" />
                            <div className="w-12 h-12 bg-primary/20 rounded-xl" />
                        </div>
                    </div>
                </div>

                {/* Right Column: History (Hidden on smaller screens) */}
                <div className="hidden xl:flex w-1/4 flex-col">
                    <div className="glass-card p-4 space-y-4 flex-1">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
                            <div className="w-28 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
                        </div>
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="flex gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                                <div className="w-2 h-2 bg-slate-200 dark:bg-slate-700 rounded-full mt-1.5 shrink-0" />
                                <div className="space-y-2 flex-1">
                                    <div className="w-full h-4 bg-slate-200 dark:bg-slate-700 rounded" />
                                    <div className="w-20 h-3 bg-slate-200 dark:bg-slate-700 rounded" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TicketDetailSkeleton;
