import React from 'react';
import { Link } from 'react-router-dom';
import { Award, CalendarClock, CheckCircle2, ChevronRight, PartyPopper, Star, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PRIORITY_CONFIG, STATUS_CONFIG } from '@/lib/constants/ticket.constants';
import { formatDuration, formatSlaRelative, formatWibDateTime } from './agentDashboard.format';
import type { AgentDashboardData, AgentTicketStats, InstallItem } from './agentDashboard.types';

const SLA_GOOD_PERCENT = 90;
const SLA_WARN_PERCENT = 70;
const RING_SIZE_PX = 64;
const RING_STROKE_PX = 7;
const ATTENTION_LIMIT = 6;

/** Soft, borderless surface (Apple-style); a hairline ring keeps it visible in dark mode. */
export const SURFACE = 'bg-card rounded-3xl shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.10)] ring-1 ring-black/[0.03] dark:ring-white/[0.06]';
export const SECTION_TITLE = 'text-[17px] font-semibold text-foreground tracking-tight';
const EYEBROW = 'text-[13px] font-medium text-muted-foreground';
const BIG_NUMBER = 'text-[34px] leading-none font-semibold tracking-tight tabular-nums';

export const EmptyNote: React.FC<{ icon?: React.ReactNode; children: React.ReactNode }> = ({ icon, children }) => (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
        {icon}
        <p className="text-sm text-muted-foreground max-w-xs">{children}</p>
    </div>
);

const slaTone = (sla: number | null) =>
    sla === null ? 'text-muted-foreground/30' : sla >= SLA_GOOD_PERCENT ? 'text-emerald-500' : sla >= SLA_WARN_PERCENT ? 'text-amber-500' : 'text-rose-500';

const SlaRing: React.FC<{ value: number | null }> = ({ value }) => {
    const r = (RING_SIZE_PX - RING_STROKE_PX) / 2;
    const circumference = 2 * Math.PI * r;
    const offset = circumference * (1 - (value ?? 0) / 100);
    return (
        <svg width={RING_SIZE_PX} height={RING_SIZE_PX} className="-rotate-90 shrink-0" aria-hidden="true">
            <circle cx="50%" cy="50%" r={r} fill="none" strokeWidth={RING_STROKE_PX} className="stroke-muted" />
            <circle
                cx="50%" cy="50%" r={r} fill="none" strokeWidth={RING_STROKE_PX} strokeLinecap="round"
                stroke="currentColor" strokeDasharray={circumference} strokeDashoffset={offset}
                className={cn('transition-[stroke-dashoffset] duration-700', slaTone(value))}
            />
        </svg>
    );
};

const Tile: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className }) => (
    <div className={cn(SURFACE, 'p-5 flex flex-col gap-3 min-h-[132px]', className)}>
        <p className={EYEBROW}>{label}</p>
        {children}
    </div>
);

const Chip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <span className="text-xs text-muted-foreground bg-foreground/[0.06] rounded-full px-2 py-0.5 tabular-nums">{children}</span>
);

/** Four summary tiles: active, overdue, resolved, SLA. */
export const SummaryTiles: React.FC<{ stats: AgentTicketStats }> = ({ stats }) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Tile label="Tiket aktif">
            <p className={cn(BIG_NUMBER, 'text-foreground')}>{stats.active}</p>
            <div className="flex flex-wrap gap-1.5">
                <Chip>{stats.todo} open</Chip>
                <Chip>{stats.inProgress} dikerjakan</Chip>
                {stats.waitingVendor > 0 && <Chip>{stats.waitingVendor} tunggu vendor</Chip>}
            </div>
        </Tile>
        <Tile
            label="Lewat SLA"
            className={stats.overdue > 0 ? 'bg-rose-50 dark:bg-rose-500/10' : 'bg-emerald-50 dark:bg-emerald-500/10'}
        >
            <p className={cn(BIG_NUMBER, stats.overdue > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400')}>
                {stats.overdue}
            </p>
            <p className="text-xs text-muted-foreground">
                {stats.overdue > 0 ? 'Segera tindak lanjuti tiket ini' : 'Semua tiket masih tepat waktu'}
            </p>
        </Tile>
        <Tile label="Selesai hari ini">
            <p className={cn(BIG_NUMBER, 'text-foreground')}>{stats.resolvedToday}</p>
            <p className="text-xs text-muted-foreground tabular-nums">
                {stats.resolvedThisWeek} minggu ini · {stats.resolvedThisMonth} bulan ini
            </p>
        </Tile>
        <Tile label={`Kepatuhan SLA · ${stats.periodDays} hari`}>
            <div className="flex items-center gap-4">
                <SlaRing value={stats.slaCompliance} />
                {stats.slaCompliance === null ? (
                    <p className="text-xs text-muted-foreground">Belum ada tiket selesai untuk dihitung</p>
                ) : (
                    <p className={cn(BIG_NUMBER, 'text-foreground')}>{stats.slaCompliance}<span className="text-xl">%</span></p>
                )}
            </div>
        </Tile>
    </div>
);

const SlaBadge: React.FC<{ slaTarget: string | null }> = ({ slaTarget }) => {
    if (!slaTarget) return <span className="text-xs text-muted-foreground">Tanpa SLA</span>;
    const { text, overdue } = formatSlaRelative(slaTarget);
    return (
        <span
            title={`Target SLA ${formatWibDateTime(slaTarget)} WIB`}
            className={cn(
                'text-xs font-medium whitespace-nowrap rounded-full px-2.5 py-1 tabular-nums',
                overdue ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300' : 'bg-foreground/[0.06] text-muted-foreground',
            )}
        >{text}</span>
    );
};

/** Active tickets, nearest SLA first: what to work on next. */
export const AttentionList: React.FC<{ stats: AgentTicketStats; viewAllHref?: string }> = ({ stats, viewAllHref }) => {
    const tickets = stats.activeTickets.slice(0, ATTENTION_LIMIT);
    return (
        <section className={cn(SURFACE, 'p-5 md:p-6')} aria-label="Perlu perhatian">
            <div className="flex items-center justify-between mb-2">
                <h2 className={SECTION_TITLE}>Perlu perhatian</h2>
                {viewAllHref && stats.active > 0 && (
                    <Link to={viewAllHref} className="text-sm font-medium text-primary hover:underline flex items-center gap-0.5">
                        Lihat semua <ChevronRight className="w-4 h-4" />
                    </Link>
                )}
            </div>
            {tickets.length === 0 ? (
                <EmptyNote icon={<PartyPopper className="w-8 h-8 text-emerald-500" />}>Tidak ada tiket aktif. Semua beres!</EmptyNote>
            ) : (
                <ul className="divide-y divide-border/50">
                    {tickets.map((t) => (
                        <li key={t.id}>
                            <Link to={`/tickets/${t.id}`} className="group flex items-center gap-3 py-3 -mx-2 px-2 rounded-xl hover:bg-muted/50 transition-colors">
                                <span className={cn('w-2 h-2 rounded-full shrink-0', PRIORITY_CONFIG[t.priority]?.dot ?? 'bg-slate-400')} title={PRIORITY_CONFIG[t.priority]?.label} />
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-foreground truncate">{t.title}</p>
                                    <p className="text-xs text-muted-foreground truncate">
                                        {t.ticketNumber ?? '-'} · {STATUS_CONFIG[t.status]?.label ?? t.status}
                                    </p>
                                </div>
                                <SlaBadge slaTarget={t.slaTarget} />
                                <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-muted-foreground shrink-0" />
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
};

const MetricRow: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode; hint?: string }> = ({ icon, label, value, hint }) => (
    <div className="flex items-center gap-3 py-3">
        <span className="w-9 h-9 rounded-xl bg-foreground/[0.06] flex items-center justify-center text-muted-foreground shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground">{label}</p>
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        <span className="text-lg font-semibold text-foreground tabular-nums">{value}</span>
    </div>
);

/** Period performance: resolve time, total resolved, appraisal (+ rating when viewing someone else). */
export const PerformanceCard: React.FC<{ data: AgentDashboardData; showRating: boolean }> = ({ data, showRating }) => {
    const { stats } = data;
    return (
        <section className={cn(SURFACE, 'p-5 md:p-6')} aria-label={showRating ? 'Rating & Appraisal' : 'Performa'}>
            <h2 className={SECTION_TITLE}>Performa {stats.periodDays} hari</h2>
            <div className="divide-y divide-border/50 mt-1">
                <MetricRow
                    icon={<CheckCircle2 className="w-4 h-4" />}
                    label="Total selesai"
                    value={stats.resolvedInPeriod}
                />
                <MetricRow
                    icon={<CalendarClock className="w-4 h-4" />}
                    label="Rata-rata penyelesaian"
                    value={stats.avgResolveMinutes === null ? '—' : formatDuration(stats.avgResolveMinutes)}
                    hint={stats.avgResolveMinutes === null ? 'Belum ada tiket selesai' : undefined}
                />
                <MetricRow icon={<Award className="w-4 h-4" />} label="Poin appraisal" value={data.agent.appraisalPoints} />
                {showRating && (
                    <MetricRow
                        icon={<Star className="w-4 h-4 fill-amber-400 text-amber-400" />}
                        label="Rating"
                        value={data.rating.average?.toFixed(1) ?? '—'}
                        hint={data.rating.count > 0 ? `dari ${data.rating.count} penilaian` : 'Belum ada penilaian'}
                    />
                )}
            </div>
        </section>
    );
};

const InstallRow: React.FC<{ item: InstallItem }> = ({ item }) => (
    <li>
        <Link to={`/tickets/${item.id}`} className="flex items-center gap-3 py-2.5 -mx-2 px-2 rounded-xl hover:bg-muted/50">
            <span className={cn(
                'text-[11px] font-semibold px-2 py-0.5 rounded-full',
                item.day === 'today' ? 'bg-primary/10 text-primary' : 'bg-foreground/[0.06] text-muted-foreground',
            )}>{item.day === 'today' ? 'Hari ini' : 'Besok'}</span>
            <span className="text-sm text-foreground truncate flex-1">{item.title}</span>
            <span className="text-xs text-muted-foreground tabular-nums">{item.scheduledTime ?? '—'}</span>
        </Link>
    </li>
);

export const SupportCard: React.FC<{ support: NonNullable<AgentDashboardData['support']> }> = ({ support }) => (
    <section className={cn(SURFACE, 'p-5 md:p-6')} aria-label="Workload & Instalasi">
        <h2 className={SECTION_TITLE}>Workload & Instalasi</h2>
        <MetricRow icon={<Wrench className="w-4 h-4" />} label="Poin workload hari ini" value={support.workloadPointsToday} />
        <p className={cn(EYEBROW, 'mt-2')}>Jadwal instalasi hari ini & besok</p>
        {support.installs.length === 0 ? (
            <EmptyNote>Tidak ada jadwal instalasi.</EmptyNote>
        ) : (
            <ul className="divide-y divide-border/50 mt-1">
                {support.installs.map((i) => <InstallRow key={i.id} item={i} />)}
            </ul>
        )}
    </section>
);

const AGING_BUCKETS: { key: keyof AgentTicketStats['aging']; label: string }[] = [
    { key: 'lt3', label: '< 3 hari' },
    { key: 'd3to7', label: '3–7 hari' },
    { key: 'd7to14', label: '7–14 hari' },
    { key: 'gt14', label: '> 14 hari' },
];

const BarRow: React.FC<{ label: string; count: number; max: number; className?: string }> = ({ label, count, max, className }) => (
    <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground w-24 truncate" title={label}>{label}</span>
        <div className="flex-1 bg-muted h-1.5 rounded-full overflow-hidden">
            <div className={cn('h-full rounded-full', className ?? 'bg-primary')} style={{ width: `${max ? (count / max) * 100 : 0}%` }} />
        </div>
        <span className="text-xs font-semibold text-foreground w-6 text-right tabular-nums">{count}</span>
    </div>
);

const BreakdownColumn: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="flex flex-col gap-2.5">
        <h3 className="text-sm font-semibold text-foreground mb-1">{title}</h3>
        {children}
    </div>
);

export const DevBreakdownCard: React.FC<{ stats: AgentTicketStats }> = ({ stats }) => {
    const statusRows = Object.entries(stats.byStatus);
    const maxStatus = Math.max(0, ...statusRows.map(([, n]) => n));
    const maxCategory = Math.max(0, ...stats.byCategory.map((c) => c.count));
    const maxAging = Math.max(0, ...AGING_BUCKETS.map((b) => stats.aging[b.key]));
    return (
        <section className={cn(SURFACE, 'p-5 md:p-6 grid grid-cols-1 md:grid-cols-3 gap-6')} aria-label="Rincian tiket">
            <BreakdownColumn title="Per status">
                {statusRows.length === 0 ? <EmptyNote>Belum ada tiket.</EmptyNote> : statusRows.map(([status, n]) => (
                    <BarRow key={status} label={STATUS_CONFIG[status]?.label ?? status} count={n} max={maxStatus} className={STATUS_CONFIG[status]?.columnColor} />
                ))}
            </BreakdownColumn>
            <BreakdownColumn title="Per modul">
                {stats.byCategory.length === 0 ? <EmptyNote>Belum ada tiket.</EmptyNote> : stats.byCategory.map((c) => (
                    <BarRow key={c.category} label={c.category} count={c.count} max={maxCategory} />
                ))}
            </BreakdownColumn>
            <BreakdownColumn title="Umur Tiket Aktif">
                {AGING_BUCKETS.map((b) => (
                    <BarRow key={b.key} label={b.label} count={stats.aging[b.key]} max={maxAging} className={b.key === 'gt14' ? 'bg-rose-500' : undefined} />
                ))}
            </BreakdownColumn>
        </section>
    );
};
