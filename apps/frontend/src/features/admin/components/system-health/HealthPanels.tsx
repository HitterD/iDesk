import React, { useMemo } from 'react';
import { Activity, BookOpen, Bell, CheckCircle, ClipboardList, Copy, FileText, History, Radio, Server, Settings, Shield, Users, Video } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ResBub, ResSearch, resVars } from '@/components/resources/ResourceParts';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Button } from '@/components/ui/button';
import { DashEmpty, DashLegend, DashTooltip, type ChartSeries } from '@/features/dashboard/components/DashboardParts';
import type { HealthHistory, ServiceStatus, SystemIncident } from '../../hooks/useHealthSocket';
import { formatRelativeTime, statusTone } from './healthFormat';

/** Mockup system-health.html right column (latency chart, incident log) + production-only panels in the same vocabulary. */

const LATENCY_SERIES: readonly ChartSeries[] = [
    { key: 'db', name: 'PostgreSQL (ms)', color: 'hsl(var(--idesk-sapphire))' },
    { key: 'redis', name: 'Redis (ms)', color: 'var(--dash-orange)' },
];
const Y_AXIS_WIDTH = 30;
const LINE_WIDTH = 2;

/** Mockup "Latency API": the live sample buffer from the health socket (no hourly history exists in the API). */
export const HealthLatencyPanel: React.FC<{ history: HealthHistory }> = ({ history }) => {
    const rows = useMemo(() => {
        const n = Math.max(history.dbLatency.length, history.redisLatency.length);
        return Array.from({ length: n }, (_, i) => ({ x: i + 1, db: history.dbLatency[i] ?? null, redis: history.redisLatency[i] ?? null }));
    }, [history.dbLatency, history.redisLatency]);
    return (
        <section className="dash-panel" aria-label="Latency">
            <h3>Latency <small>{rows.length} sampel terakhir · ms</small></h3>
            {rows.length < 2 ? (
                <DashEmpty icon={<Activity aria-hidden="true" />}>Menunggu sampel latency dari stream telemetri.</DashEmpty>
            ) : (
                <figure className="dash-chart" aria-label="Latency database dan Redis per sampel">
                    <DashLegend line series={LATENCY_SERIES} />
                    <div className="dash-plot is-soft hl-plot">
                        <div className="dash-plot-inner">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={rows} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
                                    <CartesianGrid vertical={false} />
                                    <XAxis dataKey="x" tickLine={false} axisLine={false} tickMargin={6} minTickGap={24} />
                                    <YAxis width={Y_AXIS_WIDTH} tickLine={false} axisLine={false} allowDecimals={false} />
                                    <Tooltip cursor={{ stroke: 'var(--td-line-strong)', strokeDasharray: '3 3' }}
                                        content={({ active, label, payload }) => <DashTooltip active={active} title={`Sampel ${label}`} payload={payload as never} series={LATENCY_SERIES} />} />
                                    {LATENCY_SERIES.map((s) => (
                                        <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={LINE_WIDTH} dot={false}
                                            isAnimationActive={false} connectNulls activeDot={{ r: 4, strokeWidth: 2, stroke: 'hsl(var(--idesk-surface))' }} />
                                    ))}
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </figure>
            )}
        </section>
    );
};

const INCIDENT_LIMIT = 15;

export const HealthIncidentPanel: React.FC<{ incidents: readonly SystemIncident[]; onCopy: () => void }> = ({ incidents, onCopy }) => {
    const sorted = useMemo(() => [...incidents].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, INCIDENT_LIMIT), [incidents]);
    return (
        <section className="dash-panel" aria-label="Incident log">
            <h3>Incident log <small>{incidents.length} event · ring buffer 50</small></h3>
            {sorted.length === 0 ? (
                <DashEmpty icon={<CheckCircle aria-hidden="true" />}>Semua sistem stabil. Tidak ada degradasi atau insiden layanan pada jendela terakhir.</DashEmpty>
            ) : (
                <ul className="dash-list hl-scroll">
                    {sorted.map((inc) => (
                        <li key={inc.id}><div className="dash-li">
                            <span className="dash-pdot" style={resVars({ '--c': statusTone(inc.newStatus).color })} />
                            <div className="grow1"><b>{inc.service} <span className="hl-trans mono">{inc.previousStatus} → {inc.newStatus}</span></b><small>{inc.message}</small></div>
                            <span className="dash-date">{formatRelativeTime(inc.timestamp)}</span>
                        </div></li>
                    ))}
                </ul>
            )}
            <div className="hl-panel-foot"><Button variant="subtle" size="sm" onClick={onCopy}><Copy aria-hidden="true" />Salin diagnostik JSON</Button></div>
        </section>
    );
};

const SERVICE_ICONS: Readonly<Record<string, React.ElementType>> = {
    Authentication: Shield, Tickets: ClipboardList, Notifications: Bell, Reports: FileText, 'Knowledge Base': BookOpen,
    Automation: Settings, 'Zoom Booking': Video, 'Audit Logs': History, 'User Management': Users, 'SJA Desktop Hub': Radio,
};

export type ServiceFilter = 'all' | 'operational' | 'degraded' | 'down';

interface ServicesProps {
    services: readonly ServiceStatus[];
    counts: Record<ServiceFilter, number>;
    filter: ServiceFilter;
    onFilter: (f: ServiceFilter) => void;
    search: string;
    onSearch: (s: string) => void;
}

/** Production-only "Subsystem Services Integrity" in the mockup list-row vocabulary. */
export const HealthServicesPanel: React.FC<ServicesProps> = ({ services, counts, filter, onFilter, search, onSearch }) => {
    const options = [
        { value: 'all' as const, label: `Semua (${counts.all})` },
        { value: 'operational' as const, label: `Sehat (${counts.operational})` },
        ...(counts.degraded > 0 ? [{ value: 'degraded' as const, label: `Degraded (${counts.degraded})` }] : []),
        ...(counts.down > 0 ? [{ value: 'down' as const, label: `Down (${counts.down})` }] : []),
    ];
    return (
        <section className="dash-panel" aria-label="Integritas subsistem">
            <h3>Integritas subsistem <small>{counts.all} modul · probe query database &amp; latency</small></h3>
            <div className="hl-tools">
                <ResSearch id="hl-svc-search" value={search} onChange={onSearch} placeholder="Cari modul…" label="Cari modul" />
                <SegmentedControl aria-label="Filter status layanan" className="dash-seg is-sm" options={options} value={filter} onValueChange={onFilter} />
            </div>
            {services.length === 0 ? (
                <DashEmpty icon={<Server aria-hidden="true" />}>Tidak ada modul yang cocok dengan filter atau pencarian.</DashEmpty>
            ) : (
                <ul className="dash-list hl-svc-grid">
                    {services.map((s) => {
                        const Icon = SERVICE_ICONS[s.name] || Server;
                        const tone = statusTone(s.status);
                        return (
                            <li key={s.name}><div className="dash-li">
                                <span className="dash-ico" style={resVars({ '--c': tone.color })}><Icon aria-hidden="true" /></span>
                                <div className="grow1"><b>{s.name}</b><small><span className="mono">{s.module}</span> · {s.latency} ms</small></div>
                                <ResBub color={tone.color} ink={tone.ink}>{tone.label}</ResBub>
                            </div></li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
};

/** Production-only "Environment & Specs" as mockup `.setting` rows. */
export const HealthEnvPanel: React.FC<{ nodeVersion?: string; platform?: string; arch?: string }> = ({ nodeVersion, platform, arch }) => (
    <section className="dash-panel" aria-label="Lingkungan">
        <h3>Lingkungan <small>Cadence 2s fast / 30s slow</small></h3>
        <div className="mg-setting"><div><b>App environment</b></div><span className="mono hl-val">{import.meta.env.MODE || 'production'}</span></div>
        <div className="mg-setting"><div><b>Node.js engine</b></div><span className="mono hl-val">{nodeVersion || 'Tidak tersedia'}</span></div>
        <div className="mg-setting"><div><b>OS / arsitektur</b></div><span className="mono hl-val">{platform || 'win32'} / {arch || 'x64'}</span></div>
        <div className="mg-setting"><div><b>Zona waktu lokal</b></div><span className="hl-val">{Intl.DateTimeFormat().resolvedOptions().timeZone}</span></div>
    </section>
);
