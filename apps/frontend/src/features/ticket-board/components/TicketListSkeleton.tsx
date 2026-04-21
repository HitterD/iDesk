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
                    <div key={i} className="bg-white dark:bg-[hsl(var(--card))] rounded-xl px-4 py-3 border border-[hsl(var(--border))]">
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
            <div className="bg-white dark:bg-[hsl(var(--card))] rounded-xl p-4 border border-[hsl(var(--border))]">
                <div className="flex flex-wrap items-center gap-4">
                    <Skeleton className="flex-1 h-12 rounded-xl min-w-[250px]" />
                    <Skeleton className="h-12 w-32 rounded-xl" />
                    <Skeleton className="h-12 w-32 rounded-xl" />
                </div>
            </div>

            {/* Tickets List */}
            <div className="bg-white dark:bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] overflow-hidden">
                {/* Table Header */}
                <div className="hidden lg:grid grid-cols-[32px_minmax(280px,2fr)_112px_80px_144px_minmax(120px,1fr)_minmax(140px,1fr)_minmax(100px,1fr)_80px] gap-4 px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-[hsl(var(--border))] border-l-4 border-l-transparent">
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

                <div className="divide-y divide-[hsl(var(--border))]">
                    {[...Array(8)].map((_, i) => (
                        <div key={i} className="flex flex-col lg:grid lg:grid-cols-[32px_minmax(280px,2fr)_112px_80px_144px_minmax(120px,1fr)_minmax(140px,1fr)_minmax(100px,1fr)_80px] gap-2 lg:gap-4 px-4 py-4 items-center border-l-4 border-l-transparent">
                            {/* Checkbox */}
                            <div className="hidden lg:block w-8 shrink-0">
                                <Skeleton className="w-4 h-4 rounded" />
                            </div>

                            {/* Ticket Info */}
                            <div className="flex items-center gap-3 min-w-0 w-full">
                                <Skeleton className="w-1.5 h-12 rounded-full shrink-0" />
                                <div className="min-w-0 flex-1 space-y-2">
                                    <Skeleton className="h-3 w-32" />
                                    <Skeleton className="h-5 w-3/4" />
                                </div>
                            </div>

                            {/* Priority */}
                            <div className="hidden lg:block"><Skeleton className="h-6 w-20 rounded-full" /></div>

                            {/* Site */}
                            <div className="hidden lg:block"><Skeleton className="h-6 w-12 rounded-lg" /></div>

                            {/* Status */}
                            <div className="hidden lg:block"><Skeleton className="h-6 w-24 rounded-full" /></div>

                            {/* Requester */}
                            <div className="hidden lg:flex items-center gap-2 min-w-0">
                                <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                                <div className="space-y-1">
                                    <Skeleton className="h-3 w-20" />
                                </div>
                            </div>

                            {/* Assigned To */}
                            <div className="hidden lg:flex items-center gap-2">
                                <Skeleton className="w-6 h-6 rounded-full shrink-0" />
                                <Skeleton className="h-3 w-24" />
                            </div>

                            {/* Target Date */}
                            <div className="hidden lg:block"><Skeleton className="h-4 w-24" /></div>

                            {/* Date & Actions */}
                            <div className="hidden lg:flex items-center justify-between gap-2">
                                <Skeleton className="h-3 w-16" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
