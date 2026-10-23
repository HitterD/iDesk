import React from 'react';
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import { ResponsiveChart } from '@/components/ui/responsive-chart';
import { BarChart3 } from 'lucide-react';
import { columnAxis, daySlashLabel } from '../components/dashboardChart';
import { CHART_HEX, DashChartTable, DashEmpty, DashLegend, DashTooltip, type ChartSeries } from '../components/DashboardParts';
import type { TeamDay } from './teamDashboard.stats';

const SERIES: readonly ChartSeries[] = [
    { key: 'created', name: 'Dibuat', color: CHART_HEX.blue },
    { key: 'resolved', name: 'Diselesaikan', color: CHART_HEX.green },
];
/** More days than this: label every other day (mockup `sparse`). */
const SPARSE_AFTER = 14;
const BAR_MAX_PX = 14;
const BAR_RADIUS: [number, number, number, number] = [4, 4, 0, 0];
const Y_AXIS_WIDTH = 28;

/** Mockup "Aktivitas tiket": grouped columns, created (blue) vs resolved (green) per day. */
export const TeamActivityChart: React.FC<{ days: readonly TeamDay[]; range: number }> = ({ days, range }) => {
    const rows = days.map((d) => ({ ...d, label: daySlashLabel(d.date) }));
    const peak = Math.max(0, ...days.flatMap((d) => [d.created, d.resolved]));
    if (peak === 0) {
        return <DashEmpty icon={<BarChart3 aria-hidden="true" />}>Belum ada tiket dibuat atau diselesaikan dalam {range} hari terakhir.</DashEmpty>;
    }
    const axis = columnAxis(peak);
    return (
        <figure className="dash-chart" aria-label={`Tiket dibuat vs diselesaikan ${range} hari terakhir`}>
            <DashLegend series={SERIES} />
            <div className="dash-plot">
                <div className="dash-plot-inner">
                    <ResponsiveChart width="100%" height="100%">
                        <BarChart data={rows} margin={{ top: 6, right: 0, left: 0, bottom: 0 }} barGap={2} barCategoryGap="18%">
                            <CartesianGrid vertical={false} />
                            <XAxis dataKey="label" tickLine={false} axisLine={false} interval={days.length > SPARSE_AFTER ? 1 : 0} tickMargin={6} />
                            <YAxis width={Y_AXIS_WIDTH} tickLine={false} axisLine={false} allowDecimals={false} domain={[0, axis.max]} ticks={axis.ticks} />
                            <Tooltip
                                cursor={{ fill: 'var(--dash-hover)', radius: 6 } as never}
                                content={({ active, label, payload }) => <DashTooltip active={active} title={String(label ?? '')} payload={payload as never} series={SERIES} />}
                            />
                            {SERIES.map((s) => (
                                <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={BAR_RADIUS} maxBarSize={BAR_MAX_PX} minPointSize={2} isAnimationActive={false} />
                            ))}
                        </BarChart>
                    </ResponsiveChart>
                </div>
            </div>
            <DashChartTable caption="Tanggal" labels={rows.map((r) => r.label)} series={SERIES} rows={rows as unknown as Record<string, number>[]} />
        </figure>
    );
};
