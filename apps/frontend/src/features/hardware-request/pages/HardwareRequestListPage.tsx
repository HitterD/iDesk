import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, ChevronDown, CircleCheck, Inbox, Layers, Loader, PackageSearch, X } from 'lucide-react';
import { useHardwareRequestList } from '../hooks/useHardwareRequestList';
import { useHardwareRole } from '../hooks/usePermissions';
import { useHardwareGlobalRealtime } from '../hooks/useHardwareRequestRealtime';
import { useHardwareStats } from '../hooks/useHardwareStats';
import { RequestFilters } from '../components/list/RequestFilters';
import { RequestTable } from '../components/list/RequestTable';
import { RequestCard } from '../components/list/RequestCard';
import { useHardwareBasePath } from '../hooks/useHardwareBasePath';
import { ResEmpty, ResPager, ResSkeletonRows, ResStat, ResTable } from '@/components/resources/ResourceParts';
import type { ListFilters, RequestStatus } from '../types';

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

    const isFiltered = !!filters.search || (filters.status?.length ?? 0) > 0 || (filters.category?.length ?? 0) > 0;
    const statsLoading = isStatsLoading && !statsData;
    const total = statsData?.total ?? meta?.total ?? 0;
    const rows = data?.rows ?? [];

    const foot = meta && rows.length > 0 ? (
        <>
            <span>Menampilkan {rows.length} dari {meta.total} request</span>
            <span className="res-foot-right">
                <span className="res-muted hidden lg:inline">Request baru diajukan lewat “Buat Tiket Baru” → Hardware &amp; Budget</span>
                <label className="queue-pop portal-page-size" htmlFor="hr-page-size">
                    <span className="queue-pop-k">Per halaman</span>
                    <select id="hr-page-size" value={filters.pageSize ?? 10} onChange={(e) => handlePageSizeChange(Number(e.target.value))}>
                        {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}</option>)}
                    </select>
                    <ChevronDown aria-hidden="true" />
                </label>
                <ResPager page={currentPage} totalPages={totalPages} disabled={isFetching}
                    onChange={(page) => setFilters((prev) => ({ ...prev, page }))} />
            </span>
        </>
    ) : undefined;

    const empty = (
        <ResEmpty icon={PackageSearch} title="Belum ada request"
            cta={isFiltered ? (
                <button type="button" className="idesk-btn is-soft" onClick={() => setFilters(defaults)}><X aria-hidden="true" />Reset filter</button>
            ) : role === 'USER' ? (
                <Link to={`${basePath}/new`} className="idesk-text-link">Buat request baru<ArrowRight aria-hidden="true" /></Link>
            ) : undefined}>
            {isFiltered ? 'Coba ubah filter atau kata kunci.'
                : filters.scope === 'my' ? 'Mulai buat request hardware baru untuk kebutuhan perangkat kerja Anda.'
                    : 'Belum ada request hardware terdaftar di sistem.'}
        </ResEmpty>
    );

    return (
        <div className="pb-12">
            <section className="res-stats is-four" aria-label="Ringkasan request">
                <ResStat icon={Layers} tone="neutral" label="Total" value={total} isLoading={statsLoading}
                    active={isTotalActive} onClick={() => handleFilterStatusCategory('all')} />
                <ResStat icon={Inbox} tone="amber" label="Menunggu Review" value={statsData?.review ?? 0} isLoading={statsLoading}
                    attention={(statsData?.review ?? 0) > 0} zero={(statsData?.review ?? 0) === 0}
                    active={isReviewActive} onClick={() => handleFilterStatusCategory(isReviewActive ? 'all' : 'review')} />
                <ResStat icon={Loader} tone="navy" label="Dalam Proses" value={statsData?.inProgress ?? 0} isLoading={statsLoading}
                    zero={(statsData?.inProgress ?? 0) === 0}
                    active={isInProgressActive} onClick={() => handleFilterStatusCategory(isInProgressActive ? 'all' : 'inProgress')} />
                <ResStat icon={CircleCheck} tone="green" label="Selesai" value={statsData?.completed ?? 0} isLoading={statsLoading}
                    zero={(statsData?.completed ?? 0) === 0}
                    active={isCompletedActive} onClick={() => handleFilterStatusCategory(isCompletedActive ? 'all' : 'completed')} />
            </section>

            <RequestFilters value={filters} onChange={setFilters} scopeVisible={role !== 'USER'}
                view={view} onViewChange={setView} onRefresh={handleRefresh} isRefreshing={isFetching} />

            {isLoading ? (
                <ResTable label="Daftar hardware request" cols="minmax(0,1fr)"><ResSkeletonRows rows={6} /></ResTable>
            ) : rows.length === 0 ? (
                <ResTable label="Daftar hardware request" cols="minmax(0,1fr)">{empty}</ResTable>
            ) : view === 'card' ? (
                <>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                        {rows.map((r) => <RequestCard key={r.id} r={r} />)}
                    </div>
                    {foot && <div className="res-foot mt-3 rounded-2xl bg-[hsl(var(--idesk-surface))]" style={{ boxShadow: 'var(--dash-shadow-1)', borderTop: 0 }}>{foot}</div>}
                </>
            ) : (
                <RequestTable rows={rows} foot={foot} />
            )}
        </div>
    );
}
