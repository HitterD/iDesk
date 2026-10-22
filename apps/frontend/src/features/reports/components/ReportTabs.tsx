import React from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, CalendarArrowUp, ChartLine, CircleCheck, Clock3, Inbox, Layers, Lightbulb, Plus, Timer, Users } from 'lucide-react';
import { MgStat } from '@/components/management/MgmtParts';
import { ResEmpty, ResSkeletonRows, ResRow, ResTable } from '@/components/resources/ResourceParts';
import { DashAvatar, DashDonut, DashPanel, DashSeg, CHART_HEX, DashChartTable, DashEmpty, DashLegend, DashTooltip, type ChartSeries } from '@/features/dashboard/components/DashboardParts';
import { columnAxis, daySlashLabel } from '@/features/dashboard/components/dashboardChart';
import {
    ExportTrio, HBars, MonthPop, PriorityBars, QUICK_OPTIONS, RangePop, TrendLines, hoursLabel, matchQuick, minutesLabel, peakLabel, quickRange, statusDonutItems,
    type QuickRange,
} from './ReportParts';

export interface MonthlyStats { month: number; year: number; totalTickets: number; resolvedTickets: number; openTickets: number; avgResolutionTimeHours: string }
export interface AgentMetrics {
    agentId: string; agentName: string; totalAssigned: number; totalResolved: number; resolutionRate: number;
    avgResponseTimeMinutes: number; avgResolutionTimeMinutes: number; slaComplianceRate: number;
}
export interface TicketVolumeData {
    daily: { date: string; created: number; resolved: number; pending: number }[];
    byPriority: Record<string, number>;
    byCategory: Record<string, number>;
    byStatus: Record<string, number>;
    summary: { totalCreated: number; totalResolved: number; totalPending: number; avgPerDay: number; peakDay: string; peakCount: number };
}

const pct = (n: number, d: number): number => (d > 0 ? Math.round((n / d) * 100) : 0);
const TOP_PERFORMERS = 2;
const PERCENT_MAX = 100;
const nf = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });

interface ExportProps { disabled: boolean; onPreview: () => void; onPdf: () => void; onExcel: () => void }

/* ---------------- Monthly Summary ---------------- */
interface MonthlyTabProps extends ExportProps {
    month: number; year: number; years: readonly number[]; onMonth: (m: number, y: number) => void;
    stats: MonthlyStats | undefined; loading: boolean; volume: TicketVolumeData | null; volumeLoading: boolean;
}
export const MonthlyTab: React.FC<MonthlyTabProps> = ({ month, year, years, onMonth, stats, loading, volume, volumeLoading, ...exp }) => (
    <>
        <div className="res-filters">
            <MonthPop month={month} year={year} years={years} onChange={onMonth} />
            <span className="res-spacer" />
            <ExportTrio label="ringkasan bulanan" {...exp} />
        </div>
        {!loading && !stats ? (
            <div className="res-table"><ResEmpty icon={Inbox} title="Tidak ada data">Tidak ada data untuk periode yang dipilih.</ResEmpty></div>
        ) : (
            <>
                <section className="res-stats is-four" aria-label="Ringkasan bulanan">
                    <MgStat icon={Layers} tone="neutral" label="Total Tickets" value={stats?.totalTickets ?? 0} isLoading={loading} />
                    <MgStat icon={CircleCheck} tone="green" label="Resolved" value={stats?.resolvedTickets ?? 0} isLoading={loading}
                        sub={`${pct(stats?.resolvedTickets ?? 0, stats?.totalTickets ?? 0)}% resolution rate`} />
                    <MgStat icon={Inbox} tone="blue" label="Open Tickets" value={stats?.openTickets ?? 0} isLoading={loading} />
                    <MgStat icon={Timer} tone="navy" label="Avg Resolution Time" value={hoursLabel(stats?.avgResolutionTimeHours)} isLoading={loading} />
                </section>
                <div className="res-grid-main">
                    <DashPanel title="Daily Ticket Trend">
                        <p className="dash-panel-sub">Tiket dibuat vs diselesaikan per hari</p>
                        {volumeLoading || !volume ? <ResSkeletonRows rows={4} /> : <TrendLines daily={volume.daily} />}
                    </DashPanel>
                    <div className="res-stack">
                        <DashPanel title="By Status">
                            {volumeLoading || !volume ? <ResSkeletonRows rows={2} /> : <DashDonut label="Per status" items={statusDonutItems(volume.byStatus)} />}
                        </DashPanel>
                        <DashPanel title="By Priority">
                            {volumeLoading || !volume ? <ResSkeletonRows rows={2} /> : <PriorityBars byPriority={volume.byPriority} />}
                        </DashPanel>
                    </div>
                </div>
            </>
        )}
    </>
);

/* ---------------- Agent Performance ---------------- */
const AGENT_COLS = 'minmax(200px,1.6fr) 80px 80px 96px 80px 100px';
interface RangeProps { startDate: string; endDate: string; onRange: (s: string, e: string) => void }

const QuickSeg: React.FC<RangeProps> = ({ startDate, endDate, onRange }) => (
    <DashSeg aria-label="Quick Select" value={matchQuick(startDate, endDate) as QuickRange} options={QUICK_OPTIONS}
        onChange={(q) => { const r = quickRange(q); onRange(r.startDate, r.endDate); }} />
);

interface AgentTabProps extends ExportProps, RangeProps { agents: readonly AgentMetrics[]; loading: boolean }
export const AgentTab: React.FC<AgentTabProps> = ({ agents, loading, startDate, endDate, onRange, ...exp }) => {
    const top = new Set([...agents].filter((a) => a.totalResolved > 0).sort((a, b) => b.totalResolved - a.totalResolved).slice(0, TOP_PERFORMERS).map((a) => a.agentId));
    return (
        <>
            <div className="res-filters">
                <RangePop startDate={startDate} endDate={endDate} onChange={onRange} />
                <QuickSeg startDate={startDate} endDate={endDate} onRange={onRange} />
                <span className="res-spacer" />
                <ExportTrio label="performa agent" {...exp} />
            </div>
            {!loading && agents.length === 0 ? (
                <div className="res-table"><ResEmpty icon={Users} title="Tidak ada data agent">Tidak ada data agent pada periode ini.</ResEmpty></div>
            ) : (
                <div className="res-grid-main">
                    <ResTable label="Agent Details" cols={AGENT_COLS} colsMobile="minmax(0,1fr) auto"
                        tools={<><h3>Agent Details</h3><span className="res-muted">Top performers ditandai</span></>}
                        head={<><span>Agent</span><span className="is-right">Assigned</span><span className="is-right">Resolved</span><span className="is-right">Resolution %</span><span className="is-right">SLA %</span><span className="is-right">Avg Response</span></>}>
                        {loading ? <ResSkeletonRows rows={5} /> : agents.map((a) => (
                            <ResRow key={a.agentId} className="is-static">
                                <div className="queue-person">
                                    <DashAvatar name={a.agentName || '?'} />
                                    <div className="min-w-0"><b>{a.agentName}</b>{top.has(a.agentId) && <small>Top performer</small>}</div>
                                </div>
                                <span className="res-cell is-num text-right res-hide-m">{a.totalAssigned}</span>
                                <span className="res-cell is-num text-right res-hide-m">{a.totalResolved}</span>
                                <span className="res-cell is-num text-right res-hide-m">{nf.format(a.resolutionRate ?? 0)}%</span>
                                <span className="res-cell is-num text-right">{nf.format(a.slaComplianceRate ?? 0)}%</span>
                                <span className="res-cell is-num text-right res-hide-m">{minutesLabel(a.avgResponseTimeMinutes)}</span>
                            </ResRow>
                        ))}
                    </ResTable>
                    <DashPanel title="Resolution Rate by Agent">
                        {loading ? <ResSkeletonRows rows={4} /> : (
                            <HBars max={PERCENT_MAX} suffix="%" rows={agents.map((a) => ({ label: a.agentName.split(' ')[0] || a.agentName, title: `${a.agentName}: ${Math.round(a.resolutionRate ?? 0)}%`, value: Math.round(a.resolutionRate ?? 0) }))} />
                        )}
                        {!loading && agents.length > 0 && (
                            <div className="res-note"><Lightbulb aria-hidden="true" />
                                Rata-rata resolution rate {nf.format(agents.reduce((s, a) => s + (a.resolutionRate ?? 0), 0) / agents.length)}% · SLA {nf.format(agents.reduce((s, a) => s + (a.slaComplianceRate ?? 0), 0) / agents.length)}%
                            </div>
                        )}
                    </DashPanel>
                </div>
            )}
        </>
    );
};

/* ---------------- Ticket Volume ---------------- */
const VOLUME_SERIES: readonly ChartSeries[] = [
    { key: 'created', name: 'Dibuat', color: CHART_HEX.blue },
    { key: 'resolved', name: 'Diselesaikan', color: CHART_HEX.green },
];
const VOLUME_TABLE: readonly ChartSeries[] = [...VOLUME_SERIES, { key: 'pending', name: 'Pending', color: CHART_HEX.blue }];
const SPARSE_AFTER = 14;

/** Mockup `columns()`: grouped columns per day, "Lihat sebagai tabel" keeps the pending column. */
const VolumeColumns: React.FC<{ daily: TicketVolumeData['daily'] }> = ({ daily }) => {
    const rows = daily.map((d) => ({ ...d, label: daySlashLabel(d.date) }));
    const peak = Math.max(0, ...daily.flatMap((d) => [d.created, d.resolved]));
    if (peak === 0) return <DashEmpty icon={<BarChart3 aria-hidden="true" />}>Belum ada tiket pada periode ini.</DashEmpty>;
    const axis = columnAxis(peak);
    return (
        <figure className="dash-chart" aria-label="Volume tiket harian">
            <DashLegend series={VOLUME_SERIES} />
            <div className="dash-plot">
                <div className="dash-plot-inner">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={rows} margin={{ top: 6, right: 0, left: 0, bottom: 0 }} barGap={2} barCategoryGap="18%">
                            <CartesianGrid vertical={false} />
                            <XAxis dataKey="label" tickLine={false} axisLine={false} interval={rows.length > SPARSE_AFTER ? 1 : 0} tickMargin={6} />
                            <YAxis width={28} tickLine={false} axisLine={false} allowDecimals={false} domain={[0, axis.max]} ticks={axis.ticks} />
                            <Tooltip cursor={{ fill: 'var(--dash-hover)', radius: 6 } as never}
                                content={({ active, label, payload }) => <DashTooltip active={active} title={String(label ?? '')} payload={payload as never} series={VOLUME_SERIES} />} />
                            {VOLUME_SERIES.map((s) => <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={14} minPointSize={2} isAnimationActive={false} />)}
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
            <DashChartTable caption="Tanggal" labels={rows.map((r) => r.label)} series={VOLUME_TABLE} rows={rows as unknown as Record<string, number>[]} />
        </figure>
    );
};

/** First half vs second half of the period (production "Period Performance"). */
const PeriodRow: React.FC<{ label: string; current: number; previous: number; percent?: boolean }> = ({ label, current, previous, percent }) => {
    const change = previous > 0 ? ((current - previous) / previous) * 100 : 0;
    const shown = Math.abs(change) >= 1;
    return (
        <div className="dash-metric">
            <div>{label}<small>babak kedua vs pertama</small></div>
            {shown && <span className="dash-trend" style={{ ['--trend-ink' as string]: change > 0 ? 'var(--dash-ink-green)' : 'var(--dash-ink-red)' }}>{change > 0 ? '+' : ''}{nf.format(change)}%</span>}
            <b>{nf.format(current)}{percent ? '%' : ''}</b>
        </div>
    );
};

const PeriodPanel: React.FC<{ daily: TicketVolumeData['daily'] }> = ({ daily }) => {
    const mid = Math.floor(daily.length / 2);
    const sum = (arr: typeof daily, k: 'created' | 'resolved') => arr.reduce((s, d) => s + d[k], 0);
    const [a, b] = [daily.slice(0, mid), daily.slice(mid)];
    const [ac, bc, ar, br] = [sum(a, 'created'), sum(b, 'created'), sum(a, 'resolved'), sum(b, 'resolved')];
    return (
        <DashPanel title="Period Performance">
            <PeriodRow label="Created" current={bc} previous={ac} />
            <PeriodRow label="Resolved" current={br} previous={ar} />
            <PeriodRow label="Resolution Rate" current={bc > 0 ? (br / bc) * 100 : 0} previous={ac > 0 ? (ar / ac) * 100 : 0} percent />
            <PeriodRow label="Avg Daily" current={bc / Math.max(b.length, 1)} previous={ac / Math.max(a.length, 1)} />
        </DashPanel>
    );
};
const PERIOD_MIN_DAYS = 4;

interface VolumeTabProps extends ExportProps, RangeProps { volume: TicketVolumeData | null; loading: boolean }
export const VolumeTab: React.FC<VolumeTabProps> = ({ volume, loading, startDate, endDate, onRange, ...exp }) => {
    const s = volume?.summary;
    return (
        <>
            <div className="res-filters">
                <RangePop startDate={startDate} endDate={endDate} onChange={onRange} />
                <QuickSeg startDate={startDate} endDate={endDate} onRange={onRange} />
                <span className="res-spacer" />
                <ExportTrio label="volume tiket" {...exp} />
            </div>
            {!loading && !volume ? (
                <div className="res-table"><ResEmpty icon={Inbox} title="Tidak ada data">Tidak ada data untuk periode yang dipilih.</ResEmpty></div>
            ) : (
                <>
                    <section className="res-stats is-five" aria-label="Ringkasan volume">
                        <MgStat icon={Plus} tone="blue" label="Total Created" value={s?.totalCreated ?? 0} isLoading={loading} />
                        <MgStat icon={CircleCheck} tone="green" label="Total Resolved" value={s?.totalResolved ?? 0} isLoading={loading} />
                        <MgStat icon={Clock3} tone="amber" label="Pending" value={s?.totalPending ?? 0} isLoading={loading} />
                        <MgStat icon={ChartLine} tone="navy" label="Avg Daily" value={nf.format(s?.avgPerDay ?? 0)} isLoading={loading} />
                        <MgStat icon={CalendarArrowUp} tone="amber" label="Peak Day" value={peakLabel(s?.peakDay)} isLoading={loading} sub={`${s?.peakCount ?? 0} tiket`} />
                    </section>
                    <DashPanel title="Daily Volume" className="mb-3">
                        {loading || !volume ? <ResSkeletonRows rows={4} /> : <VolumeColumns daily={volume.daily} />}
                    </DashPanel>
                    {volume && (
                        <div className="res-grid2">
                            <DashPanel title="By Status"><DashDonut label="Per status" items={statusDonutItems(volume.byStatus)} /></DashPanel>
                            <div className="res-stack">
                                <DashPanel title="By Priority"><PriorityBars byPriority={volume.byPriority} /></DashPanel>
                                {volume.daily.length >= PERIOD_MIN_DAYS && <PeriodPanel daily={volume.daily} />}
                            </div>
                        </div>
                    )}
                </>
            )}
        </>
    );
};
