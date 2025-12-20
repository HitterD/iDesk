import { motion } from 'framer-motion';

interface AuditTableSkeletonProps {
    rows?: number;
}

export function AuditTableSkeleton({ rows = 5 }: AuditTableSkeletonProps) {
    return (
        <div className="overflow-hidden">
            {/* Header Skeleton */}
            <div className="bg-slate-50 dark:bg-slate-900/50 px-6 py-4 flex gap-6">
                <div className="w-6 h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                <div className="w-24 h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                <div className="w-32 h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                <div className="w-28 h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                <div className="w-20 h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                <div className="flex-1 h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                <div className="w-24 h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            </div>

            {/* Rows Skeleton */}
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {Array.from({ length: rows }).map((_, index) => (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.05 }}
                        className="px-6 py-4 flex items-center gap-6"
                    >
                        {/* Expand Icon */}
                        <div className="w-4 h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />

                        {/* Timestamp */}
                        <div className="w-32 h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />

                        {/* User */}
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
                            <div className="space-y-1">
                                <div className="w-24 h-3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                                <div className="w-32 h-2 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                            </div>
                        </div>

                        {/* Action */}
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                            <div className="w-20 h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                        </div>

                        {/* Entity */}
                        <div className="flex items-center gap-2">
                            <div className="w-16 h-6 bg-violet-100 dark:bg-violet-900/30 rounded-lg animate-pulse" />
                            <div className="w-16 h-5 bg-slate-100 dark:bg-slate-700 rounded animate-pulse" />
                        </div>

                        {/* Description */}
                        <div className="flex-1 h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />

                        {/* IP Address */}
                        <div className="w-20 h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
