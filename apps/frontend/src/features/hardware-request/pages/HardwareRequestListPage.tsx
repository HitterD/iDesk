import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, LayoutGrid, List as ListIcon } from 'lucide-react';
import { motion } from 'framer-motion';
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

    const defaults: ListFilters = useMemo(() => ({
        page: 1, pageSize: 20,
        scope: role === 'USER' ? 'my' : 'all',
    }), [role]);

    const [filters, setFilters] = useState<ListFilters>(defaults);
    const [view, setView] = useState<'table' | 'card'>('table');
    const { data, isLoading, isFetching } = useHardwareRequestList(filters);

    return (
        <div className="flex flex-col gap-6 animate-fade-in-up pb-6">
            <motion.header
                initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl p-4 shadow-sm"
            >
                <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <ListIcon className="w-5 h-5 text-primary" />
                        Daftar Permintaan
                        <span className="live-indicator ml-2" title="Live sync active" />
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Kelola dan pantau status request hardware</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="hidden md:flex rounded-xl bg-slate-100/80 dark:bg-slate-800/50 p-1 border border-slate-200/60 dark:border-slate-700/50 backdrop-blur-sm">
                        {[['table',<ListIcon key="t" className="size-4"/>],['card',<LayoutGrid key="c" className="size-4"/>]].map(([k,icon]: any) => (
                            <button key={k} onClick={() => setView(k)}
                                className={`px-3 py-1.5 rounded-[10px] flex items-center gap-2 transition-all duration-300 ${view===k ? 'bg-white dark:bg-slate-700 text-primary shadow-sm ring-1 ring-slate-200 dark:ring-slate-600' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                aria-label={`View ${k}`}>
                                {icon}
                                <span className="text-xs font-semibold capitalize hidden xl:inline-block">{k}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </motion.header>

            <motion.div 
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1, ease: [0.23, 1, 0.32, 1] }}
                className="bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl p-4 shadow-sm"
            >
                <RequestFilters value={filters} onChange={setFilters} scopeVisible={role !== 'USER'} />
            </motion.div>

            <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.2 }}
                className="flex-1"
            >
                {isLoading ? <RequestListSkeleton /> :
                 !data?.rows?.length ? (
                    <EmptyState
                        icon={<LayoutGrid className="size-12 text-slate-300" />}
                        title="Belum ada request"
                        desc={filters.scope === 'my' ? 'Mulai buat request hardware baru.' : 'Belum ada request yang sesuai kriteria.'}
                        cta={role === 'USER' && (
                            <Link to={`${basePath}/new`}
                                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-5 py-2.5 mt-4 text-sm font-bold shadow-sm transition hover:bg-slate-800">
                                <Plus className="size-4" /> Buat request
                            </Link>
                        )}
                    />
                ) : view === 'table' ? (
                    <div className="bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl shadow-sm overflow-hidden">
                        <RequestTable rows={data.rows} />
                    </div>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 stagger-2">
                        {data.rows.map(r => <RequestCard key={r.id} r={r} />)}
                    </div>
                )}
            </motion.div>

            {data?.meta && data.rows.length > 0 && (
                <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                    className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium px-2"
                >
                    <span className="bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                        Total <b>{data.meta.total}</b> • Halaman <b>{data.meta.page}</b> dari {Math.ceil(data.meta.total / data.meta.pageSize)}
                    </span>
                    <div className="flex gap-2">
                        <button disabled={filters.page === 1 || isFetching}
                            onClick={() => setFilters({ ...filters, page: (filters.page ?? 1) - 1 })}
                            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm">
                            Sebelumnya
                        </button>
                        <button disabled={isFetching || (data.meta.page * data.meta.pageSize >= data.meta.total)}
                            onClick={() => setFilters({ ...filters, page: (filters.page ?? 1) + 1 })}
                            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm">
                            Selanjutnya
                        </button>
                    </div>
                </motion.div>
            )}
        </div>
    );
}
