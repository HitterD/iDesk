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
            <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0 sm:grid sm:grid-cols-3 lg:grid-cols-6 sm:gap-3 lg:gap-4">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="bg-card rounded-xl p-3 sm:p-4 border border-border shrink-0 min-w-[125px] sm:min-w-0">
                        <div className="flex items-center justify-between gap-2">
                            <div className="space-y-1.5 flex-1">
                                <Skeleton className="h-3 w-12" />
                                <Skeleton className="h-7 w-10" />
                            </div>
                            <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
                        </div>
                    </div>
                ))}
            </div>

            {/* Search & Filters */}
            <div className="bg-card rounded-2xl p-2 sm:p-3 border border-border">
                <div className="flex flex-col lg:flex-row items-center gap-3">
                    <Skeleton className="w-full lg:flex-1 h-10 rounded-xl" />
                    <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto">
                        <Skeleton className="h-10 w-28 rounded-xl shrink-0" />
                        <Skeleton className="h-10 w-28 rounded-xl shrink-0" />
                        <Skeleton className="h-10 w-24 rounded-xl shrink-0" />
                    </div>
                </div>
            </div>

            {/* Tickets List */}
            <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-xs">
                {/* Table Header */}
                <div className="hidden lg:grid grid-cols-[32px_minmax(280px,2fr)_112px_80px_144px_minmax(120px,1fr)_minmax(140px,1fr)_minmax(100px,1fr)_80px] gap-4 px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-border">
                    <div></div> {/* Checkbox */}
                    <div><Skeleton className="h-4 w-16" /></div>
                    <div><Skeleton className="h-4 w-16" /></div>
                    <div><Skeleton className="h-4 w-10" /></div>
                    <div><Skeleton className="h-4 w-20" /></div>
                    <div><Skeleton className="h-4 w-20" /></div>
                    <div><Skeleton className="h-4 w-24" /></div>
                    <div><Skeleton className="h-4 w-20" /></div>
                    <div><Skeleton className="h-4 w-12" /></div>
                </div>

                <div className="divide-y divide-border/80">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="transition-colors">
                            {/* Mobile Card Skeleton (< lg) */}
                            <div className="block lg:hidden p-3.5 space-y-2.5">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <Skeleton className="w-2 h-2 rounded-full" />
                                        <Skeleton className="h-4 w-24 rounded" />
                                        <Skeleton className="h-4 w-10 rounded" />
                                    </div>
                                    <Skeleton className="h-4 w-16 rounded" />
                                </div>
                                <div className="space-y-1.5 py-0.5">
                                    <Skeleton className="h-4 w-5/6" />
                                    <Skeleton className="h-4 w-3/5" />
                                </div>
                                <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-border/50">
                                    <div className="flex items-center gap-1.5">
                                        <Skeleton className="h-7 w-20 rounded-lg" />
                                        <Skeleton className="h-7 w-16 rounded-lg" />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Skeleton className="w-5 h-5 rounded-full" />
                                        <Skeleton className="w-5 h-5 rounded-full" />
                                    </div>
                                </div>
                            </div>

                            {/* Desktop Row Skeleton (>= lg) */}
                            <div className="hidden lg:grid grid-cols-[32px_minmax(280px,2fr)_112px_80px_144px_minmax(120px,1fr)_minmax(140px,1fr)_minmax(100px,1fr)_80px] gap-4 px-4 py-3.5 items-center">
                                {/* Checkbox */}
                                <div className="w-8 shrink-0">
                                    <Skeleton className="w-4 h-4 rounded" />
                                </div>

                                {/* Ticket Info */}
                                <div className="flex items-center gap-3 min-w-0 w-full">
                                    <Skeleton className="w-2 h-2 rounded-full shrink-0" />
                                    <div className="min-w-0 flex-1 space-y-1">
                                        <Skeleton className="h-3 w-28" />
                                        <Skeleton className="h-4 w-4/5" />
                                    </div>
                                </div>

                                {/* Priority */}
                                <div><Skeleton className="h-7 w-20 rounded-lg" /></div>

                                {/* Site */}
                                <div><Skeleton className="h-6 w-12 rounded-md" /></div>

                                {/* Status */}
                                <div><Skeleton className="h-7 w-24 rounded-lg" /></div>

                                {/* Requester */}
                                <div className="flex items-center gap-2 min-w-0">
                                    <Skeleton className="w-7 h-7 rounded-full shrink-0" />
                                    <div className="space-y-1 flex-1 min-w-0">
                                        <Skeleton className="h-3 w-16" />
                                    </div>
                                </div>

                                {/* Assigned To */}
                                <div className="flex items-center gap-2">
                                    <Skeleton className="h-8 w-28 rounded-lg" />
                                </div>

                                {/* Target Date */}
                                <div><Skeleton className="h-4 w-16" /></div>

                                {/* Date & Actions */}
                                <div className="flex items-center justify-between gap-2">
                                    <Skeleton className="h-3 w-14" />
                                    <Skeleton className="w-4 h-4 rounded" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
