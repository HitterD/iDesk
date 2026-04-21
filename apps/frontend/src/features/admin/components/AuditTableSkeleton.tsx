import { motion } from 'framer-motion';

interface AuditTableSkeletonProps {
    rows?: number;
}

export function AuditTableSkeleton({ rows = 5 }: AuditTableSkeletonProps) {
    return (
        <div className="overflow-hidden">
            {/* Header Skeleton */}
            <div className="border-b border-[hsl(var(--border))] px-5 py-3 flex gap-6">
                <div className="w-6 h-3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                <div className="w-24 h-3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                <div className="w-32 h-3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                <div className="w-28 h-3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                <div className="w-20 h-3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                <div className="flex-1 h-3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                <div className="w-24 h-3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            </div>

            {/* Rows Skeleton */}
            <div>
                {Array.from({ length: rows }).map((_, index) => (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.05 }}
                        className={`px-5 py-3.5 flex items-center gap-6 ${index !== rows - 1 ? 'border-b border-[hsl(var(--border))]' : ''}`}
                    >
                        {/* Expand Icon */}
                        <div className="w-3.5 h-3.5 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />

                        {/* Timestamp */}
                        <div className="w-28 h-3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />

                        {/* User */}
                        <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
                            <div className="space-y-1">
                                <div className="w-20 h-3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                                <div className="w-28 h-2 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                            </div>
                        </div>

                        {/* Action */}
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                            <div className="w-20 h-3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                        </div>

                        {/* Entity */}
                        <div className="flex items-center gap-2">
                            <div className="w-14 h-5 bg-[hsl(var(--primary))]/10 rounded-md animate-pulse" />
                            <div className="w-14 h-5 bg-slate-100 dark:bg-slate-800 rounded-md animate-pulse" />
                        </div>

                        {/* Description */}
                        <div className="flex-1 h-3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />

                        {/* IP Address */}
                        <div className="w-20 h-3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
