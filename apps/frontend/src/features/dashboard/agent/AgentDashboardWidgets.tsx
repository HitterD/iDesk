import React from 'react';
import { Link } from 'react-router-dom';
import {
    Award, CalendarClock, ChevronRight, CircleCheck, Gauge, Inbox, Pause, PartyPopper, Star, Timer, TriangleAlert, Wrench,
} from 'lucide-react';
import { PRIORITY_CONFIG, STATUS_CONFIG } from '@/lib/constants/ticket.constants';
import { formatDuration, formatSlaCompact, formatWibDateTime } from './agentDashboard.format';
import type { AgentDashboardData, AgentTicketStats, InstallItem } from './agentDashboard.types';
import {
    cssVars, DASH_COLORS, DashBub, DashEmpty, DashMetric, DashMore, DashPanel, DashSkeletonList, DashStat,
} from '../components/DashboardParts';

const ATTENTION_LIMIT = 6;

/** Mockup PRI_DOT: Blocker red, Urgent orange, Normal blue, Low gray. */
const PRIORITY_DOT: Readonly<Record<string, string>> = {
    CRITICAL: DASH_COLORS.red, HIGH: DASH_COLORS.orange, MEDIUM: DASH_COLORS.blue, LOW: DASH_COLORS.gray,
};

/** Four stat cards: active, overdue, resolved, SLA (mockup `.stats.four`). */
export const SummaryTiles: React.FC<{ stats: AgentTicketStats; ticketsHref?: string }> = ({ stats, ticketsHref }) => {
    const activeParts = [`${stats.todo} open`, `${stats.inProgress} dikerjakan`];
    if (stats.waitingVendor > 0) activeParts.push(`${stats.waitingVendor} tunggu vendor`);
    return (
        <section className="dash-stats is-four" aria-label="Ringkasan">
            <DashStat icon={Inbox} tone="blue" label="Tiket aktif" value={stats.active} zero={stats.active === 0} sub={activeParts.join(' · ')} to={ticketsHref} />
            <DashStat icon={TriangleAlert} tone="red" label="Lewat SLA" value={stats.overdue} attention={stats.overdue > 0} zero={stats.overdue === 0}
                sub={stats.overdue > 0 ? 'Segera tindak lanjuti' : 'Semua tiket masih tepat waktu'} to={ticketsHref} />
            <DashStat icon={CircleCheck} tone="green" label="Selesai hari ini" value={stats.resolvedToday} zero={stats.resolvedToday === 0}
                sub={`${stats.resolvedThisWeek} minggu ini · ${stats.resolvedThisMonth} bulan ini`} to={ticketsHref} />
            <DashStat icon={Gauge} tone="navy" label="Kepatuhan SLA" value={stats.slaCompliance === null ? '—' : `${stats.slaCompliance}%`}
                zero={stats.slaCompliance === null}
                sub={stats.slaCompliance === null ? 'Belum ada tiket selesai untuk dihitung' : `${stats.periodDays} hari terakhir`} />
        </section>
    );
};

/** Mockup attention SLA bubble: red overdue, orange paused (waiting vendor), blue countdown. */
const SlaBub: React.FC<{ ticket: AgentTicketStats['activeTickets'][number] }> = ({ ticket }) => {
    if (ticket.status === 'WAITING_VENDOR') return <DashBub color={DASH_COLORS.orange} ink={DASH_COLORS.inkOrange} icon={Pause}>Dijeda</DashBub>;
    if (!ticket.slaTarget) return <DashBub color={DASH_COLORS.gray}>Tanpa SLA</DashBub>;
    const { text, overdue } = formatSlaCompact(ticket.slaTarget);
    const title = `Target SLA ${formatWibDateTime(ticket.slaTarget)} WIB`;
    return overdue || ticket.isOverdue
        ? <DashBub color={DASH_COLORS.red} ink={DASH_COLORS.inkRed} icon={TriangleAlert} title={title}>{text}</DashBub>
        : <DashBub color={DASH_COLORS.blue} icon={Timer} mono title={title}>{text}</DashBub>;
};

/** Active tickets, nearest SLA first: what to work on next. */
export const AttentionList: React.FC<{ stats: AgentTicketStats; viewAllHref?: string; isRefreshing?: boolean }> = ({ stats, viewAllHref, isRefreshing }) => {
    const tickets = stats.activeTickets.slice(0, ATTENTION_LIMIT);
    return (
        <DashPanel title={<>Perlu perhatian {viewAllHref && stats.active > 0 && <DashMore to={viewAllHref}>Lihat semua</DashMore>}</>} label="Perlu perhatian">
            {isRefreshing ? <DashSkeletonList rows={Math.max(tickets.length, 1)} /> : tickets.length === 0 ? (
                <DashEmpty icon={<PartyPopper aria-hidden="true" />}>Tidak ada tiket aktif. Semua beres!</DashEmpty>
            ) : (
                <ul className="dash-list dash-attn">
                    {tickets.map((t) => (
                        <li key={t.id}>
                            <Link to={`/tickets/${t.id}`} className="dash-li">
                                <span className="dash-pdot" style={cssVars({ '--c': PRIORITY_DOT[t.priority] ?? DASH_COLORS.gray })} title={PRIORITY_CONFIG[t.priority]?.label ?? 'Prioritas'} />
                                <div className="grow1">
                                    <b>{t.title}</b>
                                    <small className="mono">#{t.ticketNumber ?? '-'} · {STATUS_CONFIG[t.status]?.label ?? t.status}</small>
                                </div>
                                <SlaBub ticket={t} />
                                <ChevronRight aria-hidden="true" />
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </DashPanel>
    );
};

/** Period performance: total resolved, resolve time, appraisal (+ rating when viewing someone else). */
export const PerformanceCard: React.FC<{ data: AgentDashboardData; showRating: boolean }> = ({ data, showRating }) => {
    const { stats } = data;
    return (
        <DashPanel title={`Performa ${stats.periodDays} hari`} label={showRating ? 'Rating & Appraisal' : 'Performa'}>
            <DashMetric icon={CircleCheck} color={DASH_COLORS.green} label="Total selesai" value={stats.resolvedInPeriod} />
            <DashMetric icon={CalendarClock} color={DASH_COLORS.blue} label="Rata-rata penyelesaian"
                value={stats.avgResolveMinutes === null ? '—' : formatDuration(stats.avgResolveMinutes)}
                hint={stats.avgResolveMinutes === null ? 'Belum ada tiket selesai' : undefined} />
            <DashMetric icon={Award} color={DASH_COLORS.orange} label="Poin appraisal" value={data.agent.appraisalPoints} />
            {showRating && (
                <DashMetric icon={Star} color={DASH_COLORS.orange} label="Rating"
                    value={data.rating.average?.toFixed(1) ?? '—'}
                    hint={data.rating.count > 0 ? `dari ${data.rating.count} penilaian` : 'Belum ada penilaian'} />
            )}
        </DashPanel>
    );
};

const InstallRow: React.FC<{ item: InstallItem }> = ({ item }) => {
    const today = item.day === 'today';
    return (
        <li>
            <Link to={`/tickets/${item.id}`} className="dash-li">
                <DashBub className="is-when" color={today ? DASH_COLORS.accent : DASH_COLORS.gray} ink={today ? DASH_COLORS.accent : 'hsl(var(--idesk-text-secondary))'}>
                    {today ? 'Hari ini' : 'Besok'}
                </DashBub>
                <div className="grow1"><b>{item.title}</b></div>
                <span className="dash-date">{item.scheduledTime ?? '—'}</span>
            </Link>
        </li>
    );
};

export const SupportCard: React.FC<{ support: NonNullable<AgentDashboardData['support']> }> = ({ support }) => (
    <DashPanel title="Workload & Instalasi">
        <DashMetric icon={Wrench} color={DASH_COLORS.navy} label="Poin workload hari ini" value={support.workloadPointsToday} />
        <p className="dash-sub-head">Jadwal instalasi hari ini &amp; besok</p>
        {support.installs.length === 0 ? (
            <DashEmpty>Tidak ada jadwal instalasi.</DashEmpty>
        ) : (
            <ul className="dash-list">{support.installs.map((i) => <InstallRow key={i.id} item={i} />)}</ul>
        )}
    </DashPanel>
);

const AGING_BUCKETS: { key: keyof AgentTicketStats['aging']; label: string }[] = [
    { key: 'lt3', label: '< 3 hari' },
    { key: 'd3to7', label: '3–7 hari' },
    { key: 'd7to14', label: '7–14 hari' },
    { key: 'gt14', label: '> 14 hari' },
];

/** Status bar colours: sky Open, navy In Progress (round-2 status inks). */
const STATUS_BAR: Readonly<Record<string, string>> = {
    TODO: DASH_COLORS.sky, IN_PROGRESS: DASH_COLORS.navy, WAITING_VENDOR: DASH_COLORS.orange, RESOLVED: DASH_COLORS.green, CLOSED: DASH_COLORS.gray,
};

const BarRow: React.FC<{ label: string; count: number; max: number; color?: string }> = ({ label, count, max, color }) => (
    <div className="dash-hb" title={`${label}: ${count}`}>
        <span>{label}</span>
        <span className="dash-track"><i style={cssVars({ '--p': `${max ? (count / max) * 100 : 0}%`, '--c': color ?? DASH_COLORS.accent })} /></span>
        <b>{count}</b>
    </div>
);

const BreakdownColumn: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div><h4>{title}</h4><div className="dash-hbars">{children}</div></div>
);

/** Dev agents only: status / module / age of the active tickets (not in the mockup; kept in its grid style). */
export const DevBreakdownCard: React.FC<{ stats: AgentTicketStats }> = ({ stats }) => {
    const statusRows = Object.entries(stats.byStatus);
    const maxStatus = Math.max(0, ...statusRows.map(([, n]) => n));
    const maxCategory = Math.max(0, ...stats.byCategory.map((c) => c.count));
    const maxAging = Math.max(0, ...AGING_BUCKETS.map((b) => stats.aging[b.key]));
    return (
        <DashPanel title="Rincian tiket">
            <div className="dash-breakdown">
                <BreakdownColumn title="Per status">
                    {statusRows.length === 0 ? <DashEmpty>Belum ada tiket.</DashEmpty> : statusRows.map(([status, n]) => (
                        <BarRow key={status} label={STATUS_CONFIG[status]?.label ?? status} count={n} max={maxStatus} color={STATUS_BAR[status]} />
                    ))}
                </BreakdownColumn>
                <BreakdownColumn title="Per modul">
                    {stats.byCategory.length === 0 ? <DashEmpty>Belum ada tiket.</DashEmpty> : stats.byCategory.map((c) => (
                        <BarRow key={c.category} label={c.category} count={c.count} max={maxCategory} />
                    ))}
                </BreakdownColumn>
                <BreakdownColumn title="Umur Tiket Aktif">
                    {AGING_BUCKETS.map((b) => (
                        <BarRow key={b.key} label={b.label} count={stats.aging[b.key]} max={maxAging} color={b.key === 'gt14' ? DASH_COLORS.red : undefined} />
                    ))}
                </BreakdownColumn>
            </div>
        </DashPanel>
    );
};
