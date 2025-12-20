import { cn } from '@/lib/utils';

interface ZoomCalendarSkeletonProps {
    className?: string;
}

// Skeleton component that matches the calendar grid structure
export function ZoomCalendarSkeleton({ className }: ZoomCalendarSkeletonProps) {
    const SLOT_HEIGHT = 48;
    const TIME_SLOTS = 12; // 08:00 - 20:00 with 1 hour intervals
    const DAYS = 5; // Mon-Fri

    return (
        <div className={cn("min-w-[800px]", className)}>
            {/* Grid container matching calendar structure */}
            <div
                className="grid"
                style={{
                    gridTemplateColumns: '80px repeat(5, 1fr)',
                    gridTemplateRows: `auto repeat(${TIME_SLOTS}, ${SLOT_HEIGHT}px)`,
                }}
            >
                {/* Header Row - empty corner + day headers */}
                <div className="p-2 border-b border-r bg-muted/50" />
                {Array.from({ length: DAYS }).map((_, i) => (
                    <div
                        key={`header-${i}`}
                        className="p-3 text-center border-b border-r"
                    >
                        <div className="h-4 w-16 mx-auto bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                        <div className="h-3 w-12 mx-auto mt-1 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                    </div>
                ))}

                {/* Time slots */}
                {Array.from({ length: TIME_SLOTS }).map((_, timeIdx) => (
                    <>
                        {/* Time label */}
                        <div
                            key={`time-${timeIdx}`}
                            className="p-2 text-right border-r border-b flex items-center justify-end"
                        >
                            <div className="h-3 w-10 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                        </div>

                        {/* Day cells */}
                        {Array.from({ length: DAYS }).map((_, dayIdx) => (
                            <div
                                key={`cell-${timeIdx}-${dayIdx}`}
                                className="border-r border-b bg-background relative"
                            >
                                {/* Occasional skeleton bookings */}
                                {((timeIdx === 2 && dayIdx === 1) ||
                                    (timeIdx === 5 && dayIdx === 3) ||
                                    (timeIdx === 8 && dayIdx === 0)) && (
                                        <div
                                            className="absolute inset-1 rounded-lg bg-slate-200 dark:bg-slate-700 animate-pulse"
                                            style={{ height: SLOT_HEIGHT * 2 - 8 }}
                                        />
                                    )}
                            </div>
                        ))}
                    </>
                ))}
            </div>
        </div>
    );
}

// Settings page skeleton
export function ZoomSettingsSkeleton() {
    return (
        <div className="space-y-6 animate-pulse">
            {/* Tabs skeleton */}
            <div className="flex gap-2 border-b pb-2">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-10 w-24 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                ))}
            </div>

            {/* Content skeleton */}
            <div className="grid gap-4">
                {/* Account cards */}
                {Array.from({ length: 3 }).map((_, i) => (
                    <div
                        key={i}
                        className="flex items-center gap-4 p-4 bg-white dark:bg-slate-800 rounded-xl border"
                    >
                        <div className="w-4 h-4 rounded-full bg-slate-300 dark:bg-slate-600" />
                        <div className="flex-1 space-y-2">
                            <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
                            <div className="h-3 w-48 bg-slate-100 dark:bg-slate-800 rounded" />
                        </div>
                        <div className="h-6 w-16 bg-slate-200 dark:bg-slate-700 rounded-full" />
                    </div>
                ))}
            </div>
        </div>
    );
}

// Bookings table skeleton
export function ZoomBookingsTableSkeleton() {
    return (
        <div className="space-y-3 animate-pulse">
            {/* Table header */}
            <div className="grid grid-cols-6 gap-4 p-3 bg-muted/50 rounded-lg">
                {['Title', 'Account', 'Date', 'Time', 'Booked By', 'Status'].map((col) => (
                    <div key={col} className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-16" />
                ))}
            </div>

            {/* Table rows */}
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="grid grid-cols-6 gap-4 p-3 border-b">
                    <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
                    <div className="h-4 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
                    <div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
                    <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
                    <div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
                    <div className="h-6 w-16 bg-slate-200 dark:bg-slate-700 rounded-full" />
                </div>
            ))}
        </div>
    );
}
