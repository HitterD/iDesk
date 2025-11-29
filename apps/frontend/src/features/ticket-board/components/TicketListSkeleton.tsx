import { Skeleton } from '@/components/ui/skeleton';

export const TicketListSkeleton = () => {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-9 w-48" />
                    <Skeleton className="h-4 w-64" />
                </div>
                <div className="flex gap-3">
                    <Skeleton className="h-10 w-32 rounded-2xl" />
                    <div className="flex gap-1">
                        <Skeleton className="h-10 w-10 rounded-xl" />
                        <Skeleton className="h-10 w-10 rounded-xl" />
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="bg-white dark:bg-slate-800 rounded-xl px-4 py-3 border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-3">
                            <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
                            <div className="min-w-0 flex-1 space-y-1">
                                <Skeleton className="h-6 w-12" />
                                <Skeleton className="h-3 w-16" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Search & Filters */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
                <div className="flex flex-wrap items-center gap-4">
                    <Skeleton className="flex-1 h-12 rounded-xl min-w-[250px]" />
                    <Skeleton className="h-12 w-32 rounded-xl" />
                    <Skeleton className="h-12 w-32 rounded-xl" />
                </div>
            </div>

            {/* Tickets List */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                {/* Table Header */}
                <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                    <div className="col-span-4"><Skeleton className="h-4 w-16" /></div>
                    <div className="col-span-2"><Skeleton className="h-4 w-20" /></div>
                    <div className="col-span-2"><Skeleton className="h-4 w-16" /></div>
                    <div className="col-span-2"><Skeleton className="h-4 w-20" /></div>
                    <div className="col-span-2"><Skeleton className="h-4 w-12" /></div>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {[...Array(8)].map((_, i) => (
                        <div key={i} className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 px-4 py-3 items-center">
                            {/* Ticket Info */}
                            <div className="col-span-4 flex items-center gap-3 min-w-0">
                                <Skeleton className="w-2.5 h-2.5 rounded-full shrink-0" />
                                <div className="min-w-0 flex-1 space-y-1">
                                    <div className="flex items-center gap-2">
                                        <Skeleton className="h-3 w-16" />
                                        <Skeleton className="h-4 w-12 rounded" />
                                        <Skeleton className="h-4 w-16 rounded" />
                                    </div>
                                    <Skeleton className="h-5 w-3/4" />
                                </div>
                            </div>

                            {/* Requester */}
                            <div className="col-span-2 flex items-center gap-2 min-w-0">
                                <Skeleton className="w-6 h-6 rounded-full shrink-0" />
                                <div className="min-w-0 hidden md:block space-y-1">
                                    <Skeleton className="h-3 w-24" />
                                    <Skeleton className="h-2 w-16" />
                                </div>
                            </div>

                            {/* Status */}
                            <div className="col-span-2">
                                <Skeleton className="h-6 w-24 rounded-lg" />
                            </div>

                            {/* Assigned To */}
                            <div className="col-span-2 flex items-center gap-2">
                                <Skeleton className="w-6 h-6 rounded-full shrink-0" />
                                <Skeleton className="h-3 w-24 hidden lg:block" />
                            </div>

                            {/* Date & Actions */}
                            <div className="col-span-2 flex items-center justify-between gap-2">
                                <Skeleton className="h-3 w-20" />
                                <Skeleton className="w-4 h-4 rounded-full" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
