import React, { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { LayoutGrid, Layers, Inbox, CircleCheck, TriangleAlert, Gauge, RefreshCw, ServerCrash, TrendingUp, TrendingDown, Users } from 'lucide-react';
import api from '../../../lib/api';
import { useTicketListSocket } from '@/hooks/useTicketSocket';
import { useAuth } from '@/stores/useAuth';
import { Button } from '@/components/ui/button';
import type { Ticket as TicketType } from '@/types/ticket.types';
import { DashboardSkeleton } from '../components/DashboardSkeleton';
import { MyRatingCard } from '../components/MyRatingCard';
import { CsiPendingCard } from '@/features/csi/components/CsiPendingCard';
import {
    cssVars, DASH_COLORS, DashChartSkeleton, DashDonut, DashEmpty, DashLive, DashMore, DashPanel, DashSeg, DashStat, type DonutItem,
} from '../components/DashboardParts';
import { computeTeamStats, TEAM_RANGES, toIndonesianDuration, type TeamRange } from './teamDashboard.stats';
import { TeamActivityChart } from './TeamActivityChart';
import { TeamFeed, TeamRecentTickets, TeamTopAgents } from './TeamDashboardLists';
import { DONE_STATUS_FILTER } from '@/features/ticket-board/constants/statusFilters';
import { useQueueStats, type StatsQueue } from '@/features/ticket-board/hooks/useQueueStats';
import { CustomDropdown } from '@/features/ticket-board/components/TicketDropdowns';
import { SiteSelector } from '@/components/site/SiteSelector';
import { ALL_TEAMS_LABEL, REPORT_TEAMS_SCOPE_TITLE, TEAM_FILTER_ORDER, reportTeamLabel, type ReportTeam } from '@/features/reports/reportTeams';

interface DashboardStats {
    avgResolutionTime: string;
}

/** Matches the backend's 15s dashboard-stats cache; socket events still invalidate immediately. */
const DASHBOARD_STALE_TIME_MS = 15_000;
const NEW_TICKET_TOAST_MS = 8000;
const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const RANGE_OPTIONS = TEAM_RANGES.map((r) => ({ value: String(r) as `${TeamRange}`, label: `${r}h` }));
const CATEGORY_CHART_COLOR = DASH_COLORS.accent;
type FeedView = 'live' | 'recent';
const FEED_OPTIONS: readonly { value: FeedView; label: string }[] = [
    { value: 'live', label: 'Aktivitas live' },
    { value: 'recent', label: 'Tiket terbaru' },
];

const isAgentRole = (role?: string) => role === 'AGENT' || Boolean(role?.startsWith('AGENT_'));

/**
 * Queue whose server-side counts match what `/tickets` loads for the role. `/tickets` stops at 500 rows,
 * so the stat cards and donuts come from the server; charts and lists stay on the loaded tickets.
 * Roles not listed keep the counts computed from the loaded tickets.
 */
const SERVER_COUNT_QUEUE: Readonly<Record<string, StatsQueue>> = {
    ADMIN: 'all',
    AGENT: 'it-support',
    AGENT_ADMIN: 'it-support',
    AGENT_OPERATIONAL_SUPPORT: 'it-support',
    MANAGER: 'all',
};
/** ADMIN / MANAGER see every ICT team and site, and narrow the whole dashboard by team and site. */
const OVERSIGHT_ROLES = ['ADMIN', 'MANAGER'];
const ALL_VALUE = 'ALL';
const TEAM_OPTIONS = [{ value: ALL_VALUE, label: ALL_TEAMS_LABEL }, ...TEAM_FILTER_ORDER.map((t) => ({ value: t, label: reportTeamLabel(t) }))];

/** Same team / site in the list the stat cards link to. */
function listQuery(team: ReportTeam | null, siteId: string | null, extra = ''): string {
    const params = new URLSearchParams(extra);
    if (team) params.set('team', team);
    if (siteId) params.set('sites', siteId);
    const query = params.toString();
    return query ? `?${query}` : '';
}

/** Where the dashboard links lead: the manager portal has its own list, reports and workload routes. */
interface DashboardLinks { tickets: string; reports: string; agents: string; agentsLabel: string; myTasks: boolean }
const STAFF_LINKS: DashboardLinks = { tickets: '/tickets/list', reports: '/reports', agents: '/agents', agentsLabel: 'Semua agent', myTasks: true };
const MANAGER_LINKS: DashboardLinks = { tickets: '/manager/tickets', reports: '/manager/reports', agents: '/manager/workloads', agentsLabel: 'Workload agent', myTasks: false };

function updatedLabel(dataUpdatedAt: number): string | null {
    if (!dataUpdatedAt) return null;
    const minutes = Math.floor((Date.now() - dataUpdatedAt) / MS_PER_MINUTE);
    if (minutes < 1) return 'baru saja';
    if (minutes < MINUTES_PER_HOUR) return `${minutes} menit lalu`;
    return `${Math.floor(minutes / MINUTES_PER_HOUR)} jam lalu`;
}

/** "HARDWARE_ISSUE" -> "Hardware issue". */
const categoryLabel = (cat: string) => {
    const words = cat.replace(/_/g, ' ').toLowerCase();
    return words.charAt(0).toUpperCase() + words.slice(1);
};

/** Trend baseline: Sunday 00:00 → the same moment last week (see computeTeamStats weekChange). */
const TREND_BASIS = 'dibanding periode yang sama minggu lalu';

const WeekTrend: React.FC<{ change: number | null }> = ({ change }) => {
    if (change === null || change === 0) return null;
    const up = change > 0;
    const Icon = up ? TrendingUp : TrendingDown;
    return (
        <span className="dash-trend" title={`${up ? 'Naik' : 'Turun'} ${Math.abs(change)}% ${TREND_BASIS}`}
            style={cssVars({ '--trend-ink': up ? DASH_COLORS.inkGreen : DASH_COLORS.inkRed })}>
            <Icon aria-hidden="true" />{up ? '+' : ''}{change}%
        </span>
    );
};

/** Team dashboard (mockup dashboard-team.html): totals, 7/14/30-day activity, status/priority, categories, live feed, top agents. */
export const BentoDashboardPage = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const canOpenAgentDashboard = user?.role === 'ADMIN' || user?.role === 'MANAGER';
    const links = user?.role === 'MANAGER' ? MANAGER_LINKS : STAFF_LINKS;
    const oversight = OVERSIGHT_ROLES.includes(user?.role ?? '');
    const [team, setTeam] = useState<ReportTeam | null>(null);
    const [siteId, setSiteId] = useState<string | null>(null);
    const [range, setRange] = useState<TeamRange>(7);
    const [reloading, setReloading] = useState(false);
    const [feedView, setFeedView] = useState<FeedView>('live');

    const handleNewTicket = useCallback((ticket: { id: string; ticketNumber?: string; title?: string }) => {
        if (user?.role === 'ADMIN' || user?.role === 'AGENT') {
            toast.info('Tiket baru masuk', {
                description: `${ticket.ticketNumber || ''}: ${ticket.title}`,
                action: { label: 'Lihat', onClick: () => navigate(`/tickets/${ticket.id}`) },
                duration: NEW_TICKET_TOAST_MS,
            });
        }
    }, [user, navigate]);

    // useTicketListSocket already invalidates ['tickets'] and ['dashboard-stats']; no second refetch here.
    const { isConnected } = useTicketListSocket({ onNewTicket: handleNewTicket });

    const { data: allTickets = [], isError: ticketsError, error: ticketsErrorData, refetch: refetchTickets, dataUpdatedAt } = useQuery<TicketType[]>({
        queryKey: ['tickets', 'team-dashboard', team ?? 'all'],
        queryFn: async () => (await api.get(team ? `/tickets?handlingTeam=${team}` : '/tickets')).data,
        staleTime: DASHBOARD_STALE_TIME_MS,
        refetchOnWindowFocus: true,
    });
    const { data: stats, isLoading, isError: statsError, error: statsErrorData, refetch: refetchStats } = useQuery<DashboardStats>({
        queryKey: ['dashboard-stats'],
        queryFn: async () => (await api.get('/tickets/dashboard/stats')).data,
        staleTime: DASHBOARD_STALE_TIME_MS,
        refetchOnWindowFocus: true,
    });

    // The site filter narrows the loaded tickets here; the team filter is applied by the server.
    const tickets = useMemo(() => (siteId ? allTickets.filter((t) => t.siteId === siteId) : allTickets), [allTickets, siteId]);
    const countQueue = SERVER_COUNT_QUEUE[user?.role ?? ''];
    const countScope = useMemo(() => ({ siteIds: siteId ? [siteId] : [], assignedToMe: false, createdByMe: false, handlingTeam: team ?? undefined }), [siteId, team]);
    const { data: serverCounts } = useQueueStats(countQueue ?? 'it-support', countScope, Boolean(countQueue));

    const live = useMemo(() => {
        const local = computeTeamStats(tickets, range);
        if (!serverCounts) return local;
        const { total, open, inProgress, waitingVendor, resolved, overdue, byPriority } = serverCounts;
        return { ...local, total, open, inProgress, waitingVendor, resolved, overdue, byPriority: byPriority ?? local.byPriority };
    }, [tickets, range, serverCounts]);
    const lastUpdated = updatedLabel(dataUpdatedAt);

    const handleRefresh = () => {
        setReloading(true);
        Promise.all([refetchTickets(), refetchStats()]).finally(() => {
            setReloading(false);
            toast.success('Dashboard diperbarui');
        });
    };

    if (user?.role === 'AGENT_ORACLE') return <Navigate to="/tickets/oracle-k2" replace />;

    if (ticketsError || statsError) {
        const errorMessage = (ticketsErrorData as Error)?.message || (statsErrorData as Error)?.message || 'Data dashboard tidak dapat dimuat.';
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
                <ServerCrash className="w-12 h-12 text-[hsl(var(--ticket-red))]" aria-hidden="true" />
                <div className="grid gap-1">
                    <h2 className="text-xl font-bold text-foreground">Dashboard gagal dimuat</h2>
                    <p className="text-sm text-muted-foreground max-w-md">{errorMessage}</p>
                </div>
                <Button variant="primary" onClick={handleRefresh}><RefreshCw aria-hidden="true" />Coba lagi</Button>
            </div>
        );
    }

    if (isLoading && tickets.length === 0) return <DashboardSkeleton variant="team" />;

    const statusData: DonutItem[] = [
        { label: 'Open', value: live.open, color: DASH_COLORS.sky },
        { label: 'In Progress', value: live.inProgress, color: DASH_COLORS.navy },
        { label: 'Waiting', value: live.waitingVendor, color: DASH_COLORS.orange },
        { label: 'Resolved', value: live.resolved, color: DASH_COLORS.green },
    ];
    const priorityData: DonutItem[] = [
        { label: 'Blocker (Critical)', value: live.byPriority.CRITICAL, color: DASH_COLORS.red },
        { label: 'Urgent (Major Impact)', value: live.byPriority.HIGH, color: DASH_COLORS.orange },
        { label: 'Normal (Moderate)', value: live.byPriority.MEDIUM, color: DASH_COLORS.blue },
        { label: 'Low (Minor/Cosmetic)', value: live.byPriority.LOW, color: DASH_COLORS.gray },
    ];
    const catMax = Math.max(1, ...live.byCategory.map((c) => c.count));
    const openActive = live.open + live.inProgress;

    return (
        <div className="dash">
            <header className="dash-head">
                <span className="nav-tile dash-ptile" data-tone="navy"><LayoutGrid aria-hidden="true" /></span>
                <div className="min-w-0">
                    <h1>Dashboard Tim</h1>
                    <p>{oversight
                        ? `Ringkasan seluruh tiket ICT · ${team ? reportTeamLabel(team) : ALL_TEAMS_LABEL}`
                        : 'Ringkasan performa iDesk untuk semua site Anda'}</p>
                    {lastUpdated && <p className="dash-meta">Diperbarui {lastUpdated}</p>}
                </div>
                <span className="dash-spacer" />
                <div className="dash-head-actions">
                    {oversight && (
                        <>
                            <CustomDropdown value={team ?? ''} filterKey={REPORT_TEAMS_SCOPE_TITLE} placeholder={ALL_TEAMS_LABEL}
                                options={TEAM_OPTIONS} onChange={(v) => setTeam(v && v !== ALL_VALUE ? (v as ReportTeam) : null)} />
                            <SiteSelector mode="single" variant="pop" selectedSiteIds={siteId ? [siteId] : []}
                                onSelectionChange={(ids) => setSiteId(ids[0] ?? null)} />
                        </>
                    )}
                    {links.myTasks && <Button variant="soft" asChild><Link to={`${links.tickets}?filter=assigned_to_me`}><Users aria-hidden="true" />Tugas Saya</Link></Button>}
                    <Button variant="soft" onClick={handleRefresh} loading={reloading}>{!reloading && <RefreshCw aria-hidden="true" />}Muat ulang</Button>
                </div>
            </header>

            <CsiPendingCard className="mb-4" />

            <section className="dash-stats is-five" aria-label="Ringkasan tiket">
                <DashStat icon={Layers} tone="neutral" label="Total tiket" value={live.total} zero={live.total === 0} to={`${links.tickets}${listQuery(team, siteId)}`}
                    sub={<>{live.thisWeekTickets} minggu ini <WeekTrend change={live.weekChange.created} /></>} />
                <DashStat icon={Inbox} tone="blue" label="Open & aktif" value={openActive} zero={openActive === 0} to={`${links.tickets}${listQuery(team, siteId, 'status=TODO,IN_PROGRESS')}`}
                    sub={`${live.todayTickets} baru hari ini`} />
                <DashStat icon={CircleCheck} tone="green" label="Resolved" value={live.resolved} zero={live.resolved === 0} to={`${links.tickets}${listQuery(team, siteId, `status=${DONE_STATUS_FILTER}`)}`}
                    sub={live.weekChange.resolved
                        ? <><WeekTrend change={live.weekChange.resolved} /> vs periode sama minggu lalu · {live.resolvedToday} hari ini</>
                        : `${live.resolvedToday} selesai hari ini`} />
                <DashStat icon={TriangleAlert} tone="red" label="Overdue" value={live.overdue} attention={live.overdue > 0} zero={live.overdue === 0} to={`${links.tickets}${listQuery(team, siteId, 'overdue=1')}`}
                    sub={live.overdue > 0 ? 'Perlu tindakan' : 'Semua tepat waktu'} />
                <DashStat icon={Gauge} tone="navy" label="Kepatuhan SLA" value={live.slaCompliance === null ? '—' : `${live.slaCompliance.toLocaleString('id-ID')}%`} zero={live.slaCompliance === null}
                    sub={`Rata-rata selesai ${toIndonesianDuration(stats?.avgResolutionTime)}`} />
            </section>

            <div className="dgrid">
                <DashPanel className="s8 is-fill" label="Aktivitas tiket" title={<>
                    Aktivitas tiket <DashLive connected={isConnected} />
                    <DashSeg small aria-label="Rentang" options={RANGE_OPTIONS} value={String(range) as `${TeamRange}`} onChange={(v) => setRange(Number(v) as TeamRange)} />
                </>}>
                    <p className="dash-panel-sub">Tiket dibuat vs diselesaikan ({range} hari terakhir)</p>
                    {reloading ? <DashChartSkeleton /> : <TeamActivityChart days={live.days} range={range} />}
                </DashPanel>
                <div className="dash-stack s4">
                    <DashPanel title="Per status"><DashDonut items={statusData} label="Tiket per status" /></DashPanel>
                    <DashPanel title="Per prioritas"><DashDonut items={priorityData} label="Tiket per prioritas" /></DashPanel>
                </div>
            </div>

            <div className="dgrid">
                <DashPanel className="s4" label="Tiket per kategori" title={<>Tiket per kategori <DashMore to={links.reports}>Laporan</DashMore></>}>
                    {live.byCategory.length === 0 ? <DashEmpty>Belum ada tiket.</DashEmpty> : (
                        <ul className="dash-list">
                            {live.byCategory.map(({ category, count }) => (
                                <li key={category}>
                                    <button type="button" className="dash-li dash-cat" onClick={() => navigate(`${links.tickets}${listQuery(team, siteId, `category=${encodeURIComponent(category)}`)}`)}>
                                        <span><span>{categoryLabel(category)}</span><b>{count}</b></span>
                                        <span className="dash-meter"><i style={cssVars({ '--p': `${(count / catMax) * 100}%`, '--c': CATEGORY_CHART_COLOR })} /></span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </DashPanel>
                <DashPanel className="s4 dash-feed" label="Aktivitas tim" title={<>
                    <DashSeg small aria-label="Tampilan feed" options={FEED_OPTIONS} value={feedView} onChange={setFeedView} />
                    <DashLive connected={isConnected} />
                </>}>
                    {feedView === 'live' ? <TeamFeed tickets={live.recentTickets} /> : <TeamRecentTickets tickets={live.recentTickets} />}
                </DashPanel>
                <DashPanel className="s4 is-wide-md" label="Agent terbaik" title={<>Agent terbaik <DashMore to={links.agents}>{links.agentsLabel}</DashMore></>}>
                    <TeamTopAgents agents={live.topAgents} linkAgents={canOpenAgentDashboard} />
                </DashPanel>
            </div>

            {isAgentRole(user?.role) && (
                <div className="dgrid"><MyRatingCard className="s4 is-wide-md" /></div>
            )}
        </div>
    );
};
