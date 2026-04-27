import { useParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, Cpu } from 'lucide-react';
import { useHardwareRequest } from '../hooks/useHardwareRequest';
import { useHardwareRequestRealtime } from '../hooks/useHardwareRequestRealtime';
import { useHardwareRole } from '../hooks/usePermissions';
import { capsFor } from '../utils/permission.util';
import { getStatusMeta } from '../utils/status.util';
import { StatusBadge } from '../components/common/StatusBadge';
import { StatusPipeline } from '../components/common/StatusPipeline';
import { RequestInfoCard } from '../components/detail/RequestInfoCard';
import { ItemsCard } from '../components/detail/ItemsCard';
import { CommentThread } from '../components/detail/CommentThread';
import { ActivityTimeline } from '../components/detail/ActivityTimeline';
import { ActionPanel } from '../components/detail/ActionPanel';
import { ProcurementPanel } from '../components/procurement/ProcurementPanel';
import { useHardwareBasePath } from '../hooks/useHardwareBasePath';

export default function HardwareRequestDetailPage() {
    const { id } = useParams<{ id: string }>();
    const { data: r, isLoading, isError } = useHardwareRequest(id);
    const { userId, role } = useHardwareRole();
    const basePath = useHardwareBasePath();
    useHardwareRequestRealtime(id);

    if (isLoading) return <DetailSkeleton />;
    if (isError || !r) {
        return (
            <div className="max-w-7xl mx-auto p-6 text-sm text-rose-600 dark:text-rose-400">
                Gagal memuat request.
            </div>
        );
    }

    const caps = capsFor({ id: userId, role }, r);
    const meta = getStatusMeta(r.status);

    return (
        <div className="max-w-7xl mx-auto px-0 sm:px-2 pb-12 animate-fade-in-up">

            {/* ── STICKY HEADER ── */}
            <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
                className="sticky top-0 z-10 bg-[hsl(var(--background))]/95 backdrop-blur-md py-3 -mx-4 sm:-mx-6 px-4 sm:px-6 border-b border-slate-200 dark:border-slate-700/60 mb-6"
            >
                <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
                    {/* Back + title */}
                    <div className="flex items-center gap-3 min-w-0">
                        <Link
                            to={basePath}
                            className="flex items-center justify-center size-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all shrink-0"
                        >
                            <ArrowLeft className="size-4" />
                        </Link>

                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="size-7 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center shrink-0">
                                <Cpu className="size-3.5 text-primary" />
                            </div>
                            <span className="font-mono text-[13px] font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                                {r.requestNumber}
                            </span>
                            <span className="text-slate-300 dark:text-slate-600 shrink-0">·</span>
                            <h1 className="text-[14px] font-bold text-slate-900 dark:text-white truncate">
                                {r.items.length} item{r.items.length > 1 ? 's' : ''}
                                <span className="text-slate-400 dark:text-slate-500 font-normal mx-1.5">di</span>
                                {r.site?.name}
                            </h1>
                        </div>
                    </div>

                    {/* Status + calendar */}
                    <div className="flex items-center gap-2 shrink-0">
                        <StatusBadge status={r.status} size="md" />
                        <Link
                            to={`${basePath}/calendar`}
                            className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-[12px] font-bold transition-all"
                        >
                            <Calendar className="size-3.5" />
                            Jadwal
                        </Link>
                    </div>
                </div>
            </motion.div>

            {/* ── STATUS PIPELINE ── */}
            <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05, duration: 0.4 }}
                className="mb-6 bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl p-4 shadow-sm overflow-x-auto"
                style={{ borderLeft: `3px solid ${meta.hex}` }}
            >
                <StatusPipeline current={r.status} />
            </motion.div>

            {/* ── MAIN SPLIT LAYOUT ── */}
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">

                {/* Left: main content */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.4 }}
                    className="space-y-5"
                >
                    <RequestInfoCard r={r} />
                    <ItemsCard r={r} />
                    <CommentThread requestId={r.id} canComment={caps.canComment} />
                </motion.div>

                {/* Right: sticky sidebar */}
                <motion.aside
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.18, duration: 0.4 }}
                    className="space-y-5"
                >
                    {/* Glassmorphism sidebar wrapper */}
                    <div
                        className="lg:sticky lg:top-[88px] space-y-5"
                    >
                        {/* Action Panel */}
                        <div
                            className="rounded-2xl border overflow-hidden"
                            style={{
                                borderColor: `${meta.hex}30`,
                                background: 'hsl(var(--card))',
                                boxShadow: `0 0 0 1px ${meta.hex}14, 0 8px 32px -8px ${meta.hex}18`,
                            }}
                        >
                            {/* Status accent bar */}
                            <div
                                className="h-0.5 w-full"
                                style={{ background: `linear-gradient(90deg, ${meta.hex}, ${meta.hex}30)` }}
                            />
                            <div className="p-4">
                                <ActionPanel r={r} />
                            </div>
                        </div>

                        {/* Activity timeline */}
                        <ActivityTimeline requestId={r.id} />
                    </div>
                </motion.aside>
            </div>
        </div>
    );
}

function DetailSkeleton() {
    return (
        <div className="max-w-7xl mx-auto px-2 py-6 space-y-4 animate-pulse">
            {/* Header skeleton */}
            <div className="h-12 bg-slate-100 dark:bg-slate-800 rounded-2xl" />
            {/* Pipeline skeleton */}
            <div className="h-20 bg-slate-100 dark:bg-slate-800 rounded-2xl" />
            {/* Content skeleton */}
            <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-4">
                <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-36 bg-slate-100 dark:bg-slate-800 rounded-2xl" />
                    ))}
                </div>
                <div className="space-y-4">
                    {Array.from({ length: 2 }).map((_, i) => (
                        <div key={i} className="h-32 bg-slate-100 dark:bg-slate-800 rounded-2xl" />
                    ))}
                </div>
            </div>
        </div>
    );
}
