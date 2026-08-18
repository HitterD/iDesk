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

const SkeletonCard = () => (
    <div className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
            <div className="space-y-2">
                <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                <div className="h-5 w-40 animate-pulse rounded bg-muted" />
            </div>
            <div className="h-6 w-28 animate-pulse rounded-full bg-muted" />
        </div>
        <div className="mb-5 flex items-center gap-3">
            <div className="h-10 w-10 animate-pulse rounded-xl bg-muted" />
            <div className="space-y-1.5">
                <div className="h-3 w-16 animate-pulse rounded bg-muted" />
                <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
            <div className="h-14 animate-pulse rounded-xl bg-muted" />
            <div className="h-14 animate-pulse rounded-xl bg-muted" />
        </div>
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
                    className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                        'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
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
                        'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
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

            {/* Results */}
            {isLoading ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} />)}
                </div>
            ) : filteredRequests.length === 0 ? (
                <EmptyState
                    isFiltered={isFiltered}
                    isApprovalTab={isApprovalTab}
                    onReset={resetFilters}
                    onCreate={handleCreateNew}
                />
            ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {filteredRequests.map(req => (
                        <RequestCard
                            key={req.id}
                            request={req}
                            isApprovalTab={isApprovalTab}
                            onOpen={() => handleViewDetail(req.id)}
                        />
                    ))}
                </div>
            )}
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
            'flex items-center gap-3 rounded-xl border bg-card p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
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

interface RequestCardProps {
    request: EFormRequest;
    isApprovalTab: boolean;
    onOpen: () => void;
}

const RequestCard: React.FC<RequestCardProps> = ({ request, isApprovalTab, onOpen }) => {
    const status = getStatusConfig(request.status);
    const type = getTypeConfig(request.formType);
    const TypeIcon = type.icon;

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onOpen}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpen();
                }
            }}
            className="group flex flex-col rounded-2xl border border-border bg-card p-6 text-left cursor-pointer transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
            <div className="mb-5 flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1.5">
                    <span className="font-mono text-xs font-medium text-muted-foreground">
                        #{request.id.slice(0, 8).toUpperCase()}
                    </span>
                    <h3 className="truncate text-base font-bold leading-tight text-foreground group-hover:text-primary">
                        {type.label}
                    </h3>
                </div>
                <EformStatusBadge status={request.status} className="shrink-0" />
            </div>

            <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                    <TypeIcon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                    <p className="text-xs font-semibold text-muted-foreground">Pemohon</p>
                    <p className="truncate text-sm font-bold text-foreground">{request.requesterName}</p>
                </div>
            </div>

            <dl className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-muted/50 p-3">
                    <dt className="text-xs font-semibold text-muted-foreground">Diajukan</dt>
                    <dd className="mt-0.5 text-sm font-bold text-foreground">
                        {format(new Date(request.createdAt), 'd MMM yyyy', { locale: idLocale })}
                    </dd>
                </div>
                <div className="rounded-xl bg-muted/50 p-3">
                    <dt className="text-xs font-semibold text-muted-foreground">Berlaku dari</dt>
                    <dd className="mt-0.5 truncate text-sm font-bold text-foreground">
                        {request.formData?.dariTanggal || '—'}
                    </dd>
                </div>
            </dl>

            <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">{status.hint}</span>
                    {request.status === EFormStatus.CONFIRMED && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                downloadEformPdf(request.id, `F-ICT-04-${request.requesterName.replace(/\s+/g, '_')}.pdf`);
                            }}
                            className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 transition-colors cursor-pointer"
                            title="Unduh Formulir Resmi PDF"
                        >
                            <Download size={11} /> PDF F-ICT-04
                        </button>
                    )}
                </div>
                <span className="inline-flex items-center gap-1 text-sm font-bold text-primary">
                    {isApprovalTab ? 'Tinjau' : 'Lihat detail'}
                    <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
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
