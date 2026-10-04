import React from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { LineChart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { shortDateLabel } from './agentDashboard.format';
import type { AgentTicketStats } from './agentDashboard.types';
import { EmptyNote, SECTION_TITLE, SURFACE } from './AgentDashboardWidgets';

const CHART_HEIGHT_PX = 220;
const ASSIGNED_COLOR = '#0a84ff'; // Apple system blue
const RESOLVED_COLOR = '#30d158'; // Apple system green

const SERIES = [
    { key: 'assigned', name: 'Ditugaskan', color: ASSIGNED_COLOR },
    { key: 'resolved', name: 'Diselesaikan', color: RESOLVED_COLOR },
] as const;

type TrendPoint = AgentTicketStats['trend'][number];

const ChartTooltip: React.FC<{ active?: boolean; label?: string; payload?: { payload: TrendPoint }[] }> = ({ active, label, payload }) => {
    if (!active || !payload?.length) return null;
    const point = payload[0].payload;
    return (
        <div className="rounded-xl bg-popover/95 backdrop-blur px-3 py-2 shadow-lg ring-1 ring-black/5 dark:ring-white/10 text-xs">
            <p className="font-semibold text-foreground mb-1">{shortDateLabel(String(label))}</p>
            {SERIES.map((s) => (
                <p key={s.key} className="flex items-center gap-2 text-muted-foreground">
                    <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                    {s.name}<span className="ml-auto pl-3 font-semibold text-foreground tabular-nums">{point[s.key]}</span>
                </p>
            ))}
        </div>
    );
};

/** Assigned vs resolved per day, Apple Health-style area chart. */
export const AgentTrendChart: React.FC<{ stats: AgentTicketStats }> = ({ stats }) => {
    const totals = stats.trend.reduce(
        (acc, d) => ({ assigned: acc.assigned + d.assigned, resolved: acc.resolved + d.resolved }),
        { assigned: 0, resolved: 0 },
    );
    const isEmpty = totals.assigned === 0 && totals.resolved === 0;

    return (
        <section className={cn(SURFACE, 'p-5 md:p-6 h-full flex flex-col')} aria-label="Tren tiket">
            <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
                <div>
                    <h2 className={SECTION_TITLE}>Tren {stats.periodDays} hari</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">Tiket ditugaskan vs diselesaikan per hari</p>
                </div>
                <div className="flex gap-5">
                    {SERIES.map((s) => (
                        <div key={s.key}>
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />{s.name}
                            </p>
                            <p className="text-2xl font-semibold text-foreground tabular-nums leading-tight">{totals[s.key]}</p>
                        </div>
                    ))}
                </div>
            </div>
            {isEmpty ? (
                <EmptyNote icon={<LineChart className="w-8 h-8 text-muted-foreground/40" />}>
                    Belum ada aktivitas tiket dalam {stats.periodDays} hari terakhir.
                </EmptyNote>
            ) : (
                <div style={{ height: CHART_HEIGHT_PX }} className="mt-auto">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={stats.trend} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                            <defs>
                                {SERIES.map((s) => (
                                    <linearGradient key={s.key} id={`trend-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
                                        <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                                    </linearGradient>
                                ))}
                            </defs>
                            <CartesianGrid vertical={false} stroke="currentColor" className="text-border" strokeOpacity={0.6} />
                            <XAxis
                                dataKey="date" tickFormatter={shortDateLabel} tickLine={false} axisLine={false}
                                tick={{ fontSize: 11, fill: 'currentColor' }} className="text-muted-foreground" minTickGap={24}
                            />
                            <YAxis
                                allowDecimals={false} tickLine={false} axisLine={false} width={40}
                                tick={{ fontSize: 11, fill: 'currentColor' }} className="text-muted-foreground"
                            />
                            <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'currentColor', strokeOpacity: 0.15, strokeWidth: 1 }} />
                            {SERIES.map((s) => (
                                <Area
                                    key={s.key} type="monotone" dataKey={s.key} name={s.name}
                                    stroke={s.color} strokeWidth={2} fill={`url(#trend-${s.key})`}
                                    dot={false} activeDot={{ r: 4, strokeWidth: 0 }}
                                />
                            ))}
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}
        </section>
    );
};
