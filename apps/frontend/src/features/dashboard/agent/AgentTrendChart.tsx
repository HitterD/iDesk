import React, { useMemo } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, Tooltip, XAxis, YAxis } from 'recharts';
import { ResponsiveChart } from '@/components/ui/responsive-chart';
import { LineChart } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AgentTicketStats } from './agentDashboard.types';
import { bucketByDays, dayMonthLabel, DAYS_PER_WEEK, isWeekly, lineAxis } from '../components/dashboardChart';
import { CHART_HEX, DashChartTable, DashEmpty, DashLegend, DashTooltip, type ChartSeries } from '../components/DashboardParts';

const SERIES: readonly ChartSeries[] = [
    { key: 'assigned', name: 'Ditugaskan', color: CHART_HEX.blue },
    { key: 'resolved', name: 'Diselesaikan', color: CHART_HEX.green },
];
const SERIES_KEYS = ['assigned', 'resolved'] as const;
/** More points than this: label every other tick (mockup `sparse`). */
const SPARSE_AFTER = 10;
/** Weekly buckets beyond this many are numbered "Mg n" instead of dated (90 days). */
const DATED_WEEKS_MAX = 6;
const Y_AXIS_WIDTH = 28;
const AREA_OPACITY = 0.07;
const LINE_WIDTH = 2.25;
const HALF_BAND = 0.5;

export interface TrendRow { label: string; assigned: number; resolved: number }

/** Daily rows for 7 days, weekly totals (dated by week start, "Mg n" when many) for 30/90 days. */
export function buildTrendRows(trend: AgentTicketStats['trend'], periodDays: number): TrendRow[] {
    if (!isWeekly(periodDays)) return trend.map((d) => ({ label: dayMonthLabel(d.date), assigned: d.assigned, resolved: d.resolved }));
    const weeks = bucketByDays(trend, SERIES_KEYS, DAYS_PER_WEEK);
    return weeks.map((w, i) => ({
        label: weeks.length > DATED_WEEKS_MAX ? `Mg ${i + 1}` : dayMonthLabel(w.start),
        assigned: w.values.assigned,
        resolved: w.values.resolved,
    }));
}

export const trendDescription = (periodDays: number): string =>
    `Tiket ditugaskan vs diselesaikan per ${isWeekly(periodDays) ? 'minggu' : 'hari'}`;

/** Mockup "Tren tiket": smooth assigned vs resolved lines, light area under the first series. */
export const AgentTrendChart: React.FC<{ stats: AgentTicketStats; className?: string }> = ({ stats, className }) => {
    const rows = useMemo(() => buildTrendRows(stats.trend, stats.periodDays), [stats.trend, stats.periodDays]);
    const totals = useMemo(() => ({
        assigned: stats.trend.reduce((s, d) => s + d.assigned, 0),
        resolved: stats.trend.reduce((s, d) => s + d.resolved, 0),
    }), [stats.trend]);
    const isEmpty = totals.assigned === 0 && totals.resolved === 0;
    const axis = lineAxis(Math.max(0, ...rows.flatMap((r) => [r.assigned, r.resolved])));
    const sparse = rows.length > SPARSE_AFTER;
    const plotRows = rows.map((r, x) => ({ ...r, x }));
    const xTicks = plotRows.filter((_, i) => !sparse || i % 2 === 0).map((r) => r.x);

    return (
        <section className={cn('dash-panel is-fill', className)} aria-label="Tren tiket">
            <h3>Tren tiket <small>{stats.periodDays} hari terakhir</small></h3>
            <p className="dash-panel-sub">{trendDescription(stats.periodDays)}</p>
            {isEmpty ? (
                <DashEmpty icon={<LineChart aria-hidden="true" />}>Belum ada aktivitas tiket dalam {stats.periodDays} hari terakhir.</DashEmpty>
            ) : (
                <figure className="dash-chart" aria-label="Tren tiket ditugaskan vs diselesaikan">
                    <DashLegend line series={SERIES.map((s) => ({ ...s, total: totals[s.key as keyof typeof totals] }))} />
                    <div className="dash-plot is-soft">
                        <div className="dash-plot-inner">
                            <ResponsiveChart width="100%" height="100%">
                                <ComposedChart data={plotRows} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
                                    <CartesianGrid vertical={false} />
                                    {/* Numeric x over [-.5, n-.5]: point i sits at (i + .5) / n like the mockup, edge labels never clip. */}
                                    <XAxis dataKey="x" type="number" domain={[-HALF_BAND, rows.length - HALF_BAND]} ticks={xTicks}
                                        tickFormatter={(i: number) => rows[i]?.label ?? ''} tickLine={false} axisLine={false} tickMargin={6} allowDecimals={false} />
                                    <YAxis width={Y_AXIS_WIDTH} tickLine={false} axisLine={false} allowDecimals={false} domain={[0, axis.max]} ticks={axis.ticks} />
                                    <Tooltip
                                        cursor={{ stroke: 'var(--td-line-strong)', strokeDasharray: '3 3' }}
                                        content={({ active, label, payload }) => <DashTooltip active={active} title={rows[Number(label)]?.label ?? ''} payload={payload as never} series={SERIES} />}
                                    />
                                    <Area type="monotone" dataKey="assigned" stroke="none" fill={CHART_HEX.blue} fillOpacity={AREA_OPACITY} isAnimationActive={false} tooltipType="none" legendType="none" activeDot={false} />
                                    {SERIES.map((s) => (
                                        <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={LINE_WIDTH}
                                            dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: 'hsl(var(--idesk-surface))' }} />
                                    ))}
                                </ComposedChart>
                            </ResponsiveChart>
                        </div>
                    </div>
                    <DashChartTable caption="Tanggal" labels={rows.map((r) => r.label)} series={SERIES} rows={rows as unknown as Record<string, number>[]} />
                </figure>
            )}
        </section>
    );
};
