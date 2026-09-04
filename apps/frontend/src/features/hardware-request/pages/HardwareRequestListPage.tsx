import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
    Plus,
    LayoutGrid,
    Cpu,
    RotateCw,
    TrendingUp,
    Clock,
    CheckCircle2,
    Wrench,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    X,
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { useHardwareRequestList } from '../hooks/useHardwareRequestList';
import { useHardwareRole } from '../hooks/usePermissions';
import { useHardwareGlobalRealtime } from '../hooks/useHardwareRequestRealtime';
import { useHardwareStats } from '../hooks/useHardwareStats';
import { RequestFilters } from '../components/list/RequestFilters';
import { RequestTable } from '../components/list/RequestTable';
import { RequestCard } from '../components/list/RequestCard';
import { RequestListSkeleton } from '../components/list/RequestListSkeleton';
import { EmptyState } from '../components/common/EmptyState';
import { useHardwareBasePath } from '../hooks/useHardwareBasePath';
import { StatsCard } from '@/features/ticket-board/components/StatsCard';
import type { ListFilters, RequestStatus } from '../types';
import { cn } from '@/lib/utils';

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

const REVIEW_STATUSES: RequestStatus[] = ['SUBMITTED', 'UNDER_REVIEW'];
const IN_PROGRESS_STATUSES: RequestStatus[] = [
    'APPROVED', 'PROCUREMENT', 'AWAITING_DELIVERY', 'INSTALLATION', 'AWAITING_USER_CONFIRMATION',
];
const COMPLETED_STATUSES: RequestStatus[] = ['COMPLETED'];

export default function HardwareRequestListPage() {
    const { role } = useHardwareRole();
    const basePath = useHardwareBasePath();
    const queryClient = useQueryClient();
    useHardwareGlobalRealtime();

    const defaults: ListFilters = useMemo(
        () => ({ page: 1, pageSize: 10, scope: role === 'USER' ? 'my' : 'all' }),
        [role],
    );

    const [filters, setFilters] = useState<ListFilters>(defaults);
    const [view, setView] = useState<'table' | 'card'>('table');

    const { data, isLoading, isFetching, refetch } = useHardwareRequestList(filters);
    const { data: statsData, isLoading: isStatsLoading } = useHardwareStats(filters.scope);

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ['hardware-requests'] });
        refetch();
    };

    // Determine active stats card
    const currentStatuses = filters.status ?? [];
    const isTotalActive = currentStatuses.length === 0;
    const isReviewActive =
        currentStatuses.length === REVIEW_STATUSES.length &&
        REVIEW_STATUSES.every((s) => currentStatuses.includes(s));
    const isInProgressActive =
        currentStatuses.length === IN_PROGRESS_STATUSES.length &&
        IN_PROGRESS_STATUSES.every((s) => currentStatuses.includes(s));
    const isCompletedActive =
        currentStatuses.length === 1 && currentStatuses[0] === 'COMPLETED';

    const handleFilterStatusCategory = (category: 'all' | 'review' | 'inProgress' | 'completed') => {
        if (category === 'all') {
            setFilters((prev) => ({ ...prev, status: undefined, page: 1 }));
        } else if (category === 'review') {
            setFilters((prev) => ({ ...prev, status: REVIEW_STATUSES, page: 1 }));
        } else if (category === 'inProgress') {
            setFilters((prev) => ({ ...prev, status: IN_PROGRESS_STATUSES, page: 1 }));
        } else if (category === 'completed') {
            setFilters((prev) => ({ ...prev, status: COMPLETED_STATUSES, page: 1 }));
        }
    };

    const handlePageSizeChange = (newSize: number) => {
        setFilters((prev) => ({ ...prev, pageSize: newSize, page: 1 }));
    };

    const meta = data?.meta;
    const totalPages = meta ? Math.ceil(meta.total / meta.pageSize) : 1;
    const currentPage = meta?.page ?? 1;

    return (
        <div className="space-y-6 animate-fade-in-up pb-12">
            {/* ── HEADER AREA ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Cpu className="size-6 text-primary" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                                Hardware Requests
                            </h1>
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Live
                            </span>
                        </div>
                        <p className="text-xs sm:text-sm font-medium text-muted-foreground mt-0.5 sm:mt-1">
                            Kelola permintaan, jadwal instalasi, dan monitoring pengiriman hardware
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    <button
                        type="button"
                        onClick={handleRefresh}
                        className="p-2 sm:px-3 sm:py-2.5 bg-card border border-border hover:bg-muted/50 rounded-xl text-xs sm:text-sm font-semibold text-foreground transition-colors shadow-xs active:scale-[0.98] flex items-center gap-1.5 cursor-pointer"
                        title="Segarkan data"
                    >
                        <RotateCw
                            className={cn('size-4', (isFetching || isStatsLoading) && 'animate-spin text-primary')}
                            aria-hidden="true"
                        />
                        <span className="hidden sm:inline">Refresh</span>
                    </button>

                    {role === 'USER' && (
                        <Link
                            to={`${basePath}/new`}
                            className="flex items-center gap-1.5 sm:gap-2 px-4 sm:px-5 py-2 sm:py-2.5 bg-primary text-primary-foreground rounded-xl text-xs sm:text-sm font-bold hover:bg-primary/90 transition-all duration-200 shadow-xs active:scale-[0.98]"
                        >
                            <Plus className="size-4" aria-hidden="true" />
                            <span>Request Baru</span>
                        </Link>
                    )}
                </div>
            </div>

            {/* ── BENTO STATS CARDS ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 lg:gap-4">
                <StatsCard
                    icon={TrendingUp}
                    label="Total"
                    value={statsData?.total ?? meta?.total ?? 0}
                    color="text-primary dark:text-blue-400"
                    bgColor="bg-primary/10 dark:bg-primary/20"
                    animationIndex={0}
                    onClick={() => handleFilterStatusCategory('all')}
                    isActive={isTotalActive}
                    isLoading={isStatsLoading && !statsData}
                />
                <StatsCard
                    icon={Clock}
                    label="Menunggu Review"
                    value={statsData?.review ?? 0}
                    color="text-[hsl(var(--warning-500))]"
                    bgColor="bg-[hsl(var(--warning-500))]/10"
                    animationIndex={1}
                    onClick={() => handleFilterStatusCategory('review')}
                    isActive={isReviewActive}
                    isLoading={isStatsLoading && !statsData}
                />
                <StatsCard
                    icon={Wrench}
                    label="Dalam Proses"
                    value={statsData?.inProgress ?? 0}
                    color="text-[hsl(var(--info-500))]"
                    bgColor="bg-[hsl(var(--info-500))]/10"
                    animationIndex={2}
                    onClick={() => handleFilterStatusCategory('inProgress')}
                    isActive={isInProgressActive}
                    isLoading={isStatsLoading && !statsData}
                />
                <StatsCard
                    icon={CheckCircle2}
                    label="Selesai"
                    value={statsData?.completed ?? 0}
                    color="text-[hsl(var(--success-500))]"
                    bgColor="bg-[hsl(var(--success-500))]/10"
                    animationIndex={3}
                    onClick={() => handleFilterStatusCategory('completed')}
                    isActive={isCompletedActive}
                    isLoading={isStatsLoading && !statsData}
                />
            </div>

            {/* ── TOOLBAR (SEARCH & FILTERS) ── */}
            <RequestFilters
                value={filters}
                onChange={setFilters}
                scopeVisible={role !== 'USER'}
                view={view}
                onViewChange={setView}
            />

            {/* ── CONTENT (TABLE / CARD GRID) ── */}
            <div>
                {isLoading ? (
                    <RequestListSkeleton />
                ) : !data?.rows?.length ? (
                    <EmptyState
                        icon={<LayoutGrid className="size-12 text-slate-300 dark:text-slate-600" />}
                        title="Belum ada request"
                        desc={
                            filters.search || (filters.status && filters.status.length > 0)
                                ? 'Tidak ada hardware request yang cocok dengan filter atau kata kunci pencarian.'
                                : filters.scope === 'my'
                                ? 'Mulai buat request hardware baru untuk kebutuhan perangkat kerja Anda.'
                                : 'Belum ada request hardware terdaftar di sistem.'
                        }
                        cta={
                            filters.search || (filters.status && filters.status.length > 0) ? (
                                <button
                                    type="button"
                                    onClick={() => setFilters(defaults)}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-card border border-border hover:bg-muted/50 rounded-xl text-xs font-bold text-foreground transition-all active:scale-[0.98] cursor-pointer mt-4"
                                >
                                    <X className="size-4" />
                                    <span>Reset Filter</span>
                                </button>
                            ) : role === 'USER' ? (
                                <Link
                                    to={`${basePath}/new`}
                                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-xs sm:text-sm font-bold hover:bg-primary/90 transition-all shadow-xs active:scale-[0.98] mt-4"
                                >
                                    <Plus className="size-4" />
                                    <span>Buat Request Baru</span>
                                </Link>
                            ) : undefined
                        }
                    />
                ) : (
                    <>
                        {/* Mobile view: Always render touch-friendly cards on small screens */}
                        <div className="md:hidden space-y-3">
                            {data.rows.map((r) => (
                                <RequestCard key={r.id} r={r} />
                            ))}
                        </div>

                        {/* Desktop view: Respects table vs card view preference */}
                        <div className="hidden md:block">
                            {view === 'table' ? (
                                <div className="bg-white dark:bg-[hsl(var(--card))] border border-border rounded-2xl shadow-xs overflow-hidden">
                                    <RequestTable rows={data.rows} />
                                </div>
                            ) : (
                                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                                    {data.rows.map((r) => (
                                        <RequestCard key={r.id} r={r} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* ── BENTO PAGINATION FOOTER ── */}
            <AnimatePresence>
                {meta && data?.rows && data.rows.length > 0 && (
                    <div className="p-4 bg-card border border-border rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
                        {/* Left: page size selector */}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                            <label htmlFor="hr-page-size">Menampilkan</label>
                            <select
                                id="hr-page-size"
                                value={filters.pageSize ?? 10}
                                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                                className="px-2.5 py-1 min-h-[36px] rounded-lg bg-card border border-border text-foreground outline-none font-medium focus:ring-1 focus:ring-primary cursor-pointer shadow-xs"
                            >
                                {PAGE_SIZE_OPTIONS.map((size) => (
                                    <option key={size} value={size}>
                                        {size}
                                    </option>
                                ))}
                            </select>
                            <span>dari {meta.total} request</span>
                        </div>

                        {/* Right: navigation buttons */}
                        {totalPages > 1 && (
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => setFilters((prev) => ({ ...prev, page: 1 }))}
                                    disabled={currentPage <= 1 || isFetching}
                                    aria-label="Halaman pertama"
                                    className="p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                >
                                    <ChevronsLeft className="size-4" aria-hidden="true" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFilters((prev) => ({ ...prev, page: Math.max(1, currentPage - 1) }))}
                                    disabled={currentPage <= 1 || isFetching}
                                    aria-label="Halaman sebelumnya"
                                    className="p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                >
                                    <ChevronLeft className="size-4" aria-hidden="true" />
                                </button>
                                <span className="px-3 py-1 bg-primary/10 text-primary font-bold text-xs rounded-lg tabular-nums">
                                    {currentPage} / {totalPages}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setFilters((prev) => ({ ...prev, page: Math.min(totalPages, currentPage + 1) }))}
                                    disabled={currentPage >= totalPages || isFetching}
                                    aria-label="Halaman berikutnya"
                                    className="p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                >
                                    <ChevronRight className="size-4" aria-hidden="true" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFilters((prev) => ({ ...prev, page: totalPages }))}
                                    disabled={currentPage >= totalPages || isFetching}
                                    aria-label="Halaman terakhir"
                                    className="p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                >
                                    <ChevronsRight className="size-4" aria-hidden="true" />
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
