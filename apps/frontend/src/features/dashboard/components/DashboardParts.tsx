import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TicketPillTone } from '@/components/ui/ticket-pill';
import { SegmentedControl } from '@/components/ui/segmented-control';
import '../dashboard.css';

/** Mockup token colours (pages.css HUES / status inks). Blue/green are the same hex in both themes. */
export const DASH_COLORS = {
    blue: 'var(--dash-blue)', green: 'var(--dash-green)', orange: 'var(--dash-orange)', red: 'var(--dash-red)',
    gray: 'var(--dash-gray)', navy: 'var(--dash-navy)', sky: 'var(--dash-sky)', accent: 'hsl(var(--idesk-sapphire))',
    inkRed: 'var(--dash-ink-red)', inkOrange: 'var(--dash-ink-orange)', inkGreen: 'var(--dash-ink-green)',
} as const;
/** Mockup PRI_DOT: Blocker red, Urgent orange, Normal blue, Low gray. */
export const PRIORITY_DOT: Readonly<Record<string, string>> = {
    CRITICAL: DASH_COLORS.red, HIGH: DASH_COLORS.orange, MEDIUM: DASH_COLORS.blue, LOW: DASH_COLORS.gray,
};
/** Literal hex for recharts SVG attributes (CSS vars are not resolved in every presentation attribute). */
export const CHART_HEX = { blue: '#3d63b8', green: '#2fb350' } as const;

const AVATAR_HUES = ['var(--dash-pink)', 'var(--dash-blue)', 'var(--dash-orange)', 'var(--dash-teal)', 'var(--dash-green)', 'var(--dash-navy)', 'var(--dash-red)', 'var(--dash-brown)'];
const MAX_INITIALS = 2;
const STAR_COUNT = 5;

type CssVars = React.CSSProperties & Record<`--${string}`, string>;
export const cssVars = (vars: Record<`--${string}`, string>): CssVars => vars as CssVars;

/** Stable hue per name (mockup `hue`). */
export const nameHue = (name: string): string =>
    AVATAR_HUES[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % AVATAR_HUES.length];
export const initials = (name: string): string =>
    name.split(/\s+/).filter(Boolean).slice(0, MAX_INITIALS).map((w) => w[0]?.toUpperCase() ?? '').join('');

export const DashAvatar: React.FC<{ name: string }> = ({ name }) => (
    <span className="dash-avatar" style={cssVars({ '--c': nameHue(name) })} aria-hidden="true">{initials(name)}</span>
);

interface DashStatProps {
    icon: React.ElementType;
    tone: TicketPillTone;
    label: string;
    value: React.ReactNode;
    sub?: React.ReactNode;
    /** Tinted attention card (Overdue / Lewat SLA). */
    attention?: boolean;
    zero?: boolean;
    to?: string;
    isLoading?: boolean;
}

/** One stat-card grammar with the queue stat cards: icon bubble, number top-right, name, sub line. */
export const DashStat: React.FC<DashStatProps> = ({ icon: Icon, tone, label, value, sub, attention, zero, to, isLoading }) => {
    const className = cn('dash-stat', `ticket-tone-${tone}`, attention && 'is-attn', zero && 'is-zero');
    const body = (
        <>
            <span className="portal-stat-top">
                <span className="portal-stat-icon"><Icon aria-hidden="true" /></span>
                {isLoading ? <i className="dash-sk is-num" aria-hidden="true" /> : <span className="portal-stat-value">{value}</span>}
            </span>
            <span className="portal-stat-label">{label}</span>
            {sub !== undefined && <span className="dash-stat-sub">{sub}</span>}
        </>
    );
    return to ? <Link to={to} className={className}>{body}</Link> : <div className={className}>{body}</div>;
};

interface DashPanelProps {
    title: React.ReactNode;
    /** Accessible region name (defaults to the title when it is a string). */
    label?: string;
    className?: string;
    children: React.ReactNode;
}

export const DashPanel: React.FC<DashPanelProps> = ({ title, label, className, children }) => (
    <section className={cn('dash-panel', className)} aria-label={label ?? (typeof title === 'string' ? title : undefined)}>
        <h3>{title}</h3>
        {children}
    </section>
);

export const DashMore: React.FC<{ to: string; children: React.ReactNode }> = ({ to, children }) => (
    <Link to={to} className="dash-more">{children}<ChevronRight aria-hidden="true" /></Link>
);

export const DashLive: React.FC<{ connected: boolean }> = ({ connected }) => (
    <span className={cn('dash-live', !connected && 'is-off')}><i />{connected ? 'Live' : 'Offline'}</span>
);

interface DashSegProps<V extends string> {
    options: readonly { value: V; label: string }[];
    value: V;
    onChange: (value: V) => void;
    'aria-label': string;
    small?: boolean;
}

/** Mockup `.seg`: period / range switch with the sliding thumb. */
export function DashSeg<V extends string>({ options, value, onChange, 'aria-label': ariaLabel, small }: DashSegProps<V>) {
    return (
        <SegmentedControl
            aria-label={ariaLabel}
            className={cn('dash-seg', small && 'is-sm')}
            options={options}
            value={value}
            onValueChange={onChange}
        />
    );
}

interface DashBubProps {
    color: string;
    ink?: string;
    icon?: React.ElementType;
    mono?: boolean;
    className?: string;
    title?: string;
    children: React.ReactNode;
}

export const DashBub: React.FC<DashBubProps> = ({ color, ink, icon: Icon, mono, className, title, children }) => (
    <span className={cn('dash-bub', mono && 'mono', className)} title={title} style={cssVars(ink ? { '--c': color, '--ink': ink } : { '--c': color })}>
        {Icon && <Icon aria-hidden="true" />}{children}
    </span>
);

export const DashStars: React.FC<{ value: number; label?: string }> = ({ value, label }) => {
    const filled = Math.round(value);
    return (
        <span className="dash-stars" role="img" aria-label={label ?? `${filled} dari ${STAR_COUNT}`}>
            {Array.from({ length: STAR_COUNT }, (_, i) => <Star key={i} className={i < filled ? undefined : 'is-off'} aria-hidden="true" />)}
        </span>
    );
};

export const DashMetric: React.FC<{ icon: React.ElementType; color: string; label: string; hint?: string; value: React.ReactNode }> = ({ icon: Icon, color, label, hint, value }) => (
    <div className="dash-metric" style={cssVars({ '--c': color })}>
        <span className="dash-ico"><Icon aria-hidden="true" /></span>
        <div>{label}{hint && <small>{hint}</small>}</div>
        <b>{value}</b>
    </div>
);

export const DashEmpty: React.FC<{ icon?: React.ReactNode; children: React.ReactNode }> = ({ icon, children }) => (
    <div className="dash-empty">{icon}<p className="m-0">{children}</p></div>
);

/** Mockup `skeletonList`: icon box + two text bars per row. */
export const DashSkeletonList: React.FC<{ rows: number }> = ({ rows }) => (
    <div className="dash-list" aria-hidden="true">
        {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="dash-li">
                <i className="dash-sk is-box" />
                <div className="grow1 grid gap-1.5"><i className="dash-sk w-3/5" /><i className="dash-sk w-2/5" /></div>
            </div>
        ))}
    </div>
);

export const DashChartSkeleton: React.FC = () => (
    <div className="grid gap-2.5 py-5" aria-hidden="true">
        {['w-[90%]', 'w-[70%]', 'w-[60%]', 'w-1/2'].map((w) => <i key={w} className={cn('dash-sk', w)} />)}
    </div>
);

export interface DonutItem { label: string; value: number; color: string }
const DONUT_R = 52;
const DONUT_GAP = 2;
const DONUT_MIN_DASH = 0.5;
const PERCENT = 100;

/** Mockup donut: 2px surface gaps, total in the centre, legend that names every slice. */
export const DashDonut: React.FC<{ items: readonly DonutItem[]; label: string; unit?: string }> = ({ items, label, unit = 'tiket' }) => {
    const total = items.reduce((sum, it) => sum + it.value, 0);
    const circ = 2 * Math.PI * DONUT_R;
    let offset = 0;
    const segments = total === 0 ? [] : items.filter((it) => it.value > 0).map((it) => {
        const len = (it.value / total) * circ;
        const seg = (
            <circle key={it.label} className="is-seg" r={DONUT_R} cx="64" cy="64" style={cssVars({ '--c': it.color })}
                strokeDasharray={`${Math.max(len - DONUT_GAP, DONUT_MIN_DASH)} ${circ}`} strokeDashoffset={-offset}>
                <title>{`${it.label}: ${it.value} (${Math.round((it.value / total) * PERCENT)}%)`}</title>
            </circle>
        );
        offset += len;
        return seg;
    });
    return (
        <div className="dash-donut" role="img" aria-label={`${label}: ${items.map((i) => `${i.label} ${i.value}`).join(', ')}`}>
            <div className="dash-donut-center">
                <svg viewBox="0 0 128 128" aria-hidden="true"><circle className="is-track" r={DONUT_R} cx="64" cy="64" />{segments}</svg>
                <b>{total}<small>{unit}</small></b>
            </div>
            <div className="dash-dlegend">
                {items.map((i) => <div key={i.label} style={cssVars({ '--c': i.color })}><i /><span>{i.label}</span><b>{i.value}</b></div>)}
            </div>
        </div>
    );
};

export interface ChartSeries { key: string; name: string; color: string }

/** "Lihat sebagai tabel": the chart's numbers for screen readers and exact reading. */
export const DashChartTable: React.FC<{ caption: string; labels: readonly string[]; series: readonly ChartSeries[]; rows: readonly Record<string, number>[] }> = ({ caption, labels, series, rows }) => (
    <details className="dash-table">
        <summary>Lihat sebagai tabel</summary>
        <table>
            <thead><tr><th>{caption}</th>{series.map((s) => <th key={s.key}>{s.name}</th>)}</tr></thead>
            <tbody>{labels.map((l, i) => <tr key={`${l}-${i}`}><td>{l}</td>{series.map((s) => <td key={s.key}>{rows[i][s.key]}</td>)}</tr>)}</tbody>
        </table>
    </details>
);

export const DashLegend: React.FC<{ series: readonly (ChartSeries & { total?: number })[]; line?: boolean }> = ({ series, line }) => (
    <div className={cn('dash-legend', line && 'is-line')}>
        {series.map((s) => (
            <span key={s.key} style={cssVars({ '--c': s.color })}><i />{s.name}{s.total !== undefined && <b className="tabular-nums text-foreground">{s.total}</b>}</span>
        ))}
    </div>
);

/** Recharts tooltip body in the mockup `.chart-tip` style. */
export const DashTooltip: React.FC<{ active?: boolean; title?: string; payload?: { dataKey?: unknown; value?: unknown }[]; series: readonly ChartSeries[] }> = ({ active, title, payload, series }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="dash-tip">
            <b>{title}</b>
            {series.map((s) => {
                const hit = payload.find((p) => p.dataKey === s.key);
                return <span key={s.key} style={cssVars({ '--c': s.color })}><i />{s.name}<em>{String(hit?.value ?? 0)}</em></span>;
            })}
        </div>
    );
};
