import React from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow, format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { ChevronDown, LayoutDashboard, RefreshCw, UserSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { DashAvatar, DashBub, DashSeg, DASH_COLORS, PRIORITY_DOT, cssVars } from '@/features/dashboard/components/DashboardParts';
import '@/components/management/management.css';
import { ResEmpty, ResSearch, ResSkeletonRows, ResRow, ResTable } from '@/components/resources/ResourceParts';
import type { AgentWorkloadDto } from '@/lib/api/workload.api';
import { agentDashboardPath } from '@/lib/roleHome';

export type FilterStatus = 'ALL' | 'STANDBY' | 'ACTIVE';
export type SortOption = 'POINTS_ASC' | 'POINTS_DESC' | 'NAME_ASC' | 'TICKETS_DESC';

const SORT_LABELS: Readonly<Record<SortOption, string>> = {
    POINTS_ASC: 'Poin terendah', POINTS_DESC: 'Poin tertinggi', TICKETS_DESC: 'Tiket terbanyak', NAME_ASC: 'Nama A-Z',
};
const ROLE_LABELS: Readonly<Record<string, string>> = {
    ADMIN: 'Admin', AGENT: 'Agent', AGENT_ADMIN: 'Agent Admin', AGENT_ORACLE: 'Oracle Specialist', AGENT_OPERATIONAL_SUPPORT: 'Ops Support', MANAGER: 'Manager',
};
/** Points at which the capacity meter is full (production thresholds: 0 / ≤3 / ≤6 / >6). */
const FULL_POINTS = 8;
const VISIBLE_TICKETS = 3;
const COLS = 'minmax(220px,1.4fr) 130px minmax(200px,1.3fr) 80px minmax(180px,1.4fr) 120px';
const COLS_ACTIONS = `${COLS} 72px`;

interface Level { label: string; color: string; hint: string }
const level = (points: number): Level => {
    if (points === 0) return { label: 'Standby', color: DASH_COLORS.green, hint: 'Siap & prioritas utama menerima tiket baru berikutnya' };
    if (points <= 3) return { label: 'Optimal', color: DASH_COLORS.blue, hint: 'Beban kerja seimbang dan dalam ritme penanganan ideal' };
    if (points <= 6) return { label: 'Padat', color: DASH_COLORS.orange, hint: 'Beban cukup tinggi, fokus selesaikan tiket prioritas' };
    return { label: 'Tinggi', color: DASH_COLORS.red, hint: 'Kapasitas maksimal, tiket baru dialihkan ke rekan lain' };
};
const titleCase = (v: string) => v.toLowerCase().replace(/\w/g, (c) => c.toUpperCase());
const roleLabel = (role: string) => ROLE_LABELS[role] ?? titleCase(role.replace('AGENT_', '').replace(/_/g, ' '));

interface Metrics { totalAgents: number; standbyAgents: number; activeAgents: number; minPoints: number }

interface WorkloadTableProps {
    agents: AgentWorkloadDto[];
    rows: AgentWorkloadDto[];
    loading: boolean;
    metrics: Metrics;
    currentUserId?: string;
    showActions: boolean;
    isAdmin: boolean;
    recalculating: string | null;
    onRecalculate: (agentId: string) => void;
    searchTerm: string;
    onSearch: (v: string) => void;
    statusFilter: FilterStatus;
    onStatus: (v: FilterStatus) => void;
    sortBy: SortOption;
    onSort: (v: SortOption) => void;
}

const TicketChip: React.FC<{ t: AgentWorkloadDto['activeTickets'][number] }> = ({ t }) => (
    <Link to={`/tickets/${t.id}`} className="dash-bub mono" title={`${t.ticketNumber}: ${t.title}`}
        style={cssVars({ '--c': PRIORITY_DOT[t.priority?.toUpperCase()] ?? DASH_COLORS.gray })}>
        {t.ticketNumber}
    </Link>
);

const Tickets: React.FC<{ agent: AgentWorkloadDto }> = ({ agent }) => {
    const tickets = agent.activeTickets || [];
    if (tickets.length === 0) return <span className="res-muted">Belum ada</span>;
    const rest = tickets.length - VISIBLE_TICKETS;
    return (
        <div className="mg-ticket-chips">
            {tickets.slice(0, VISIBLE_TICKETS).map((t) => <TicketChip key={t.id} t={t} />)}
            {rest > 0 && (
                <Popover>
                    <PopoverTrigger asChild>
                        <button type="button" className="dash-bub" style={cssVars({ '--c': DASH_COLORS.gray })} aria-label={`${rest} tiket lainnya milik ${agent.agentName}`}>+{rest} lainnya</button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-3 rounded-xl">
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-[hsl(var(--border))] text-xs font-semibold">
                            <span>Tiket Aktif: {agent.agentName}</span><span className="res-muted">{tickets.length} Tiket</span>
                        </div>
                        <ul className="dash-list max-h-60 overflow-y-auto">
                            {tickets.map((t) => (
                                <li key={t.id}>
                                    <Link to={`/tickets/${t.id}`} className="dash-li">
                                        <span className="dash-pdot" style={cssVars({ '--c': PRIORITY_DOT[t.priority?.toUpperCase()] ?? DASH_COLORS.gray })} aria-hidden="true" />
                                        <span className="grow1"><b className="mono">{t.ticketNumber}</b><small>{t.title}</small></span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </PopoverContent>
                </Popover>
            )}
        </div>
    );
};

export const WorkloadTable: React.FC<WorkloadTableProps> = ({
    agents, rows, loading, metrics, currentUserId, showActions, isAdmin, recalculating, onRecalculate,
    searchTerm, onSearch, statusFilter, onStatus, sortBy, onSort,
}) => {
    const optimal = agents.filter((a) => (a.totalPoints || 0) > 0 && (a.totalPoints || 0) <= 3).length;
    const busy = agents.filter((a) => (a.totalPoints || 0) > 3).length;
    return (
        <ResTable label="Distribusi beban" cols={showActions ? COLS_ACTIONS : COLS} colsMobile="minmax(0,1fr) auto"
            tools={(
                <>
                    <h3>Distribusi Beban Rekan Tim ({agents.length} Agen)</h3>
                    <span className="res-muted">{metrics.standbyAgents} Standby • {metrics.activeAgents} Bertugas</span>
                </>
            )}
            subTools={(
                <>
                <ResSearch id="workload-search" value={searchTerm} onChange={onSearch} placeholder="Cari nama / email agen..." label="Cari agen" />
                <DashSeg aria-label="Status" value={statusFilter} onChange={onStatus} options={[
                    { value: 'ALL', label: `Semua (${agents.length})` },
                    { value: 'STANDBY', label: `Standby (${metrics.standbyAgents})` },
                    { value: 'ACTIVE', label: `Bertugas (${metrics.activeAgents})` },
                ]} />
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button type="button" className="queue-pop" aria-label={`Urutkan: ${SORT_LABELS[sortBy]}`}>
                            <span className="queue-pop-k">Urutkan</span><span className="queue-pop-v">{SORT_LABELS[sortBy]}</span><ChevronDown aria-hidden="true" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" variant="compact" className="res-pop-menu" aria-label="Urutkan">
                        <DropdownMenuRadioGroup value={sortBy} onValueChange={(v) => onSort(v as SortOption)}>
                            {(Object.keys(SORT_LABELS) as SortOption[]).map((k) => <DropdownMenuRadioItem key={k} value={k}>{SORT_LABELS[k]}</DropdownMenuRadioItem>)}
                        </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                </DropdownMenu>
                </>
            )}
            head={rows.length > 0 ? (
                <>
                    <span>Agen Operasional</span><span>Peran</span><span>Beban Kerja &amp; Kapasitas</span><span>Evaluasi</span>
                    <span>Tiket Sedang Ditangani</span><span className="is-right">Penugasan Terakhir</span>
                    {showActions && <span className="is-right">Aksi</span>}
                </>
            ) : undefined}
            foot={(
                <>
                    <span>Sistem mengalokasikan tiket baru ke agen dengan akumulasi bobot paling rendah.</span>
                    <span className="res-foot-right">
                        <span>Menampilkan {rows.length} dari {agents.length} agen</span>
                        <span className="res-muted">Standby {metrics.standbyAgents} · Optimal {optimal} · Padat {busy}</span>
                    </span>
                </>
            )}>
            {loading && agents.length === 0 ? <ResSkeletonRows rows={5} /> : rows.length === 0 ? (
                <ResEmpty icon={UserSearch} title="Tidak ada agen yang cocok"
                    cta={searchTerm ? <Button variant="subtle" onClick={() => onSearch('')}>Reset filter</Button> : undefined}>
                    {searchTerm ? 'Coba ubah filter atau kata kunci.' : 'Belum ada agen operasional terdaftar di site ini.'}
                </ResEmpty>
            ) : rows.map((agent) => {
                const points = agent.totalPoints || 0;
                const lv = level(points);
                const isMe = currentUserId === agent.agentId;
                const isNext = points === metrics.minPoints && metrics.totalAgents > 1;
                const pct = Math.min(points / FULL_POINTS, 1) * 100;
                return (
                    <ResRow key={agent.agentId} className="is-static" data-me={isMe || undefined}>
                        <div className="queue-person">
                            <DashAvatar name={agent.agentName || '?'} />
                            <div className="min-w-0">
                                <b className="flex items-center gap-1.5">
                                    <span className="truncate">{agent.agentName}</span>
                                    {isMe && <DashBub color={DASH_COLORS.accent} className="is-when" ink="hsl(var(--idesk-sapphire))">Saya</DashBub>}
                                    {isNext && <DashBub color={DASH_COLORS.green} ink={DASH_COLORS.inkGreen} className="is-when" title="Agen berikutnya yang menerima tiket baru">next</DashBub>}
                                </b>
                                <small>{agent.email}</small>
                            </div>
                        </div>
                        <span className="res-hide-m"><DashBub color={DASH_COLORS.gray}>{roleLabel(agent.role)}</DashBub></span>
                        <div className="res-meter-cell res-wide-m" title={`${lv.label}: ${lv.hint}`}>
                            <span>
                                <b>{points}</b><span className="res-muted text-[11.5px]">pts</span>
                                <DashBub color={lv.color}><span className="res-dot" aria-hidden="true" />{lv.label}</DashBub>
                            </span>
                            <span className="dash-meter" style={cssVars({ '--c': lv.color })}><i style={cssVars({ '--p': `${pct}%` })} /></span>
                        </div>
                        <span className="res-cell is-num res-hide-m">{agent.appraisalPoints || 0}</span>
                        <div className="res-hide-m"><Tickets agent={agent} /></div>
                        <span className="res-date res-hide-m">
                            {agent.lastAssignedAt ? (
                                <span title={formatDistanceToNow(new Date(agent.lastAssignedAt), { addSuffix: true, locale: idLocale })}>
                                    {format(new Date(agent.lastAssignedAt), 'd MMM, HH.mm', { locale: idLocale })}
                                </span>
                            ) : '—'}
                        </span>
                        {showActions && (
                            <div className="res-acts mg-row-acts">
                                <Button asChild variant="subtle" size="icon">
                                    <Link to={agentDashboardPath(agent.agentId)} title="Lihat dashboard agen" aria-label={`Lihat dashboard ${agent.agentName}`}><LayoutDashboard aria-hidden="true" /></Link>
                                </Button>
                                {isAdmin && (
                                    <Button variant="subtle" size="icon" onClick={() => onRecalculate(agent.agentId)} loading={recalculating === agent.agentId}
                                        title="Sinkronisasi ulang beban agen dari tiket aktif" aria-label={`Sinkronisasi ulang beban ${agent.agentName}`}>
                                        {recalculating !== agent.agentId && <RefreshCw aria-hidden="true" />}
                                    </Button>
                                )}
                            </div>
                        )}
                    </ResRow>
                );
            })}
        </ResTable>
    );
};
