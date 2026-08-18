import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, LayoutGrid, List as ListIcon, Cpu, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useHardwareRequestList } from '../hooks/useHardwareRequestList';
import { useHardwareRole } from '../hooks/usePermissions';
import { useHardwareGlobalRealtime } from '../hooks/useHardwareRequestRealtime';
import { RequestFilters } from '../components/list/RequestFilters';
import { RequestTable } from '../components/list/RequestTable';
import { RequestCard } from '../components/list/RequestCard';
import { RequestListSkeleton } from '../components/list/RequestListSkeleton';
import { EmptyState } from '../components/common/EmptyState';
import { useHardwareBasePath } from '../hooks/useHardwareBasePath';
import type { ListFilters } from '../types';

export default function HardwareRequestListPage() {
    const { role } = useHardwareRole();
    const basePath = useHardwareBasePath();
    useHardwareGlobalRealtime();

    const defaults: ListFilters = useMemo(
        () => ({ page: 1, pageSize: 20, scope: role === 'USER' ? 'my' : 'all' }),
        [role],
    );

    const [filters, setFilters] = useState<ListFilters>(defaults);
    const [view, setView] = useState<'table' | 'card'>('table');
    const { data, isLoading, isFetching } = useHardwareRequestList(filters);

    return (
        <div className="flex flex-col gap-0 animate-fade-in-up pb-8">
            {/* ── COMMAND BAR ── */}
            <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
                className="sticky top-0 z-10 bg-[hsl(var(--background))]/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-700/80 -mx-4 sm:-mx-6 px-4 sm:px-6 pb-0"
            >
                {/* Top row: page title + actions */}
                <div className="flex items-center justify-between gap-3 py-3">
                    <div className="flex items-center gap-2.5">
                        <div className="size-8 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center shrink-0">
                            <Cpu className="size-4 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-foreground tracking-tight leading-none flex items-center gap-2">
                                Hardware Requests
                                <span className="live-indicator" title="Live sync active" />
                            </h1>
                            <p className="text-xs text-muted-foreground mt-1">
                                Kelola permintaan, jadwal instalasi, monitoring pengiriman
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* View toggle */}
                        <div className="hidden md:flex rounded-xl bg-slate-100 dark:bg-slate-800/60 p-0.5 border border-slate-200 dark:border-slate-700/60">
                            {([['table', <ListIcon key="t" className="size-3.5" />], ['card', <LayoutGrid key="c" className="size-3.5" />]] as [string, React.ReactNode][]).map(([k, icon]) => (
                                <button
                                    key={k}
                                    onClick={() => setView(k as 'table' | 'card')}
                                    aria-label={`View ${k}`}
                                    className={`px-2.5 py-1.5 rounded-[9px] flex items-center gap-1.5 transition-all duration-200
                                        ${view === k
                                            ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                                            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                                        }`}
                                >
                                    {icon}
                                </button>
                            ))}
                        </div>

                        {/* New request button */}
                        {role === 'USER' && (
                            <Link
                                to={`${basePath}/new`}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-3.5 py-2 text-xs font-bold shadow-sm hover:bg-primary/90 transition-all duration-200 hover:shadow-md"
                            >
                                <Plus className="size-3.5" />
                                <span className="hidden sm:inline">Request Baru</span>
                            </Link>
                        )}
                    </div>
                </div>
            </motion.div>

            {/* ── FILTERS ── */}
            <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.05, ease: [0.23, 1, 0.32, 1] }}
                className="mt-4 bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl p-4 shadow-sm"
            >
                <RequestFilters value={filters} onChange={setFilters} scopeVisible={role !== 'USER'} />
            </motion.div>

            {/* ── CONTENT ── */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="mt-4"
            >
                {isLoading ? (
                    <RequestListSkeleton />
                ) : !data?.rows?.length ? (
                    <EmptyState
                        icon={<LayoutGrid className="size-12 text-slate-300" />}
                        title="Belum ada request"
                        desc={
                            filters.scope === 'my'
                                ? 'Mulai buat request hardware baru.'
                                : 'Belum ada request yang sesuai kriteria.'
                        }
                        cta={
                            role === 'USER' && (
                                <Link
                                    to={`${basePath}/new`}
                                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-5 py-2.5 mt-4 text-sm font-bold shadow-sm transition hover:bg-slate-800"
                                >
                                    <Plus className="size-4" /> Buat request
                                </Link>
                            )
                        }
                    />
                ) : view === 'table' ? (
                    <div className="bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl shadow-sm overflow-hidden">
                        <RequestTable rows={data.rows} />
                    </div>
                ) : (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                        {data.rows.map((r) => (
                            <RequestCard key={r.id} r={r} />
                        ))}
                    </div>
                )}
            </motion.div>

            {/* ── PAGINATION ── */}
            <AnimatePresence>
                {data?.meta && data.rows.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: 0.2 }}
                        className="mt-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium"
                    >
                        <span className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl text-xs">
                            <b>{data.meta.total}</b> total · Hal. <b>{data.meta.page}</b> / {Math.ceil(data.meta.total / data.meta.pageSize)}
                        </span>
                        <div className="flex gap-1.5">
                            <button
                                disabled={filters.page === 1 || isFetching}
                                onClick={() => setFilters({ ...filters, page: (filters.page ?? 1) - 1 })}
                                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                            >
                                <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
                                Sebelumnya
                            </button>
                            <button
                                disabled={isFetching || (data.meta.page * data.meta.pageSize >= data.meta.total)}
                                onClick={() => setFilters({ ...filters, page: (filters.page ?? 1) + 1 })}
                                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                            >
                                Selanjutnya
                                <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
