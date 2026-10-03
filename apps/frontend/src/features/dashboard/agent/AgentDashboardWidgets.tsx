import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, Star, Award, Wrench } from 'lucide-react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { cn } from '@/lib/utils';
import { PRIORITY_CONFIG, STATUS_CONFIG } from '@/lib/constants/ticket.constants';
import { formatDuration, formatWibDateTime, shortDateLabel } from './agentDashboard.format';
import type { AgentDashboardData, AgentTicketStats, InstallItem } from './agentDashboard.types';

const SLA_GOOD_PERCENT = 90;
const SLA_WARN_PERCENT = 70;
const CHART_HEIGHT_PX = 240;
const ASSIGNED_COLOR = '#60a5fa';
const RESOLVED_COLOR = '#10b981';

const CARD = 'bg-card border border-border rounded-2xl p-5';
const CARD_TITLE = 'font-bold text-foreground text-base tracking-tight mb-4';
const LABEL = 'text-xs font-semibold text-muted-foreground uppercase tracking-wider';

const EmptyText: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <p className="text-sm text-muted-foreground py-4 text-center">{children}</p>
);

export const StatCard: React.FC<{ label: string; value: React.ReactNode; hint?: string; tone?: 'danger' | 'success' }> = ({ label, value, hint, tone }) => (
    <div className={CARD}>
        <p className={LABEL}>{label}</p>
        <p className={cn(
            'text-3xl font-extrabold tracking-tight leading-none mt-2',
            tone === 'danger' ? 'text-destructive' : tone === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground',
        )}>{value}</p>
        {hint && <p className="text-xs text-muted-foreground mt-2">{hint}</p>}
    </div>
);

export const StatGrid: React.FC<{ stats: AgentTicketStats }> = ({ stats }) => (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard label="Aktif" value={stats.active} hint={`${stats.todo} open, ${stats.waitingVendor} waiting vendor`} />
        <StatCard label="In Progress" value={stats.inProgress} />
        <StatCard label="Overdue" value={stats.overdue} tone={stats.overdue > 0 ? 'danger' : undefined} hint="Lewat target SLA" />
        <StatCard label="Selesai Hari Ini" value={stats.resolvedToday} tone="success" />
        <StatCard label="Selesai Minggu Ini" value={stats.resolvedThisWeek} />
        <StatCard label="Selesai Bulan Ini" value={stats.resolvedThisMonth} />
    </div>
);

export const PerformanceCard: React.FC<{ stats: AgentTicketStats }> = ({ stats }) => {
    const sla = stats.slaCompliance;
    const slaColor = sla === null ? 'bg-muted' : sla >= SLA_GOOD_PERCENT ? 'bg-emerald-500' : sla >= SLA_WARN_PERCENT ? 'bg-amber-500' : 'bg-destructive';
    return (
        <div className={cn(CARD, 'flex flex-col gap-4')}>
            <h2 className={CARD_TITLE}>Performa {stats.periodDays} Hari</h2>
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <p className={LABEL}>SLA Compliance</p>
                    <span className="text-sm font-extrabold text-foreground">{sla === null ? '-' : `${sla}%`}</span>
                </div>
                <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all', slaColor)} style={{ width: `${sla ?? 0}%` }} />
                </div>
            </div>
            <div className="border-t border-border/60" />
            <div className="flex items-center justify-between">
                <p className={LABEL}>Rata-rata Penyelesaian</p>
                <span className="text-xl font-extrabold text-foreground">{formatDuration(stats.avgResolveMinutes)}</span>
            </div>
            <div className="flex items-center justify-between">
                <p className={LABEL}>Total Selesai</p>
                <span className="text-xl font-extrabold text-foreground">{stats.resolvedInPeriod}</span>
            </div>
        </div>
    );
};

export const TrendChart: React.FC<{ stats: AgentTicketStats }> = ({ stats }) => (
    <div className={CARD}>
        <h2 className={CARD_TITLE}>Ditugaskan vs Diselesaikan ({stats.periodDays} hari)</h2>
        <div style={{ height: CHART_HEIGHT_PX }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.trend} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tickFormatter={shortDateLabel} tick={{ fontSize: 11 }} minTickGap={12} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip labelFormatter={(d) => shortDateLabel(String(d))} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="assigned" name="Ditugaskan" fill={ASSIGNED_COLOR} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="resolved" name="Diselesaikan" fill={RESOLVED_COLOR} radius={[3, 3, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    </div>
);

export const ActiveTicketList: React.FC<{ stats: AgentTicketStats }> = ({ stats }) => (
    <div className={CARD}>
        <h2 className={CARD_TITLE}>Tiket Aktif (SLA Terdekat)</h2>
        {stats.activeTickets.length === 0 ? (
            <EmptyText>Tidak ada tiket aktif.</EmptyText>
        ) : (
            <ul className="divide-y divide-border/60">
                {stats.activeTickets.map((t) => (
                    <li key={t.id}>
                        <Link to={`/tickets/${t.id}`} className="flex items-center gap-3 py-2.5 hover:bg-secondary/40 rounded-lg px-2 -mx-2">
                            <span className={cn('w-2 h-2 rounded-full shrink-0', PRIORITY_CONFIG[t.priority]?.dot ?? 'bg-slate-400')} />
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-foreground truncate">{t.title}</p>
                                <p className="text-xs text-muted-foreground">
                                    {t.ticketNumber ?? '-'} · {STATUS_CONFIG[t.status]?.label ?? t.status}
                                </p>
                            </div>
                            <span className={cn('text-xs font-semibold whitespace-nowrap', t.isOverdue ? 'text-destructive' : 'text-muted-foreground')}>
                                {t.slaTarget ? `${t.isOverdue ? 'Lewat ' : ''}${formatWibDateTime(t.slaTarget)}` : 'Tanpa SLA'}
                            </span>
                        </Link>
                    </li>
                ))}
            </ul>
        )}
    </div>
);

export const AppraisalRow: React.FC<{ points: number }> = ({ points }) => (
    <div className="flex items-center justify-between">
        <p className={cn(LABEL, 'flex items-center gap-1.5')}><Award className="w-4 h-4" /> Poin Appraisal</p>
        <span className="text-xl font-extrabold text-foreground">{points}</span>
    </div>
);

/** Rating summary for ADMIN/MANAGER viewing another agent (MyRatingCard only serves the signed-in agent). */
export const RatingSummaryCard: React.FC<{ data: AgentDashboardData }> = ({ data }) => (
    <div className={cn(CARD, 'flex flex-col gap-4')}>
        <h2 className={CARD_TITLE}>Rating & Appraisal</h2>
        <div className="flex items-center gap-3">
            <Star className="w-6 h-6 fill-amber-400 text-amber-400" />
            <span className="text-3xl font-extrabold text-foreground">{data.rating.average?.toFixed(1) ?? '-'}</span>
            <span className="text-sm text-muted-foreground">dari {data.rating.count} rating</span>
        </div>
        <AppraisalRow points={data.agent.appraisalPoints} />
    </div>
);

const InstallRow: React.FC<{ item: InstallItem }> = ({ item }) => (
    <li>
        <Link to={`/tickets/${item.id}`} className="flex items-center gap-3 py-2 hover:bg-secondary/40 rounded-lg px-2 -mx-2">
            <span className={cn(
                'text-[10px] font-bold uppercase px-2 py-0.5 rounded-full',
                item.day === 'today' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
            )}>{item.day === 'today' ? 'Hari ini' : 'Besok'}</span>
            <span className="text-sm text-foreground truncate flex-1">{item.title}</span>
            <span className="text-xs text-muted-foreground">{item.scheduledTime ?? '-'}</span>
        </Link>
    </li>
);

export const SupportCard: React.FC<{ support: NonNullable<AgentDashboardData['support']> }> = ({ support }) => (
    <div className={cn(CARD, 'flex flex-col gap-4')}>
        <h2 className={CARD_TITLE}>Workload & Instalasi</h2>
        <div className="flex items-center justify-between">
            <p className={cn(LABEL, 'flex items-center gap-1.5')}><Wrench className="w-4 h-4" /> Poin Workload Hari Ini</p>
            <span className="text-xl font-extrabold text-foreground">{support.workloadPointsToday}</span>
        </div>
        <div className="border-t border-border/60" />
        <p className={cn(LABEL, 'flex items-center gap-1.5')}><CalendarClock className="w-4 h-4" /> Instalasi Hari Ini & Besok</p>
        {support.installs.length === 0 ? (
            <EmptyText>Tidak ada jadwal instalasi.</EmptyText>
        ) : (
            <ul className="divide-y divide-border/60">
                {support.installs.map((i) => <InstallRow key={i.id} item={i} />)}
            </ul>
        )}
    </div>
);

const AGING_BUCKETS: { key: keyof AgentTicketStats['aging']; label: string }[] = [
    { key: 'lt3', label: '< 3 hari' },
    { key: 'd3to7', label: '3–7 hari' },
    { key: 'd7to14', label: '7–14 hari' },
    { key: 'gt14', label: '> 14 hari' },
];

const BarRow: React.FC<{ label: string; count: number; max: number; className?: string }> = ({ label, count, max, className }) => (
    <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground w-28 truncate" title={label}>{label}</span>
        <div className="flex-1 bg-muted h-2 rounded-full overflow-hidden">
            <div className={cn('h-full rounded-full', className ?? 'bg-primary')} style={{ width: `${max ? (count / max) * 100 : 0}%` }} />
        </div>
        <span className="text-xs font-bold text-foreground w-6 text-right">{count}</span>
    </div>
);

export const DevBreakdownCard: React.FC<{ stats: AgentTicketStats }> = ({ stats }) => {
    const statusRows = Object.entries(stats.byStatus);
    const maxStatus = Math.max(0, ...statusRows.map(([, n]) => n));
    const maxCategory = Math.max(0, ...stats.byCategory.map((c) => c.count));
    const maxAging = Math.max(0, ...AGING_BUCKETS.map((b) => stats.aging[b.key]));
    return (
        <div className={cn(CARD, 'grid grid-cols-1 md:grid-cols-3 gap-6')}>
            <div className="flex flex-col gap-2">
                <h2 className={CARD_TITLE}>Per Status</h2>
                {statusRows.length === 0 ? <EmptyText>-</EmptyText> : statusRows.map(([status, n]) => (
                    <BarRow key={status} label={STATUS_CONFIG[status]?.label ?? status} count={n} max={maxStatus} className={STATUS_CONFIG[status]?.columnColor} />
                ))}
            </div>
            <div className="flex flex-col gap-2">
                <h2 className={CARD_TITLE}>Per Modul</h2>
                {stats.byCategory.length === 0 ? <EmptyText>-</EmptyText> : stats.byCategory.map((c) => (
                    <BarRow key={c.category} label={c.category} count={c.count} max={maxCategory} />
                ))}
            </div>
            <div className="flex flex-col gap-2">
                <h2 className={CARD_TITLE}>Umur Tiket Aktif</h2>
                {AGING_BUCKETS.map((b) => (
                    <BarRow key={b.key} label={b.label} count={stats.aging[b.key]} max={maxAging} className={b.key === 'gt14' ? 'bg-destructive' : undefined} />
                ))}
            </div>
        </div>
    );
};
