import { Skeleton } from "@/components/ui/skeleton";

export const DashboardSkeleton = () => {
    return (
        <div className="min-h-0 h-auto lg:h-[calc(100vh-2rem)] flex flex-col gap-6 animate-pulse overflow-y-auto custom-scrollbar -m-2 p-2 pb-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-64" />
                </div>
                <div className="flex gap-3">
                    <Skeleton className="h-10 w-10 rounded-xl" />
                    <Skeleton className="h-10 w-36 rounded-xl" />
                    <Skeleton className="h-10 w-32 rounded-xl" />
                </div>
            </div>

            {/* Asymmetric 2-Row Grid Skeleton */}
            <div className="flex flex-col gap-6">
                
                {/* Row 1: Summary Stats */}
                <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                    {/* 3 Large Stat Panels */}
                    <div className="xl:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="p-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 flex flex-col justify-between h-[120px]">
                                <div className="flex justify-between items-start mb-4">
                                    <Skeleton className="h-4 w-24" />
                                    <Skeleton className="h-5 w-12 rounded-full" />
                                </div>
                                <div>
                                    <Skeleton className="h-10 w-20 mb-2" />
                                    <Skeleton className="h-4 w-32" />
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    {/* 3 Compact Panels */}
                    <div className="xl:col-span-1 flex flex-col gap-4">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="flex-1 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex items-center justify-between h-[70px]">
                                <div className="flex items-center gap-3 w-full">
                                    <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
                                    <div className="space-y-2 flex-1">
                                        <Skeleton className="h-3 w-20" />
                                        <Skeleton className="h-5 w-12" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                
                {/* Row 2: Charts and Details */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column: Weekly Activity Chart */}
                    <div className="lg:col-span-2 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 min-h-[250px] flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <div className="space-y-2">
                                <Skeleton className="h-6 w-40" />
                                <Skeleton className="h-4 w-64" />
                            </div>
                            <Skeleton className="h-9 w-32 rounded-xl" />
                        </div>
                        <Skeleton className="flex-1 w-full rounded-t-sm" />
                    </div>

                    {/* Right Column: Ticket Breakdown/Donut */}
                    <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl min-h-[250px] flex flex-col">
                        <div className="p-1.5 border-b border-slate-200 dark:border-slate-700 flex gap-2">
                            <Skeleton className="flex-1 h-8 rounded-lg" />
                            <Skeleton className="flex-1 h-8 rounded-lg" />
                            <Skeleton className="flex-1 h-8 rounded-lg" />
                        </div>
                        <div className="flex-1 flex items-center justify-center gap-6 p-5">
                            <Skeleton className="h-28 w-28 rounded-full" />
                            <div className="space-y-3 flex-1 max-w-[150px]">
                                {[...Array(4)].map((_, j) => (
                                    <div key={j} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Skeleton className="h-2.5 w-2.5 rounded shrink-0" />
                                            <Skeleton className="h-3 w-16" />
                                        </div>
                                        <Skeleton className="h-3 w-6" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Row 3: Activity & Top Agents */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Details/Feed */}
                    <div className="lg:col-span-2 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl min-h-[300px] flex flex-col">
                        <div className="p-1.5 border-b border-slate-200 dark:border-slate-700 flex gap-2">
                            <Skeleton className="flex-1 h-9 rounded-lg" />
                            <Skeleton className="flex-1 h-9 rounded-lg" />
                        </div>
                        <div className="flex-1 p-4 space-y-4">
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="flex gap-4">
                                    <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                                    <div className="space-y-2 flex-1">
                                        <Skeleton className="h-4 w-1/3" />
                                        <Skeleton className="h-3 w-1/2" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    {/* Top Agents */}
                    <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl min-h-[300px] p-6 flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <Skeleton className="h-5 w-24" />
                            <Skeleton className="h-4 w-16" />
                        </div>
                        <div className="flex-1 space-y-4">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="flex items-center gap-4">
                                    <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                                    <div className="space-y-2 flex-1">
                                        <Skeleton className="h-4 w-24" />
                                        <Skeleton className="h-3 w-32" />
                                    </div>
                                    <Skeleton className="h-6 w-6 rounded-full shrink-0" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
