import React, { useState, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    ArrowRight, CalendarRange, ChevronDown, ChevronRight, CircleCheck, CircleX, Download, FileKey2, FilePlus2,
    FileText, Hourglass, Inbox, Layers, Loader, Rows3, SearchX, UserCheck, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { DashAvatar } from '@/features/dashboard/components/DashboardParts';
import { ResBub, ResEmpty, ResHead, ResSearch, ResSkeletonRows, ResStat, ResTable, resVars, rowActivation } from '@/components/resources/ResourceParts';
import { useAuth } from '@/stores/useAuth';
import { useEformRequests, usePendingApprovals, downloadEformPdf, EFormRequest } from '../api/eform-request.api';

import { EFormStatus } from '../components/eform/EformStatusPipeline';
import {
    getStatusConfig,
    getTypeConfig,
    EFORM_TYPES,
} from '../components/eform/eform-vocabulary';
import {
    EformAccessCalendar,
    calculateExpirationStatus,
} from '../components/eform/EformAccessCalendar';

type TabView = 'my-requests' | 'pending-approvals';

const ICT_ROLES = ['ADMIN', 'AGENT_ADMIN'];

const STATUS_FILTERS = [
    { value: 'ALL', label: 'Semua status' },
    { value: 'EXPIRING_SOON', label: 'Segera Berakhir (< 7 Hari)' },
    ...Object.values(EFormStatus).map(status => ({
        value: status as string,
        label: getStatusConfig(status).label,
    })),
];

export const EformAccessListPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [typeFilter, setTypeFilter] = useState('ALL');
    const [tab, setTab] = useState<TabView>('my-requests');
    const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
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
                const matchesStatus =
                    statusFilter === 'ALL'
                        ? true
                        : statusFilter === 'EXPIRING_SOON'
                            ? (() => {
                                const exp = calculateExpirationStatus(req.formData?.sampaiTanggal, req.status);
                                return !!(exp.isExpiringSoon || exp.isToday);
                            })()
                            : req.status === statusFilter;
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
            expiringSoon: activeList.filter(r => {
                const exp = calculateExpirationStatus(r.formData?.sampaiTanggal, r.status);
                return exp.isExpiringSoon || exp.isToday;
            }).length,
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

    const typeLabel = typeFilter === 'ALL' ? 'Semua jenis' : getTypeConfig(typeFilter).label;
    const statusLabel = STATUS_FILTERS.find((s) => s.value === statusFilter)?.label ?? 'Semua status';
    const toggleStat = (value: string) => setStatusFilter(statusFilter === value ? 'ALL' : value);

    return (
        <div className="res-page">
            <ResHead icon={FileKey2} tone="mint" title="E-Form Access"
                description="Pengajuan akses VPN, website, dan jaringan beserta persetujuannya"
                actions={<Button variant="primary" onClick={handleCreateNew}><FilePlus2 aria-hidden="true" />Ajukan Akses</Button>} />

            <section className="res-stats is-six" aria-label="Ringkasan pengajuan">
                <ResStat icon={Layers} tone="neutral" label="Total" value={counts.total} active={statusFilter === 'ALL'} onClick={() => setStatusFilter('ALL')} />
                <ResStat icon={UserCheck} tone="amber" label="Menunggu Atasan" value={counts.pendingManager} attention={counts.pendingManager > 0} zero={counts.pendingManager === 0}
                    active={statusFilter === EFormStatus.PENDING_MANAGER} onClick={() => toggleStat(EFormStatus.PENDING_MANAGER)} />
                <ResStat icon={Loader} tone="blue" label="Diproses ICT" value={counts.pendingIct} zero={counts.pendingIct === 0}
                    active={statusFilter === EFormStatus.PENDING_ICT} onClick={() => toggleStat(EFormStatus.PENDING_ICT)} />
                <ResStat icon={CircleCheck} tone="green" label="Akses Siap" value={counts.confirmed} zero={counts.confirmed === 0}
                    active={statusFilter === EFormStatus.CONFIRMED} onClick={() => toggleStat(EFormStatus.CONFIRMED)} />
                <ResStat icon={Hourglass} tone="amber" label="Segera Berakhir" value={counts.expiringSoon} attention={counts.expiringSoon > 0} zero={counts.expiringSoon === 0}
                    active={statusFilter === 'EXPIRING_SOON'} onClick={() => toggleStat('EXPIRING_SOON')} />
                <ResStat icon={CircleX} tone="red" label="Ditolak" value={counts.rejected} zero={counts.rejected === 0}
                    active={statusFilter === EFormStatus.REJECTED} onClick={() => toggleStat(EFormStatus.REJECTED)} />
            </section>

            <div className="res-filters">
                <SegmentedControl aria-label="Daftar permintaan" className="dash-seg" value={tab} onValueChange={setTab}
                    options={[
                        { value: 'my-requests', label: 'Permintaan Saya', icon: FileText },
                        { value: 'pending-approvals', icon: Inbox, label: <>Perlu Persetujuan{pendingApprovals.length > 0 && <span className="res-tab-count is-alert">{pendingApprovals.length}</span>}</> },
                    ]} />
                <span className="res-spacer" />
                <SegmentedControl aria-label="Tampilan permintaan" className="dash-seg" value={viewMode} onValueChange={setViewMode}
                    options={[{ value: 'table', label: 'Tabel', icon: Rows3 }, { value: 'calendar', label: 'Kalender & Timeline', icon: CalendarRange }]} />
            </div>

            {viewMode === 'calendar' ? (
                <EformAccessCalendar requests={activeList} isLoading={isLoading} basePath={basePath} onOpenDetail={handleViewDetail} />
            ) : (
                <>
                    <div className="res-filters">
                        <ResSearch id="eform-search" value={searchTerm} onChange={setSearchTerm} placeholder="Cari nama pemohon atau ID permintaan" label="Cari permintaan" />
                        <FilterPop k="Jenis" shown={typeLabel} label="Saring jenis akses" value={typeFilter} onChange={setTypeFilter}
                            options={[{ value: 'ALL', label: 'Semua jenis' }, ...EFORM_TYPES.map(({ id, label }) => ({ value: id, label }))]} />
                        <FilterPop k="Status" shown={statusLabel} label="Saring status" value={statusFilter} onChange={setStatusFilter} options={STATUS_FILTERS} />
                        {isFiltered && <button type="button" className="res-reset" onClick={resetFilters}><X aria-hidden="true" />Reset</button>}
                    </div>

                    <ResTable label="Daftar E-Form" cols={EFORM_COLS} colsMobile="minmax(0,1fr) auto"
                        head={filteredRequests.length > 0 && !isLoading ? <><span>ID &amp; Jenis Akses</span><span>Pemohon</span><span>Status</span><span>Masa Berlaku</span><span className="is-right">Diajukan</span><span className="sr-only">Aksi</span></> : undefined}
                        foot={!isLoading && activeList.length > 0 ? (
                            <><span>Menampilkan {filteredRequests.length} dari {activeList.length} pengajuan</span><span className="res-muted">Diteruskan ke atasan pemohon, lalu diproses ICT</span></>
                        ) : undefined}>
                        {isLoading ? <ResSkeletonRows rows={5} /> : filteredRequests.length === 0 ? (
                            <EmptyState isFiltered={isFiltered} isApprovalTab={isApprovalTab} onReset={resetFilters} onCreate={handleCreateNew} />
                        ) : filteredRequests.map((req) => (
                            <EformListRow key={req.id} request={req} isApprovalTab={isApprovalTab} onOpen={() => handleViewDetail(req.id)} />
                        ))}
                    </ResTable>
                </>
            )}
        </div>
    );
};

/** Mockup eform.html COLS: ID & Jenis · Pemohon · Status · Masa Berlaku · Diajukan · chevron/aksi. */
const EFORM_COLS = 'minmax(220px,1.4fr) minmax(190px,1.2fr) 150px minmax(150px,1fr) 80px 130px';
const TYPE_TINT = 'var(--res-mint)';

interface FilterPopProps {
    k: string;
    shown: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: readonly { value: string; label: string }[];
}

const FilterPop: React.FC<FilterPopProps> = ({ k, shown, label, value, onChange, options }) => (
    <DropdownMenu>
        <DropdownMenuTrigger asChild>
            <button type="button" className="queue-pop" aria-label={`${label}: ${shown}`}>
                <span className="queue-pop-k">{k}</span><span className="queue-pop-v">{shown}</span><ChevronDown aria-hidden="true" />
            </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" variant="compact" className="res-pop-menu" aria-label={label}>
            <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
                {options.map((o) => <DropdownMenuRadioItem key={o.value} value={o.value}>{o.label}</DropdownMenuRadioItem>)}
            </DropdownMenuRadioGroup>
        </DropdownMenuContent>
    </DropdownMenu>
);

/** Mockup status bubble hues (eform.html ST). */
const STATUS_BUB: Record<string, { color: string; ink?: string }> = {
    [EFormStatus.PENDING_MANAGER]: { color: 'var(--dash-orange)', ink: 'var(--dash-ink-orange)' },
    [EFormStatus.PENDING_ICT]: { color: 'var(--dash-blue)' },
    [EFormStatus.CONFIRMED]: { color: 'var(--dash-green)', ink: 'var(--dash-ink-green)' },
    [EFormStatus.REJECTED]: { color: 'var(--dash-red)', ink: 'var(--dash-ink-red)' },
    [EFormStatus.DRAFT]: { color: 'var(--dash-gray)' },
};

const EformStatusBub: React.FC<{ status: string }> = ({ status }) => {
    const bub = STATUS_BUB[status] ?? STATUS_BUB[EFormStatus.DRAFT];
    return <ResBub color={bub.color} ink={bub.ink}>{getStatusConfig(status).label}</ResBub>;
};

const VALIDITY_FMT: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
const fmtDay = (value?: string | null) => {
    if (!value) return null;
    const [y, m, d] = value.split('-').map(Number);
    if (!y || !m || !d) return value;
    return new Date(y, m - 1, d).toLocaleDateString('id-ID', VALIDITY_FMT);
};

/** "21 Okt – 20 Jan" / "Permanen" / "—" from the real form dates. */
const validityText = (request: EFormRequest) => {
    const from = fmtDay(request.formData?.dariTanggal);
    const to = fmtDay(request.formData?.sampaiTanggal);
    if (from && to) return `${from} – ${to}`;
    if (from) return `${from} – Permanen`;
    if (request.status === EFormStatus.REJECTED) return '—';
    return to ? `s/d ${to}` : 'Permanen';
};

interface EformListRowProps {
    request: EFormRequest;
    isApprovalTab: boolean;
    onOpen: () => void;
}

const EformListRow: React.FC<EformListRowProps> = ({ request, isApprovalTab, onOpen }) => {
    const type = getTypeConfig(request.formType);
    const TypeIcon = type.icon;
    const submitted = new Date(request.createdAt).toLocaleDateString('id-ID', VALIDITY_FMT);
    const exp = calculateExpirationStatus(request.formData?.sampaiTanggal, request.status);
    const soon = Boolean(exp.isExpiringSoon || exp.isToday);
    const expired = Boolean(exp.isExpired);
    const name = request.requesterName || '—';

    return (
        <div className="res-row is-link" aria-label={`${type.label} ${shortId(request.id)}: ${name}`} {...rowActivation(onOpen)}>
            <div className="queue-person">
                <span className="res-type-ico" style={resVars({ '--c': TYPE_TINT })}><TypeIcon aria-hidden="true" /></span>
                <div className="min-w-0"><b>{type.label}</b><small className="font-mono">{shortId(request.id)}</small></div>
            </div>
            <div className="queue-person res-hide-m">
                <DashAvatar name={name} />
                <div className="min-w-0"><b>{name}</b>{request.requesterDepartment && <small>{request.requesterDepartment}</small>}</div>
            </div>
            <span><EformStatusBub status={request.status} /></span>
            <span className="res-cell res-hide-m">
                {soon || expired ? (
                    <ResBub icon={Hourglass} color={expired ? 'var(--dash-red)' : 'var(--dash-orange)'} ink={expired ? 'var(--dash-ink-red)' : 'var(--dash-ink-orange)'} title={exp.label}>
                        {validityText(request)}
                    </ResBub>
                ) : validityText(request)}
            </span>
            <span className="res-date res-hide-m">{submitted}</span>
            <span className="res-acts res-hide-m">
                {request.status === EFormStatus.CONFIRMED && (
                    <button type="button" className="res-icon-btn" title="Unduh PDF F-ICT-04" aria-label={`Unduh PDF F-ICT-04 ${name}`}
                        onClick={(e) => { e.stopPropagation(); downloadEformPdf(request.id, `F-ICT-04-${name.replace(/\s+/g, '_')}.pdf`); }}>
                        <Download aria-hidden="true" />
                    </button>
                )}
                <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-[hsl(var(--idesk-sapphire))]">
                    {isApprovalTab ? 'Tinjau' : 'Detail'}<ChevronRight className="res-chev" aria-hidden="true" />
                </span>
            </span>
        </div>
    );
};

const shortId = (id: string) => `#${id.slice(0, 8).toUpperCase()}`;

interface EmptyStateProps {
    isFiltered: boolean;
    isApprovalTab: boolean;
    onReset: () => void;
    onCreate: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({ isFiltered, isApprovalTab, onReset, onCreate }) => {
    if (isFiltered) {
        return (
            <ResEmpty icon={SearchX} title="Tidak ada yang cocok" cta={<Button variant="soft" onClick={onReset}>Hapus saringan</Button>}>
                Coba ubah filter atau kata kunci.
            </ResEmpty>
        );
    }
    if (isApprovalTab) {
        return <ResEmpty icon={CircleCheck} title="Semua sudah ditinjau">Tidak ada permintaan yang menunggu persetujuan Anda saat ini.</ResEmpty>;
    }
    return (
        <ResEmpty icon={FileText} title="Belum ada pengajuan"
            cta={<button type="button" className="idesk-text-link" onClick={onCreate}>Ajukan akses<ArrowRight aria-hidden="true" /></button>}>
            Ajukan akses VPN, website, atau jaringan. Permintaan diteruskan ke atasan Anda, lalu ke tim ICT untuk disiapkan.
        </ResEmpty>
    );
};
