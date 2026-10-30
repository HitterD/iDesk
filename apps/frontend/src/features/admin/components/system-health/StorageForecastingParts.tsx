import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ChevronDown, FileText, Image, Info, Server, Sparkles } from 'lucide-react';
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts';
import { ResponsiveChart } from '@/components/ui/responsive-chart';
import { resVars } from '@/components/resources/ResourceParts';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Button } from '@/components/ui/button';
import { DashLegend, type ChartSeries } from '@/features/dashboard/components/DashboardParts';

/** Presentation blocks for StorageForecastingTab (mockup system-health.html "Storage Forecasting"). No data logic. */

export type HorizonMode = '30d' | '90d' | '180d' | '365d';
export type ScenarioMode = 'all' | 'baseline' | 'high' | 'peak';

export const SCENARIO_OPTIONS: readonly { value: ScenarioMode; label: string }[] = [
    { value: 'all', label: 'Semua Skenario' },
    { value: 'baseline', label: 'Baseline (1x)' },
    { value: 'high', label: 'High (+50%)' },
    { value: 'peak', label: 'Peak (2x)' },
];
export const HORIZON_OPTIONS: readonly { value: HorizonMode; label: string }[] = [
    { value: '30d', label: '30 Hari' }, { value: '90d', label: '90 Hari' }, { value: '180d', label: '180 Hari' }, { value: '365d', label: '1 Tahun' },
];

const C_BASE = 'hsl(var(--idesk-sapphire))';
const C_HIGH = 'var(--dash-orange)';
const C_PEAK = 'var(--dash-red)';
const C_WARN = 'hsl(var(--ticket-amber))';
const C_CRIT = 'hsl(var(--ticket-red))';
const C_SIM = 'var(--dash-green)';
const AREA_OPACITY = 0.1;
const Y_AXIS_WIDTH = 64;

export interface ProjectionRow {
    timestamp: string;
    dateLabel: string;
    baselineGB: number;
    highGrowthGB: number;
    peakGrowthGB: number;
    warningLimitGB: number;
    criticalLimitGB: number;
    simulatedTotalGB: number;
}

const SERIES: readonly (ChartSeries & { scenario: ScenarioMode })[] = [
    { key: 'baselineGB', name: 'Baseline (1.0x)', color: C_BASE, scenario: 'baseline' },
    { key: 'highGrowthGB', name: 'High Load (+50%)', color: C_HIGH, scenario: 'high' },
    { key: 'peakGrowthGB', name: 'Peak Surge (2.0x)', color: C_PEAK, scenario: 'peak' },
];

const ProjectionTip: React.FC<{ active?: boolean; payload?: { payload: ProjectionRow }[]; scenario: ScenarioMode; fullDate: (iso: string) => string }> = ({ active, payload, scenario, fullDate }) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload;
    const shown = SERIES.filter((s) => scenario === 'all' || s.scenario === scenario || s.scenario === 'baseline');
    return (
        <div className="dash-tip">
            <b>{p.dateLabel} · {fullDate(p.timestamp)}</b>
            {shown.map((s) => <span key={s.key} style={resVars({ '--c': s.color })}><i />{s.name}<em>{p[s.key as keyof ProjectionRow]} GB</em></span>)}
            <span style={resVars({ '--c': C_WARN })}><i />Warning (85%)<em>{p.warningLimitGB} GB</em></span>
            <span style={resVars({ '--c': C_CRIT })}><i />Critical (95%)<em>{p.criticalLimitGB} GB</em></span>
        </div>
    );
};

interface ChartProps {
    rows: readonly ProjectionRow[];
    scenario: ScenarioMode;
    onScenario: (s: ScenarioMode) => void;
    horizon: HorizonMode;
    onHorizon: (h: HorizonMode) => void;
    simulatedExtraGB: number;
    fullDate: (iso: string) => string;
}

export const ProjectionChart: React.FC<ChartProps> = ({ rows, scenario, onScenario, horizon, onHorizon, simulatedExtraGB, fullDate }) => {
    const first = rows[0];
    const show = (s: ScenarioMode) => scenario === 'all' || scenario === s;
    return (
        <section className="dash-panel" aria-label="Proyeksi kurva pertumbuhan">
            <h3>Proyeksi Kurva Pertumbuhan &amp; Capacity Runway</h3>
            <p className="dash-panel-sub">Proyeksi volume storage dari data historis dan skenario lonjakan beban. Titik “Hari Ini” adalah volume aktual saat ini.</p>
            <div className="hl-tools">
                <SegmentedControl aria-label="Skenario pertumbuhan" className="dash-seg is-sm" options={SCENARIO_OPTIONS} value={scenario} onValueChange={onScenario} />
                <SegmentedControl aria-label="Horizon proyeksi" className="dash-seg is-sm" options={HORIZON_OPTIONS} value={horizon} onValueChange={onHorizon} />
            </div>
            <figure className="dash-chart" aria-label="Proyeksi pemakaian storage (GB)">
                <DashLegend line series={SERIES.filter((s) => show(s.scenario))} />
                <div className="dash-plot is-soft hl-plot-lg">
                    <div className="dash-plot-inner">
                        <ResponsiveChart width="100%" height="100%">
                            <ComposedChart data={rows as ProjectionRow[]} margin={{ top: 14, right: 8, left: 0, bottom: 0 }}>
                                <CartesianGrid vertical={false} />
                                <XAxis dataKey="dateLabel" tickLine={false} axisLine={false} tickMargin={6} minTickGap={24} />
                                <YAxis width={Y_AXIS_WIDTH} tickLine={false} axisLine={false} unit=" GB" domain={[0, 'dataMax + 20']} />
                                <Tooltip cursor={{ stroke: 'var(--td-line-strong)', strokeDasharray: '3 3' }}
                                    content={({ active, payload }) => <ProjectionTip active={active} payload={payload as never} scenario={scenario} fullDate={fullDate} />} />
                                {first && (
                                    <>
                                        <ReferenceLine y={first.criticalLimitGB} stroke={C_CRIT} strokeDasharray="4 4" strokeWidth={1.5}
                                            label={{ value: `Kritis 95% (${first.criticalLimitGB} GB)`, fill: C_CRIT, fontSize: 10, position: 'insideTopRight' }} />
                                        <ReferenceLine y={first.warningLimitGB} stroke={C_WARN} strokeDasharray="4 4" strokeWidth={1.5}
                                            label={{ value: `Waspada 85% (${first.warningLimitGB} GB)`, fill: C_WARN, fontSize: 10, position: 'insideTopRight' }} />
                                        {simulatedExtraGB > 0 && (
                                            <ReferenceLine y={first.simulatedTotalGB} stroke={C_SIM} strokeDasharray="3 3" strokeWidth={2}
                                                label={{ value: `Simulasi Resize (${first.simulatedTotalGB} GB)`, fill: C_SIM, fontSize: 10, position: 'insideTopRight' }} />
                                        )}
                                    </>
                                )}
                                {show('baseline') && (
                                    <Area type="monotone" dataKey="baselineGB" name="Baseline Growth (1.0x)" stroke={C_BASE} strokeWidth={2.25}
                                        fill={C_BASE} fillOpacity={AREA_OPACITY} activeDot={{ r: 4, strokeWidth: 2, stroke: 'hsl(var(--idesk-surface))' }} />
                                )}
                                {show('high') && <Line type="monotone" dataKey="highGrowthGB" name="High Load (+50%)" stroke={C_HIGH} strokeWidth={2} strokeDasharray="4 4" dot={false} />}
                                {show('peak') && <Line type="monotone" dataKey="peakGrowthGB" name="Peak Surge (2.0x)" stroke={C_PEAK} strokeWidth={2} strokeDasharray="3 3" dot={false} />}
                            </ComposedChart>
                        </ResponsiveChart>
                    </div>
                </div>
            </figure>
        </section>
    );
};

/** Mockup `hbars`: label, track, value. */
export const StorageBar: React.FC<{ label: React.ReactNode; pct: number; value: React.ReactNode; color: string; title?: string; mono?: boolean }> = ({ label, pct, value, color, title, mono }) => (
    <div className="dash-hb hl-hb" title={title}>
        <span className={mono ? 'mono' : undefined}>{label}</span>
        <span className="dash-track"><i style={resVars({ '--p': `${Math.max(0, Math.min(100, pct))}%`, '--c': color })} /></span>
        <b>{value}</b>
    </div>
);

const SIM_MAX_GB = 1500;
const SIM_STEP_GB = 25;
const SIM_PRESETS = [50, 100, 250, 500, 1000] as const;
const DAYS_PER_MONTH = 30;

interface SimProps {
    extraGB: number;
    onExtra: (gb: number) => void;
    totalGB: number;
    result: { extraDaysGained: number; isCapped: boolean; newFullDate: string; daysRemaining: number } | null;
    runwayDate: (iso?: string | null, days?: number | null) => string;
    expanded: string | null;
    onExpand: (p: string | null) => void;
}

const GUIDES: readonly { id: string; title: string; steps: React.ReactNode[] }[] = [
    { id: 'synology', title: 'Synology DSM NAS (Storage Pool & Volume)', steps: [
        <>Buka <strong>Storage Manager</strong> di Synology DSM.</>,
        <>Pilih <strong>Storage Pool</strong> &gt; <em>Action</em> &gt; <em>Add Drive</em>, atau ganti HDD/SSD dengan kapasitas lebih besar.</>,
        <>Pilih <strong>Volume</strong> tempat iDesk berada &gt; titik tiga &gt; <em>Settings</em> &gt; ubah <em>Modify Allocated Size</em> ke ukuran baru.</>,
    ] },
    { id: 'vm', title: 'Virtual Machine (VMware ESXi / Proxmox VE)', steps: [
        <>Edit konfigurasi VM di hypervisor &gt; naikkan ukuran <em>Virtual Disk</em> (misal +100 GB).</>,
        <>Di guest OS Linux: jalankan <code>growpart /dev/sda 1</code> lalu <code>resize2fs /dev/sda1</code>.</>,
        <>Di Windows Server: buka <em>diskmgmt.msc</em> &gt; klik kanan partisi C: &gt; <em>Extend Volume</em>.</>,
    ] },
];

export const ResizeSimulator: React.FC<SimProps> = ({ extraGB, onExtra, totalGB, result, runwayDate, expanded, onExpand }) => (
    <section className="dash-panel" aria-label="Simulator resizing disk">
        <h3>Simulator Resizing Disk (Capacity Planning)</h3>
        <p className="dash-panel-sub">Geser untuk mensimulasikan penambahan kapasitas volume (fisik/VM) dan lihat perpanjangan runway.</p>
        <div className="mg-setting">
            <div><b>Tambah Kapasitas Disk:</b><small>Total setelah resize {totalGB + extraGB} GB</small></div>
            <b className="hl-sim-n">+{extraGB} GB</b>
        </div>
        <input type="range" min={0} max={SIM_MAX_GB} step={SIM_STEP_GB} value={extraGB} aria-label="Tambah kapasitas disk (GB)"
            onChange={(e) => onExtra(parseInt(e.target.value, 10))} className="hl-range" />
        <div className="hl-presets">
            <span>Preset cepat</span>
            <SegmentedControl aria-label="Preset kapasitas" className="dash-seg is-sm"
                options={SIM_PRESETS.map((gb) => ({ value: String(gb), label: `+${gb} GB` }))}
                value={SIM_PRESETS.includes(extraGB as typeof SIM_PRESETS[number]) ? String(extraGB) : null} onValueChange={(v) => onExtra(Number(v))} />
            {extraGB > 0 && <Button variant="subtle" size="sm" onClick={() => onExtra(0)}>Reset</Button>}
        </div>
        {extraGB > 0 && result ? (
            <div className="res-note hl-note-ok">
                <Sparkles aria-hidden="true" />
                <div>
                    <b>Hasil Estimasi Simulasi Ekstensi Volume:</b>
                    <div className="hl-sim-grid">
                        <span>Tambahan Waktu Runway:<b>{result.isCapped ? '> 3 Tahun (Kapasitas Sangat Longgar)' : `+${result.extraDaysGained} Hari (~${Math.round(result.extraDaysGained / DAYS_PER_MONTH)} Bulan)`}</b></span>
                        <span>Estimasi Kritis Baru (95%):<b>{runwayDate(result.newFullDate, result.daysRemaining)}</b></span>
                    </div>
                </div>
            </div>
        ) : (
            <div className="res-note"><Info aria-hidden="true" /><span>Rekomendasi: tambahkan minimal <strong>+100 GB</strong> untuk mengamankan operasional tanpa intervensi selama 2 tahun ke depan.</span></div>
        )}
        <h4 className="hl-sub">Panduan teknis resize volume server</h4>
        <ul className="dash-list">
            {GUIDES.map((g) => {
                const open = expanded === g.id;
                return (
                    <li key={g.id}>
                        <button type="button" className="dash-li" aria-expanded={open} onClick={() => onExpand(open ? null : g.id)}>
                            <span className="dash-ico" style={resVars({ '--c': g.id === 'vm' ? 'var(--dash-teal)' : 'var(--dash-blue)' })}><Server aria-hidden="true" /></span>
                            <div className="grow1"><b>{g.title}</b></div>
                            <ChevronDown aria-hidden="true" className={open ? 'hl-chev is-open' : 'hl-chev'} />
                        </button>
                        {open && <ol className="hl-steps">{g.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>}
                    </li>
                );
            })}
        </ul>
    </section>
);

interface MitigationProps {
    imageBytes: string;
    cleanupBytes: string;
    totalBytes: string;
}

export const Mitigations: React.FC<MitigationProps> = ({ imageBytes, cleanupBytes, totalBytes }) => (
    <section className="dash-panel" aria-label="Mitigasi cepat">
        <h3>Mitigasi Cepat (Zero-Cost) <small>Tanpa biaya</small></h3>
        <p className="dash-panel-sub">Kosongkan ruang disk tanpa hardware baru lewat fitur optimasi yang sudah ada di iDesk.</p>
        <ul className="dash-list">
            <li><Link to="/settings/storage" className="dash-li">
                <span className="dash-ico" style={resVars({ '--c': 'var(--dash-orange)' })}><Image aria-hidden="true" /></span>
                <div className="grow1"><b>Kompresi Gambar Lampiran (Sharp)</b><small>Estimasi hemat ~{imageBytes} · Buka Pengaturan Kompresi</small></div>
                <ArrowUpRight aria-hidden="true" />
            </Link></li>
            <li><Link to="/settings/storage" className="dash-li">
                <span className="dash-ico" style={resVars({ '--c': 'var(--dash-blue)' })}><FileText aria-hidden="true" /></span>
                <div className="grow1"><b>Retensi Tiket Lama (&gt;90 Hari)</b><small>Estimasi hemat ~{cleanupBytes} · Konfigurasi Retensi Tiket</small></div>
                <ArrowUpRight aria-hidden="true" />
            </Link></li>
        </ul>
        <div className="mg-setting hl-total"><div><b>Total Potensi Pengosongan:</b></div><b className="hl-sim-n is-ok">~{totalBytes}</b></div>
    </section>
);
