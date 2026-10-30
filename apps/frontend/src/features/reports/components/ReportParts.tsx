import React, { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Area, CartesianGrid, ComposedChart, Line, Tooltip, XAxis, YAxis } from 'recharts';
import { ResponsiveChart } from '@/components/ui/responsive-chart';
import { ChevronDown, ChevronLeft, ChevronRight, Eye, FileText, LineChart, Sheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ModernDatePicker } from '@/components/ui/ModernDatePicker';
import { DATE_PRESETS } from '@/lib/constants/date-presets';
import { PRIORITY_CONFIG } from '@/lib/constants/ticket.constants';
import { cn } from '@/lib/utils';
import { daySlashLabel, lineAxis, localIsoDate } from '@/features/dashboard/components/dashboardChart';
import { CHART_HEX, DASH_COLORS, DashChartTable, DashEmpty, DashLegend, DashTooltip, cssVars, type ChartSeries, type DonutItem } from '@/features/dashboard/components/DashboardParts';

/** Round-2 Reports vocabulary (mockup docs/mockups/reports.html): range/month pops, export trio, charts. */

export const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/** "8 – 21 Okt 2026" / "28 Sep – 4 Okt 2026" / "28 Des 2025 – 3 Jan 2026". */
export function rangeLabel(startDate: string, endDate: string): string {
    if (!startDate || !endDate) return '—';
    const s = parseISO(startDate);
    const e = parseISO(endDate);
    const sameYear = s.getFullYear() === e.getFullYear();
    const sameMonth = sameYear && s.getMonth() === e.getMonth();
    const end = `${e.getDate()} ${MONTHS_SHORT[e.getMonth()]} ${e.getFullYear()}`;
    if (sameMonth) return s.getDate() === e.getDate() ? end : `${s.getDate()} – ${end}`;
    return `${s.getDate()} ${MONTHS_SHORT[s.getMonth()]}${sameYear ? '' : ` ${s.getFullYear()}`} – ${end}`;
}

/** Minutes as "3j 50m" (mockup Avg Response). */
export function minutesLabel(minutes: number | null | undefined): string {
    if (minutes == null || !Number.isFinite(minutes) || minutes < 0) return '—';
    if (minutes < 1) return '<1 menit';
    const m = Math.round(minutes);
    const h = Math.floor(m / 60);
    return h > 0 ? `${h}j ${String(m % 60).padStart(2, '0')}m` : `${m}m`;
}

/** Hours (number or "4.25"/"4.25h") as "4j 15m". */
export function hoursLabel(value: string | number | null | undefined): string {
    const num = parseFloat(String(value ?? '').replace(/h$/i, ''));
    if (!Number.isFinite(num)) return '—';
    return minutesLabel(num * 60);
}

/** Inclusive date range of a calendar month as yyyy-mm-dd. */
export function monthRange(month: number, year: number): { startDate: string; endDate: string } {
    return { startDate: localIsoDate(new Date(year, month - 1, 1)), endDate: localIsoDate(new Date(year, month, 0)) };
}

export type QuickRange = '7' | '14' | '30' | 'month';
/** Same date format as DATE_PRESETS (toISOString day), so "30 hari" matches the production default range. */
const presetDay = (d: Date): string => d.toISOString().split('T')[0];
export function quickRange(q: QuickRange, now: Date = new Date()): { startDate: string; endDate: string } {
    if (q === 'month') return { startDate: presetDay(new Date(now.getFullYear(), now.getMonth(), 1)), endDate: presetDay(now) };
    // Same arithmetic as DATE_PRESETS ("Last 30 days" = today − 30), so the production default range lights "30 hari".
    const start = new Date(now);
    start.setDate(start.getDate() - Number(q));
    return { startDate: presetDay(start), endDate: presetDay(now) };
}
export const QUICK_OPTIONS: readonly { value: QuickRange; label: string }[] = [
    { value: '7', label: '7 hari' }, { value: '14', label: '14 hari' }, { value: '30', label: '30 hari' }, { value: 'month', label: 'Bulan ini' },
];
export function matchQuick(startDate: string, endDate: string): QuickRange | null {
    return QUICK_OPTIONS.find((o) => { const r = quickRange(o.value); return r.startDate === startDate && r.endDate === endDate; })?.value ?? null;
}

interface RangePopProps {
    startDate: string;
    endDate: string;
    onChange: (startDate: string, endDate: string) => void;
}

/** Mockup `.pop` "Periode": presets + From/To calendars in one popover. */
export const RangePop: React.FC<RangePopProps> = ({ startDate, endDate, onChange }) => {
    const [open, setOpen] = useState(false);
    const s = startDate ? parseISO(startDate) : undefined;
    const e = endDate ? parseISO(endDate) : undefined;
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button type="button" className="queue-pop" aria-label={`Periode: ${rangeLabel(startDate, endDate)}`}>
                    <span className="queue-pop-k">Periode</span><span className="queue-pop-v">{rangeLabel(startDate, endDate)}</span><ChevronDown aria-hidden="true" />
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[300px] p-3 rounded-2xl">
                <div className="grid gap-3">
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick Select">
                        {DATE_PRESETS.map((p) => (
                            <button key={p.label} type="button" className="res-tag" onClick={() => { const r = p.getValue(); onChange(r.startDate, r.endDate); setOpen(false); }}>{p.label}</button>
                        ))}
                    </div>
                    <label className="grid gap-1 text-xs font-semibold">Dari
                        <ModernDatePicker value={s} maxDate={e} placeholder="Tanggal mulai" onChange={(d) => onChange(format(d, 'yyyy-MM-dd'), endDate)} />
                    </label>
                    <label className="grid gap-1 text-xs font-semibold">Sampai
                        <ModernDatePicker value={e} minDate={s} placeholder="Tanggal akhir" onChange={(d) => onChange(startDate, format(d, 'yyyy-MM-dd'))} />
                    </label>
                </div>
            </PopoverContent>
        </Popover>
    );
};

interface MonthPopProps {
    month: number;
    year: number;
    years: readonly number[];
    onChange: (month: number, year: number) => void;
}

/** Mockup `.pop` "Bulan": year stepper + month grid (keeps production's ±3 year range). */
export const MonthPop: React.FC<MonthPopProps> = ({ month, year, years, onChange }) => {
    const [open, setOpen] = useState(false);
    const [viewYear, setViewYear] = useState(year);
    const minY = years[0];
    const maxY = years[years.length - 1];
    return (
        <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setViewYear(year); }}>
            <PopoverTrigger asChild>
                <button type="button" className="queue-pop" aria-label={`Bulan: ${MONTHS_ID[month - 1]} ${year}`}>
                    <span className="queue-pop-k">Bulan</span><span className="queue-pop-v">{MONTHS_ID[month - 1]} {year}</span><ChevronDown aria-hidden="true" />
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[260px] p-3 rounded-2xl">
                <div className="flex items-center justify-between mb-2">
                    <button type="button" className="res-icon-btn" disabled={viewYear <= minY} onClick={() => setViewYear(viewYear - 1)} aria-label="Tahun sebelumnya"><ChevronLeft aria-hidden="true" /></button>
                    <b className="tabular-nums text-sm">{viewYear}</b>
                    <button type="button" className="res-icon-btn" disabled={viewYear >= maxY} onClick={() => setViewYear(viewYear + 1)} aria-label="Tahun berikutnya"><ChevronRight aria-hidden="true" /></button>
                </div>
                <div className="grid grid-cols-3 gap-1">
                    {MONTHS_SHORT.map((m, i) => {
                        const on = i + 1 === month && viewYear === year;
                        return (
                            <button key={m} type="button" aria-pressed={on} onClick={() => { onChange(i + 1, viewYear); setOpen(false); }}
                                className={cn('h-8 rounded-lg text-[12.5px] font-medium transition-colors', on ? 'bg-[hsl(var(--idesk-sapphire))] text-white' : 'hover:bg-[var(--dash-hover)]')}>
                                {m}
                            </button>
                        );
                    })}
                </div>
            </PopoverContent>
        </Popover>
    );
};

interface ExportTrioProps {
    label: string;
    disabled?: boolean;
    onPreview: () => void;
    onPdf: () => void;
    onExcel: () => void;
}

/** Mockup export buttons: Pratinjau PDF · PDF · Excel. */
export const ExportTrio: React.FC<ExportTrioProps> = ({ label, disabled, onPreview, onPdf, onExcel }) => (
    <div className="dash-head-actions" role="group" aria-label={`Ekspor ${label}`}>
        <Button variant="soft" onClick={onPreview} disabled={disabled}><Eye aria-hidden="true" />Pratinjau PDF</Button>
        <Button variant="soft" onClick={onPdf} disabled={disabled}><FileText aria-hidden="true" />PDF</Button>
        <Button variant="soft" onClick={onExcel} disabled={disabled}><Sheet aria-hidden="true" />Excel</Button>
    </div>
);

/** Status inks for the donut (Open sky / In Progress navy, never the same hue). */
const STATUS_ORDER: readonly { key: string; label: string; color: string }[] = [
    { key: 'TODO', label: 'Open', color: DASH_COLORS.sky },
    { key: 'IN_PROGRESS', label: 'In Progress', color: DASH_COLORS.navy },
    { key: 'WAITING_VENDOR', label: 'Waiting Vendor', color: DASH_COLORS.orange },
    { key: 'RESOLVED', label: 'Resolved', color: DASH_COLORS.green },
    { key: 'CLOSED', label: 'Closed', color: 'var(--dash-teal)' },
    { key: 'CANCELLED', label: 'Cancelled', color: DASH_COLORS.gray },
];
export function statusDonutItems(byStatus: Record<string, number> | undefined): DonutItem[] {
    const data = byStatus ?? {};
    const known = STATUS_ORDER.filter((s) => (data[s.key] ?? 0) > 0 || ['TODO', 'IN_PROGRESS', 'WAITING_VENDOR', 'RESOLVED'].includes(s.key))
        .map((s) => ({ label: s.label, value: data[s.key] ?? 0, color: s.color }));
    const other = Object.entries(data).filter(([k]) => !STATUS_ORDER.some((s) => s.key === k)).map(([k, v]) => ({ label: k.replace(/_/g, ' '), value: v, color: DASH_COLORS.gray }));
    return [...known, ...other];
}

const PRIORITY_ORDER: readonly { key: string; color: string }[] = [
    { key: 'CRITICAL', color: DASH_COLORS.red }, { key: 'HIGH', color: DASH_COLORS.orange },
    { key: 'MEDIUM', color: DASH_COLORS.blue }, { key: 'LOW', color: DASH_COLORS.gray },
];

/** Mockup `.hbars` for priority: Blocker red, Urgent orange, Normal blue, Low gray (other priorities teal). */
export const PriorityBars: React.FC<{ byPriority: Record<string, number> | undefined }> = ({ byPriority }) => {
    const data = byPriority ?? {};
    const rows = [
        ...PRIORITY_ORDER.map((p) => ({ key: p.key, value: data[p.key] ?? 0, color: p.color })),
        ...Object.entries(data).filter(([k]) => !PRIORITY_ORDER.some((p) => p.key === k)).map(([k, v]) => ({ key: k, value: v, color: 'var(--dash-teal)' })),
    ];
    const top = Math.max(1, ...rows.map((r) => r.value));
    return <HBars rows={rows.map((r) => ({ label: PRIORITY_CONFIG[r.key]?.shortLabel ?? r.key.replace(/_/g, ' '), value: r.value, color: r.color }))} max={top} />;
};

export interface HBarRow { label: string; value: number; color?: string; title?: string }

export const HBars: React.FC<{ rows: readonly HBarRow[]; max: number; suffix?: string }> = ({ rows, max, suffix = '' }) => (
    <div className="dash-hbars">
        {rows.map((r) => (
            <div key={r.label} className="dash-hb res-hb-wide" title={r.title ?? `${r.label}: ${r.value}${suffix}`}>
                <span>{r.label}</span>
                <span className="dash-track"><i style={cssVars({ '--p': `${max > 0 ? (r.value / max) * 100 : 0}%`, '--c': r.color ?? 'hsl(var(--idesk-sapphire))' })} /></span>
                <b>{r.value}{suffix}</b>
            </div>
        ))}
    </div>
);

/** Daily "resolved" is counted on the day the ticket was created, so labels must not imply completion-day throughput. */
export const DAILY_CREATED_LABEL = 'Dibuat';
export const DAILY_DONE_LABEL = 'Kini selesai';
export const DAILY_TREND_CAPTION = 'Tiket dibuat per hari, dan dari tiket hari itu berapa yang kini selesai';

const TREND_SERIES: readonly ChartSeries[] = [
    { key: 'created', name: DAILY_CREATED_LABEL, color: CHART_HEX.blue },
    { key: 'resolved', name: DAILY_DONE_LABEL, color: CHART_HEX.green },
];
const SPARSE_AFTER = 10;
const HALF_BAND = 0.5;
const LINE_WIDTH = 2;
const AREA_OPACITY = 0.1;

interface DailyPoint { date: string; created: number; resolved: number; pending?: number }

/** Mockup `lines()`: created per day vs how many of that day's tickets are done now, light area under the first series, hover crosshair. */
export const TrendLines: React.FC<{ daily: readonly DailyPoint[] }> = ({ daily }) => {
    const rows = useMemo(() => daily.map((d, x) => ({ ...d, x, label: daySlashLabel(d.date) })), [daily]);
    const peak = Math.max(0, ...daily.flatMap((d) => [d.created, d.resolved]));
    if (peak === 0) return <DashEmpty icon={<LineChart aria-hidden="true" />}>Belum ada tiket pada periode ini.</DashEmpty>;
    const axis = lineAxis(peak);
    const sparse = rows.length > SPARSE_AFTER;
    const ticks = rows.filter((_, i) => !sparse || i % 2 === 0).map((r) => r.x);
    return (
        <figure className="dash-chart" aria-label="Tren tiket harian">
            <DashLegend series={TREND_SERIES} />
            <div className="dash-plot">
                <div className="dash-plot-inner">
                    <ResponsiveChart width="100%" height="100%">
                        <ComposedChart data={rows} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
                            <CartesianGrid vertical={false} />
                            <XAxis dataKey="x" type="number" domain={[-HALF_BAND, rows.length - HALF_BAND]} ticks={ticks}
                                tickFormatter={(i: number) => rows[i]?.label ?? ''} tickLine={false} axisLine={false} tickMargin={6} allowDecimals={false} />
                            <YAxis width={28} tickLine={false} axisLine={false} allowDecimals={false} domain={[0, axis.max]} ticks={axis.ticks} />
                            <Tooltip cursor={{ stroke: 'var(--td-line-strong)', strokeDasharray: '3 3' }}
                                content={({ active, label, payload }) => <DashTooltip active={active} title={rows[Number(label)]?.label ?? ''} payload={payload as never} series={TREND_SERIES} />} />
                            <Area type="linear" dataKey="created" stroke="none" fill={CHART_HEX.blue} fillOpacity={AREA_OPACITY} isAnimationActive={false} tooltipType="none" legendType="none" activeDot={false} />
                            {TREND_SERIES.map((s) => (
                                <Line key={s.key} type="linear" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={LINE_WIDTH} dot={false} isAnimationActive={false}
                                    activeDot={{ r: 4, strokeWidth: 2, stroke: 'hsl(var(--idesk-surface))' }} />
                            ))}
                        </ComposedChart>
                    </ResponsiveChart>
                </div>
            </div>
            <DashChartTable caption="Tanggal" labels={rows.map((r) => r.label)} series={TREND_SERIES} rows={rows as unknown as Record<string, number>[]} />
        </figure>
    );
};

/** Indonesian short date for the peak day ("19/10"). */
export const peakLabel = (iso: string | undefined): string => (iso ? daySlashLabel(iso) : '—');
export const fullDate = (iso: string): string => format(parseISO(iso), 'd MMM yyyy', { locale: idLocale });
