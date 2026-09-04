import React, { useState, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Plus,
    Search,
    Clock,
    CheckCircle2,
    ChevronRight,
    FileText,
    Database,
    Ban,
    Inbox,
    Download,
} from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useAuth } from '@/stores/useAuth';
import { useEformRequests, usePendingApprovals, downloadEformPdf, EFormRequest } from '../api/eform-request.api';

import { EFormStatus } from '../components/eform/EformStatusPipeline';
import {
    EformStatusBadge,
    EformTypeBadge,
    getStatusConfig,
    getTypeConfig,
    EFORM_TYPES,
} from '../components/eform/eform-vocabulary';

type TabView = 'my-requests' | 'pending-approvals';

const ICT_ROLES = ['ADMIN', 'AGENT_ADMIN'];

const STATUS_FILTERS = [
    { value: 'ALL', label: 'Semua status' },
    ...Object.values(EFormStatus).map(status => ({
        value: status as string,
        label: getStatusConfig(status).label,
    })),
];

const SkeletonTableRow = () => (
    <tr className="animate-pulse border-b border-border/60">
        <td className="px-5 py-4">
            <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-muted shrink-0" />
                <div className="space-y-1.5 min-w-0">
                    <div className="h-3 w-16 rounded bg-muted" />
                    <div className="h-4 w-28 rounded bg-muted" />
                </div>
            </div>
        </td>
        <td className="px-4 py-4">
            <div className="space-y-1.5">
                <div className="h-4 w-32 rounded bg-muted" />
                <div className="h-3 w-20 rounded bg-muted" />
            </div>
        </td>
        <td className="px-4 py-4 whitespace-nowrap">
            <div className="h-4 w-24 rounded bg-muted" />
        </td>
        <td className="px-4 py-4 whitespace-nowrap">
            <div className="h-4 w-24 rounded bg-muted" />
        </td>
        <td className="px-4 py-4 whitespace-nowrap">
            <div className="h-6 w-28 rounded-full bg-muted" />
        </td>
        <td className="px-5 py-4 text-right whitespace-nowrap">
            <div className="inline-block h-8 w-24 rounded-lg bg-muted" />
        </td>
    </tr>
);

const SkeletonMobileCard = () => (
    <div className="animate-pulse rounded-2xl border border-border bg-card p-4 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-muted shrink-0" />
                <div className="space-y-1.5">
                    <div className="h-3 w-16 bg-muted rounded" />
                    <div className="h-4 w-28 bg-muted rounded" />
                </div>
            </div>
            <div className="h-6 w-20 bg-muted rounded-full" />
        </div>
        <div className="h-8 bg-muted/60 rounded-xl" />
    </div>
);

export const EformAccessListPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [typeFilter, setTypeFilter] = useState('ALL');
    const [tab, setTab] = useState<TabView>('my-requests');
    const hasAutoSwitched = useRef(false);

    const isIct = ICT_ROLES.includes(user?.role || '');

    const { data: requestsData, isLoading: loadingRequests } = useEformRequests(isIct);
    const { data: pendingData, isLoading: loadingPending } = usePendingApprovals();

    const myRequests = useMemo(() => (Array.isArray(requestsData) ? requestsData : []), [requestsData]);
    const pendingApprovals = useMemo(() => (Array.isArray(pendingData) ? pendingData : []), [pendingData]);

    // Only auto-switch to pending tab once on initial load — not on every re-render
    React.useEffect(() => {
        if (pendingApprovals.length > 0 && !hasAutoSwitched.current) {
            setTab('pending-approvals');
            hasAutoSwitched.current = true;
        }
    }, [pendingApprovals.length]);

    const isApprovalTab = tab === 'pending-approvals';
    const activeList = isApprovalTab ? pendingApprovals : myRequests;
    const isLoading = isApprovalTab ? loadingPending : loadingRequests;

    const filteredRequests = useMemo(
        () =>
            activeList.filter(req => {
                const query = searchTerm.trim().toLowerCase();
                const matchesSearch =
                    !query ||
                    (req.requesterName?.toLowerCase() || '').includes(query) ||
                    req.id.toLowerCase().startsWith(query);
                const matchesStatus = statusFilter === 'ALL' || req.status === statusFilter;
                const matchesType = typeFilter === 'ALL' || req.formType === typeFilter;
                return matchesSearch && matchesStatus && matchesType;
            }),
        [activeList, searchTerm, statusFilter, typeFilter],
    );

    const counts = useMemo(
        () => ({
            total: activeList.length,
            pendingManager: activeList.filter(r => r.status === EFormStatus.PENDING_MANAGER).length,
            pendingIct: activeList.filter(r => r.status === EFormStatus.PENDING_ICT).length,
            confirmed: activeList.filter(r => r.status === EFormStatus.CONFIRMED).length,
            rejected: activeList.filter(r => r.status === EFormStatus.REJECTED).length,
        }),
        [activeList],
    );

    const isFiltered = statusFilter !== 'ALL' || typeFilter !== 'ALL' || searchTerm.trim() !== '';

    const basePath = location.pathname.startsWith('/client') ? '/client'
        : location.pathname.startsWith('/manager') ? '/manager'
        : '';

    const handleCreateNew = () => navigate(`${basePath}/eform-access/new`);
    const handleViewDetail = (id: string) => navigate(`${basePath}/eform-access/${id}`);

    const resetFilters = () => {
        setSearchTerm('');
        setStatusFilter('ALL');
        setTypeFilter('ALL');
    };

    return (
        <div className="space-y-6 animate-fade-in-up">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                        <FileText className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">E-Form Access</h1>
                        <p className="text-sm font-medium text-muted-foreground">
                            Pengajuan akses VPN, website, dan jaringan beserta persetujuannya
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleCreateNew}
                    className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer"
                >
                    <Plus className="h-4 w-4" />
                    Ajukan Akses
                </button>
            </div>

            {/* Counts — clickable status filters */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
                <CountTile
                    label="Total"
                    value={counts.total}
                    icon={FileText}
                    isActive={statusFilter === 'ALL'}
                    onClick={() => setStatusFilter('ALL')}
                />
                <CountTile
                    label="Menunggu Atasan"
                    value={counts.pendingManager}
                    icon={Clock}
                    accent="text-amber-600 dark:text-amber-400"
                    isActive={statusFilter === EFormStatus.PENDING_MANAGER}
                    onClick={() => setStatusFilter(EFormStatus.PENDING_MANAGER)}
                />
                <CountTile
                    label="Diproses ICT"
                    value={counts.pendingIct}
                    icon={Database}
                    accent="text-primary"
                    isActive={statusFilter === EFormStatus.PENDING_ICT}
                    onClick={() => setStatusFilter(EFormStatus.PENDING_ICT)}
                />
                <CountTile
                    label="Akses Siap"
                    value={counts.confirmed}
                    icon={CheckCircle2}
                    accent="text-emerald-600 dark:text-emerald-400"
                    isActive={statusFilter === EFormStatus.CONFIRMED}
                    onClick={() => setStatusFilter(EFormStatus.CONFIRMED)}
                />
                <CountTile
                    label="Ditolak"
                    value={counts.rejected}
                    icon={Ban}
                    accent="text-destructive"
                    isActive={statusFilter === EFormStatus.REJECTED}
                    onClick={() => setStatusFilter(EFormStatus.REJECTED)}
                />
            </div>

            {/* Tabs */}
            <div role="tablist" aria-label="Tampilan permintaan" className="flex w-fit gap-1 rounded-xl border border-border bg-muted/50 p-1">
                <button
                    role="tab"
                    aria-selected={!isApprovalTab}
                    onClick={() => setTab('my-requests')}
                    className={cn(
                        'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer',
                        !isApprovalTab
                            ? 'bg-card text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground',
                    )}
                >
                    <FileText className="h-4 w-4" />
                    Permintaan Saya
                </button>
                <button
                    role="tab"
                    aria-selected={isApprovalTab}
                    onClick={() => setTab('pending-approvals')}
                    className={cn(
                        'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer',
                        isApprovalTab
                            ? 'bg-card text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground',
                    )}
                >
                    <Inbox className="h-4 w-4" />
                    Perlu Persetujuan
                    {pendingApprovals.length > 0 && (
                        <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-xs font-bold text-white">
                            {pendingApprovals.length}
                        </span>
                    )}
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row">
                <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="search"
                        aria-label="Cari permintaan"
                        placeholder="Cari nama pemohon atau ID permintaan"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-4 text-sm font-medium text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                </div>
                <select
                    aria-label="Saring jenis akses"
                    value={typeFilter}
                    onChange={e => setTypeFilter(e.target.value)}
                    className="h-11 cursor-pointer rounded-xl border border-border bg-background px-4 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-w-[170px]"
                >
                    <option value="ALL">Semua jenis</option>
                    {EFORM_TYPES.map(({ id, label }) => (
                        <option key={id} value={id}>{label}</option>
                    ))}
                </select>
                <select
                    aria-label="Saring status"
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="h-11 cursor-pointer rounded-xl border border-border bg-background px-4 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-w-[190px]"
                >
                    {STATUS_FILTERS.map(({ value, label }) => (
                        <option key={value} value={value}>{label}</option>
                    ))}
                </select>
            </div>

            {/* Results: Mobile Cards (md:hidden) & Desktop Table (hidden md:block) */}
            <div className="md:hidden space-y-3">
                {isLoading ? (
                    Array.from({ length: 4 }, (_, i) => <SkeletonMobileCard key={i} />)
                ) : filteredRequests.length === 0 ? (
                    <div className="rounded-2xl border border-border bg-card p-6">
                        <EmptyState
                            isFiltered={isFiltered}
                            isApprovalTab={isApprovalTab}
                            onReset={resetFilters}
                            onCreate={handleCreateNew}
                        />
                    </div>
                ) : (
                    filteredRequests.map(req => (
                        <EformMobileCard
                            key={req.id}
                            request={req}
                            isApprovalTab={isApprovalTab}
                            onOpen={() => handleViewDetail(req.id)}
                        />
                    ))
                )}
            </div>

            {/* Desktop Results Table */}
            <div className="hidden md:block overflow-hidden rounded-2xl border border-border bg-card shadow-2xs">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-border bg-muted/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                <th className="px-5 py-3.5">ID & Jenis Akses</th>
                                <th className="px-4 py-3.5">Pemohon</th>
                                <th className="px-4 py-3.5">Diajukan</th>
                                <th className="px-4 py-3.5">Berlaku Dari</th>
                                <th className="px-4 py-3.5">Status</th>
                                <th className="px-5 py-3.5 text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                            {isLoading ? (
                                Array.from({ length: 5 }, (_, i) => <SkeletonTableRow key={i} />)
                            ) : filteredRequests.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-0">
                                        <EmptyState
                                            isFiltered={isFiltered}
                                            isApprovalTab={isApprovalTab}
                                            onReset={resetFilters}
                                            onCreate={handleCreateNew}
                                        />
                                    </td>
                                </tr>
                            ) : (
                                filteredRequests.map(req => (
                                    <EformListRow
                                        key={req.id}
                                        request={req}
                                        isApprovalTab={isApprovalTab}
                                        onOpen={() => handleViewDetail(req.id)}
                                    />
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

interface CountTileProps {
    label: string;
    value: number;
    icon: React.ElementType;
    accent?: string;
    isActive: boolean;
    onClick: () => void;
}

const CountTile: React.FC<CountTileProps> = ({ label, value, icon: Icon, accent, isActive, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        aria-pressed={isActive}
        className={cn(
            'flex items-center gap-3 rounded-xl border bg-card p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer',
            isActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
        )}
    >
        <Icon className={cn('h-5 w-5 shrink-0', accent ?? 'text-muted-foreground')} aria-hidden="true" />
        <div className="min-w-0">
            <div className="text-2xl font-extrabold leading-none tracking-tight text-foreground">{value}</div>
            <div className="mt-1 truncate text-xs font-semibold text-muted-foreground">{label}</div>
        </div>
    </button>
);

interface EformListRowProps {
    request: EFormRequest;
    isApprovalTab: boolean;
    onOpen: () => void;
}

const EformListRow: React.FC<EformListRowProps> = ({ request, isApprovalTab, onOpen }) => {
    const type = getTypeConfig(request.formType);
    const TypeIcon = type.icon;
    const formattedDate = format(new Date(request.createdAt), 'd MMM yyyy', { locale: idLocale });
    const validFrom = request.formData?.dariTanggal || '—';

    return (
        <tr
            role="button"
            tabIndex={0}
            onClick={onOpen}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpen();
                }
            }}
            className="group cursor-pointer transition-colors duration-150 hover:bg-muted/40 focus-visible:outline-none focus-visible:bg-muted/50"
        >
            {/* ID & Jenis Akses */}
            <td className="px-5 py-3.5">
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                        <TypeIcon className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                        <div className="font-mono text-[11px] font-semibold text-muted-foreground group-hover:text-primary transition-colors">
                            #{request.id.slice(0, 8).toUpperCase()}
                        </div>
                        <div className="truncate text-sm font-bold text-foreground">
                            {type.label}
                        </div>
                    </div>
                </div>
            </td>

            {/* Pemohon */}
            <td className="px-4 py-3.5">
                <div className="min-w-[140px]">
                    <div className="truncate text-sm font-bold text-foreground">
                        {request.requesterName}
                    </div>
                    {request.requesterDepartment && (
                        <div className="truncate text-xs font-medium text-muted-foreground">
                            {request.requesterDepartment}
                        </div>
                    )}
                </div>
            </td>

            {/* Tanggal Pengajuan */}
            <td className="px-4 py-3.5 whitespace-nowrap text-xs font-semibold text-muted-foreground">
                {formattedDate}
            </td>

            {/* Berlaku Dari */}
            <td className="px-4 py-3.5 whitespace-nowrap">
                <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 text-xs font-semibold text-foreground">
                    {validFrom}
                </span>
            </td>

            {/* Status */}
            <td className="px-4 py-3.5 whitespace-nowrap">
                <EformStatusBadge status={request.status} />
            </td>

            {/* Aksi */}
            <td className="px-5 py-3.5 text-right whitespace-nowrap">
                <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                    {request.status === EFormStatus.CONFIRMED && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                downloadEformPdf(request.id, `F-ICT-04-${request.requesterName.replace(/\s+/g, '_')}.pdf`);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 transition-colors cursor-pointer"
                            title="Unduh Formulir Resmi PDF"
                        >
                            <Download size={12} /> PDF F-ICT-04
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onOpen}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                    >
                        {isApprovalTab ? 'Tinjau' : 'Detail'}
                        <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </button>
                </div>
            </td>
        </tr>
    );
};

const EformMobileCard: React.FC<EformListRowProps> = ({ request, isApprovalTab, onOpen }) => {
    const type = getTypeConfig(request.formType);
    const TypeIcon = type.icon;
    const formattedDate = format(new Date(request.createdAt), 'd MMM yyyy', { locale: idLocale });
    const validFrom = request.formData?.dariTanggal || '—';

    return (
        <div
            onClick={onOpen}
            className="group relative flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-xs transition-all hover:border-primary/40 active:scale-[0.99] cursor-pointer"
        >
            {/* Top row: Type Icon + ID + Status */}
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <TypeIcon className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                        <span className="font-mono text-[11px] font-bold text-muted-foreground group-hover:text-primary transition-colors">
                            #{request.id.slice(0, 8).toUpperCase()}
                        </span>
                        <div className="truncate text-sm font-extrabold text-foreground">
                            {type.label}
                        </div>
                    </div>
                </div>
                <EformStatusBadge status={request.status} />
            </div>

            {/* Mid row: Requester Info */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60 text-xs">
                <div className="min-w-0">
                    <div className="font-bold text-foreground truncate">
                        {request.requesterName}
                    </div>
                    {request.requesterDepartment && (
                        <div className="text-muted-foreground text-[11px] truncate">
                            {request.requesterDepartment}
                        </div>
                    )}
                </div>
                <div className="text-right shrink-0">
                    <div className="text-[11px] text-muted-foreground font-medium">Diajukan: {formattedDate}</div>
                    <div className="text-[11px] font-semibold text-foreground mt-0.5">
                        Mulai: <span className="bg-muted px-1.5 py-0.5 rounded">{validFrom}</span>
                    </div>
                </div>
            </div>

            {/* Bottom Row: Actions */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60">
                {request.status === EFormStatus.CONFIRMED ? (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            downloadEformPdf(request.id, `F-ICT-04-${request.requesterName.replace(/\s+/g, '_')}.pdf`);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 transition-colors cursor-pointer"
                    >
                        <Download size={13} />
                        <span>Unduh PDF F-ICT-04</span>
                    </button>
                ) : (
                    <span className="text-[11px] text-muted-foreground font-medium">
                        {isApprovalTab ? 'Ketuk untuk tinjau & setujui' : 'Ketuk untuk lihat detail'}
                    </span>
                )}
                <div className="flex items-center gap-1 text-xs font-bold text-primary group-hover:translate-x-0.5 transition-transform ml-auto">
                    <span>{isApprovalTab ? 'Tinjau' : 'Detail'}</span>
                    <ChevronRight size={14} />
                </div>
            </div>
        </div>
    );
};

interface EmptyStateProps {
    isFiltered: boolean;
    isApprovalTab: boolean;
    onReset: () => void;
    onCreate: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({ isFiltered, isApprovalTab, onReset, onCreate }) => {
    if (isFiltered) {
        return (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
                <Search className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                <div className="space-y-1">
                    <h3 className="text-lg font-bold text-foreground">Tidak ada yang cocok</h3>
                    <p className="text-sm text-muted-foreground">
                        Tidak ada permintaan yang sesuai dengan pencarian atau saringan ini.
                    </p>
                </div>
                <button
                    onClick={onReset}
                    className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-bold text-foreground transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    Hapus saringan
                </button>
            </div>
        );
    }

    if (isApprovalTab) {
        return (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                <div className="space-y-1">
                    <h3 className="text-lg font-bold text-foreground">Semua sudah ditinjau</h3>
                    <p className="text-sm text-muted-foreground">
                        Tidak ada permintaan yang menunggu persetujuan Anda saat ini.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
            <FileText className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
            <div className="max-w-sm space-y-1">
                <h3 className="text-lg font-bold text-foreground">Belum ada pengajuan</h3>
                <p className="text-sm text-muted-foreground">
                    Ajukan akses VPN, website, atau jaringan. Permintaan diteruskan ke atasan Anda,
                    lalu ke tim ICT untuk disiapkan.
                </p>
            </div>
            <button
                onClick={onCreate}
                className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
                <Plus className="h-4 w-4" />
                Ajukan Akses
            </button>
        </div>
    );
};
