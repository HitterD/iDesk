import React from 'react';
import { ArrowUpRight, Database, HardDrive, Layers, Radio, Wifi } from 'lucide-react';
import { ResBub, resVars } from '@/components/resources/ResourceParts';
import type { DetailedHealthStatus, HealthHistory } from '../../hooks/useHealthSocket';
import { formatBytes, formatRelativeTime, formatUptime, meterColor, statusTone } from './healthFormat';

/** Mockup system-health.html "Overview & Vitals": 4 KPI cards with meters + "5 Core Connectors" list. */

const SPARK_W = 72;
const SPARK_H = 22;
const SPARK_PAD = 2;

/** Tiny trend line in the card / row hue (replaces the hex-coloured Sparkline). */
export const HealthSpark: React.FC<{ data: readonly number[]; color: string; label: string }> = ({ data, color, label }) => {
    if (data.length < 2) return null;
    const min = Math.min(...data);
    const range = Math.max(...data) - min || 1;
    const step = (SPARK_W - SPARK_PAD * 2) / (data.length - 1);
    const d = data.map((v, i) => `${i === 0 ? 'M' : 'L'}${(SPARK_PAD + i * step).toFixed(1)} ${(SPARK_H - SPARK_PAD - ((v - min) / range) * (SPARK_H - SPARK_PAD * 2)).toFixed(1)}`).join(' ');
    return (
        <svg className="hl-spark" viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} role="img" aria-label={label} style={resVars({ '--c': color })}>
            <path d={d} />
        </svg>
    );
};

interface KpiProps {
    name: string;
    value: React.ReactNode;
    unit?: string;
    meter?: { value: number; color: string };
    sub: React.ReactNode;
    aside?: React.ReactNode;
    onClick?: () => void;
    title?: string;
}

const PERCENT_MAX = 100;
const clampPct = (v: number) => Math.min(PERCENT_MAX, Math.max(0, isNaN(v) ? 0 : v));

/** Mockup `.kpi`: name, big number with unit, optional meter, sub line. */
const HealthKpi: React.FC<KpiProps> = ({ name, value, unit, meter, sub, aside, onClick, title }) => {
    const body = (
        <>
            <span className="hl-kpi-top"><span>{name}</span>{aside}</span>
            <span className="res-kpi-n">{value}{unit && <small>{unit}</small>}</span>
            {meter && <span className="res-meter hl-meter" style={resVars({ '--c': meter.color })}><i style={resVars({ '--p': `${clampPct(meter.value)}%` })} /></span>}
            <p>{sub}</p>
        </>
    );
    if (!onClick) return <div className="res-kpi">{body}</div>;
    return <button type="button" className="res-kpi hl-kpi-btn" onClick={onClick} title={title}>{body}</button>;
};

interface VitalsProps {
    health: DetailedHealthStatus | undefined;
    uptime: number;
    history: HealthHistory;
    onOpenStorage: () => void;
}

const CPU_WARN = 60;
const CPU_CRIT = 80;
const MEM_WARN = 70;
const MEM_CRIT = 85;
const DISK_WARN = 75;
const DISK_CRIT = 90;

export const HealthKpis: React.FC<VitalsProps> = ({ health, uptime, history, onOpenStorage }) => {
    const sys = health?.system;
    const cpu = sys?.cpuUsage || 0;
    const mem = sys?.memoryUsage || 0;
    const disk = sys?.diskUsage || 0;
    const memTotal = sys?.memoryTotal || 0;
    const memUsed = Math.max(0, memTotal - (sys?.memoryFree || 0));
    const proc = sys?.process;
    const cpuColor = meterColor(cpu, 'var(--dash-blue)', CPU_WARN, CPU_CRIT);
    const memColor = meterColor(mem, 'var(--dash-navy)', MEM_WARN, MEM_CRIT);
    return (
        <section className="res-kpis" aria-label="Vital sistem">
            <HealthKpi name="CPU Usage" value={Math.round(cpu)} unit="%" meter={{ value: cpu, color: cpuColor }}
                aside={<HealthSpark data={history.cpu} color={cpuColor} label="Tren CPU" />}
                sub={<>Load avg <span className="tabular-nums">{(sys?.loadAverage || [0, 0, 0]).map((l) => l.toFixed(2)).join(' · ')}</span> · {sys?.arch || 'x64'}</>} />
            <HealthKpi name="Memory (RAM)" value={Math.round(mem)} unit="%" meter={{ value: mem, color: memColor }}
                aside={<HealthSpark data={history.memory} color={memColor} label="Tren memori" />}
                sub={<>{formatBytes(memUsed)} / {formatBytes(memTotal)}{proc ? <> · heap {formatBytes(proc.heapUsed)} / {formatBytes(proc.heapTotal)}</> : <> · {formatBytes(sys?.memoryFree)} bebas</>}</>} />
            <HealthKpi name="Disk" value={Math.round(disk)} unit="%" meter={{ value: disk, color: meterColor(disk, 'var(--dash-orange)', DISK_WARN, DISK_CRIT) }}
                onClick={onOpenStorage} title="Buka analisa kapasitas & forecasting storage"
                aside={<span className="hl-kpi-link">Forecasting<ArrowUpRight aria-hidden="true" /></span>}
                sub={sys?.diskTotal
                    ? <>Terpakai {formatBytes(sys.diskTotal - (sys.diskFree || 0))} / {formatBytes(sys.diskTotal)} · bebas {formatBytes(sys.diskFree)} · {sys.platform || 'Node'}</>
                    : <>Ukuran volume tidak tersedia · {sys?.platform || 'Node'}</>} />
            <HealthKpi name="Engine Uptime" value={formatUptime(uptime || health?.uptime || 0)}
                aside={<span className="hl-kpi-meta">PID {proc?.pid ?? '—'}</span>}
                sub={<>Node.js {sys?.nodeVersion || 'Tidak tersedia'} · build v{health?.version || '1.5.0'} · jam server {health?.timestamp ? new Date(health.timestamp).toLocaleTimeString('id-ID') : new Date().toLocaleTimeString('id-ID')}</>} />
        </section>
    );
};

interface ConnectorsProps {
    health: DetailedHealthStatus | undefined;
    history: HealthHistory;
    isConnected: boolean;
    pingLatency: number | null;
    transportType: string;
    wsClients: number | undefined;
    synology: { configured?: boolean; connected?: boolean; lastBackup?: string } | undefined;
    synologyLoading: boolean;
    onOpenWs: () => void;
}

const Row: React.FC<{ icon: React.ElementType; color: string; name: React.ReactNode; detail: React.ReactNode; status: React.ReactNode; extra?: React.ReactNode; trend?: React.ReactNode }> = ({ icon: Icon, color, name, detail, status, extra, trend }) => (
    <>
        <span className="dash-ico" style={resVars({ '--c': color })}><Icon aria-hidden="true" /></span>
        <div className="grow1"><b>{name}</b><small>{detail}</small>{extra}</div>
        {trend && <span className="mg-hide-sm">{trend}</span>}
        {status}
    </>
);

const Bubble: React.FC<{ status: string | undefined }> = ({ status }) => {
    const t = statusTone(status);
    return <ResBub color={t.color} ink={t.ink}>{t.label}</ResBub>;
};

export const HealthConnectors: React.FC<ConnectorsProps> = ({ health, history, isConnected, pingLatency, transportType, wsClients, synology, synologyLoading, onOpenWs }) => {
    const infra = health?.infrastructure;
    const redis = infra?.redis;
    const sja = infra?.sjaNotification;
    const backupConfigured = Boolean(infra?.backup?.configured || synology?.configured);
    const backupStatus = !backupConfigured ? 'disabled' : synology?.connected || infra?.backup?.connected ? 'connected' : 'disconnected';
    const lastBackup = synology?.lastBackup || infra?.backup?.lastBackup;
    const sjaStatus = sja?.status === 'connected' ? 'operational' : sja?.status === 'degraded' ? 'degraded' : 'down';
    return (
        <section className="dash-panel" aria-label="5 Core Connectors">
            <h3>5 Core Connectors <small>Infrastruktur &amp; message broker</small></h3>
            <ul className="dash-list">
                <li><div className="dash-li">
                    <Row icon={Database} color="var(--dash-blue)" name="PostgreSQL DB"
                        detail={<>Query probe SELECT 1 · {infra?.database?.latency || 0} ms · TypeORM primary pool</>}
                        trend={<HealthSpark data={history.dbLatency} color="var(--dash-blue)" label="Tren latency database" />}
                        status={<Bubble status={infra?.database?.status || 'disconnected'} />} />
                </div></li>
                <li><div className="dash-li hl-li-top">
                    <Row icon={Layers} color="var(--dash-red)" name="Redis & Bull"
                        detail={redis?.detail
                            ? <>Ping {redis.latency ?? 0} ms · {redis.detail.keys} keys · {formatBytes(redis.detail.usedMemory)}</>
                            : redis?.status === 'disabled' ? 'Redis nonaktif. Set REDIS_ENABLED=true di .env backend.' : <>Ping {redis?.latency ?? 0} ms</>}
                        extra={redis?.detail && redis.detail.queues.length > 0 && (
                            <span className="hl-queues" aria-label="Antrian Bull: wait · active · fail">
                                {redis.detail.queues.map((q) => (
                                    <span key={q.name} className={q.failed > 0 ? 'hl-q is-fail' : 'hl-q'} title="wait · active · fail">
                                        <span className="mono">{q.name}</span><b>{q.waiting} · {q.active} · {q.failed}</b>
                                    </span>
                                ))}
                            </span>
                        )}
                        status={<Bubble status={redis?.status || 'disabled'} />} />
                </div></li>
                <li><button type="button" className="dash-li" onClick={onOpenWs} title="Buka WebSocket Gateway Diagnostics & Live Stream">
                    <Row icon={Wifi} color="var(--dash-green)" name="Socket.IO /health"
                        detail={<>RTT {pingLatency !== null ? `${pingLatency} ms` : '—'} · {wsClients ?? '—'} klien aktif · <span className="uppercase">{transportType}</span> / fast 2s · buka diagnostik</>}
                        status={<Bubble status={isConnected ? 'operational' : 'down'} />} />
                </button></li>
                <li><div className="dash-li">
                    <Row icon={HardDrive} color="var(--dash-orange)" name="Synology Backup"
                        detail={<>{lastBackup ? `Backup terakhir ${formatRelativeTime(lastBackup)}` : 'Belum ada backup tercatat'} · target Synology NAS · automated snapshots</>}
                        status={synologyLoading ? <i className="dash-sk hl-sk-bub" aria-label="Memuat status backup" /> : <Bubble status={backupStatus} />} />
                </div></li>
                <li><div className="dash-li">
                    <Row icon={Radio} color="var(--dash-teal)" name="SJA Notification"
                        detail={<>Hub latency {sja?.latency ?? '—'} ms · Desktop WSS push hub v2.0 · {sja?.activeDevices ?? '—'} PC paired · DPAPI + HMAC-SHA256</>}
                        status={<Bubble status={sjaStatus} />} />
                </div></li>
            </ul>
        </section>
    );
};
