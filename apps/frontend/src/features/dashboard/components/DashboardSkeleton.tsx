import { Skeleton } from "@/components/ui/skeleton";

export const DashboardSkeleton = () => {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-64" />
                </div>
                <div className="flex gap-3">
                    <Skeleton className="h-10 w-32 rounded-xl" />
                    <Skeleton className="h-10 w-32 rounded-xl" />
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
                        <div className="flex items-start justify-between mb-3">
                            <Skeleton className="h-10 w-10 rounded-xl" />
                        </div>
                        <Skeleton className="h-8 w-16 mb-2" />
                        <Skeleton className="h-4 w-24" />
                    </div>
                ))}
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Charts */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Weekly Activity Chart */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div className="space-y-2">
                                <Skeleton className="h-6 w-32" />
                                <Skeleton className="h-4 w-48" />
                            </div>
                        </div>
                        <Skeleton className="h-32 w-full" />
                    </div>

                    {/* Status & Priority Charts */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[...Array(2)].map((_, i) => (
                            <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
                                <Skeleton className="h-6 w-32 mb-4" />
                                <div className="flex items-center gap-6">
                                    <Skeleton className="h-32 w-32 rounded-full" />
                                    <div className="space-y-2 flex-1">
                                        {[...Array(4)].map((_, j) => (
                                            <div key={j} className="flex items-center justify-between">
                                                <Skeleton className="h-4 w-20" />
                                                <Skeleton className="h-4 w-8" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Recent Tickets */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                            <Skeleton className="h-6 w-32" />
                            <Skeleton className="h-4 w-16" />
                        </div>
                        <div className="divide-y divide-slate-100 dark:divide-slate-700">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="px-6 py-4">
                                    <div className="flex items-start gap-4">
                                        <div className="flex-1 min-w-0 space-y-2">
                                            <div className="flex items-center gap-2">
                                                <Skeleton className="h-2 w-2 rounded-full" />
                                                <Skeleton className="h-3 w-16" />
                                            </div>
                                            <Skeleton className="h-5 w-3/4" />
                                            <Skeleton className="h-4 w-1/2" />
                                        </div>
                                        <Skeleton className="h-6 w-20 rounded-full" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Column - Stats & Info */}
                <div className="space-y-6">
                    {/* SLA Compliance */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
                        <Skeleton className="h-6 w-40 mb-4" />
                        <div className="flex items-center gap-4">
                            <Skeleton className="h-24 w-24 rounded-full" />
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-4 w-24" />
                            </div>
                        </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
                        <Skeleton className="h-6 w-40 mb-4" />
                        <div className="space-y-4">
                            {[...Array(3)].map((_, i) => (
                                <div key={i} className="flex items-center justify-between">
                                    <Skeleton className="h-4 w-16" />
                                    <Skeleton className="h-4 w-32" />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Top Agents */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
                        <Skeleton className="h-6 w-32 mb-4" />
                        <div className="space-y-3">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <Skeleton className="h-8 w-8 rounded-full" />
                                    <div className="flex-1 space-y-1">
                                        <Skeleton className="h-4 w-32" />
                                        <Skeleton className="h-3 w-24" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Categories */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
                        <Skeleton className="h-6 w-32 mb-4" />
                        <div className="space-y-2">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="flex items-center justify-between">
                                    <Skeleton className="h-4 w-24" />
                                    <Skeleton className="h-4 w-8" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
