import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar } from 'lucide-react';
import { useHardwareRequest } from '../hooks/useHardwareRequest';
import { useHardwareRequestRealtime } from '../hooks/useHardwareRequestRealtime';
import { useHardwareRole } from '../hooks/usePermissions';
import { capsFor } from '../utils/permission.util';
import { StatusBadge } from '../components/common/StatusBadge';
import { StatusPipeline } from '../components/common/StatusPipeline';
import { RequestInfoCard } from '../components/detail/RequestInfoCard';
import { ItemsCard } from '../components/detail/ItemsCard';
import { CommentThread } from '../components/detail/CommentThread';
import { ActivityTimeline } from '../components/detail/ActivityTimeline';
import { ActionPanel } from '../components/detail/ActionPanel';
import { ProcurementPanel } from '../components/procurement/ProcurementPanel';
import { HardwareRequestsBreadcrumb } from '../components/common/HardwareRequestsBreadcrumb';
import { useHardwareBasePath } from '../hooks/useHardwareBasePath';

export default function HardwareRequestDetailPage() {
    const { id } = useParams<{ id: string }>();
    const { data: r, isLoading, isError } = useHardwareRequest(id);
    const { userId, role } = useHardwareRole();
    const basePath = useHardwareBasePath();
    useHardwareRequestRealtime(id);

    if (isLoading) return <DetailSkeleton />;
    if (isError || !r) return <div className="max-w-7xl mx-auto p-6 text-sm text-rose-600">Gagal memuat request.</div>;

    const caps = capsFor({ id: userId, role }, r);

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8 animate-fade-in-up">
            <HardwareRequestsBreadcrumb currentLabel={`#${r.requestNumber}`} />
            
            <motion.header
                initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-2 border-b border-slate-100 dark:border-slate-800">
                <div>
                    <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-semibold tracking-wider text-slate-500 dark:text-slate-400">{r.requestNumber}</span>
                        <StatusBadge status={r.status} size="md" />
                    </div>
                    <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                        {r.items.length} item{r.items.length > 1 ? 's' : ''} <span className="text-slate-300 dark:text-slate-600 mx-2">•</span> {r.site?.name}
                    </h1>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <Link to={`${basePath}/calendar`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 px-4 py-2 text-sm font-bold transition-all shadow-sm w-full sm:w-auto">
                        <Calendar className="size-4" />
                        Jadwal Kalender
                    </Link>
                </div>
            </motion.header>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1, duration: 0.5 }}>
                <StatusPipeline current={r.status} />
            </motion.div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }} className="space-y-6">
                    <RequestInfoCard r={r} />
                    <ItemsCard r={r} />
                    <CommentThread requestId={r.id} canComment={caps.canComment} />
                </motion.div>
                <motion.aside initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.5 }} className="space-y-6">
                    <ActionPanel r={r} />
                    <ActivityTimeline requestId={r.id} />
                </motion.aside>
            </div>
        </div>
    );
}

function DetailSkeleton() {
    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">
            <div className="h-8 w-72 bg-slate-100 animate-pulse rounded-lg" />
            <div className="h-14 bg-slate-100 animate-pulse rounded-2xl" />
            <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-4">
                <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-32 bg-slate-100 animate-pulse rounded-2xl" />)}
                </div>
                <div className="space-y-4">
                    {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-32 bg-slate-100 animate-pulse rounded-2xl" />)}
                </div>
            </div>
        </div>
    );
}
