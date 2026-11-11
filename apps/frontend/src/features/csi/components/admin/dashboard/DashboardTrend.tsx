import { cn } from '@/lib/utils';
import { siteTone, toneClasses, toneColor } from '../../../lib/csiTone';
import { formatFixed2 } from '../../../lib/format';
import type { CsiDashboard } from '../../../types';
import { RateeAvatar } from '../../respond/RateeAvatar';
import { AdminSection, EmptyNote, MUTED_TEXT } from '../AdminParts';
import { SiteBadge } from '../report/reportParts';
import { LIST_ITEM } from './DashboardLists';
import { PILL } from './DashboardLive';
import { chartLines, hasTrendData, sharedBands, siteCodes, trendColumns, yDomain, type ChartLine, type TrendColumn } from './dashboardModel';

// SVG geometry (viewBox units), as in the approved mockup.
const VIEW_W = 640;
const VIEW_H = 225;
const PLOT_LEFT = 60;
const PLOT_RIGHT = 600;
const PLOT_TOP = 30;
const PLOT_BOTTOM = 200;
const GRID_LEFT = 50;
const GRID_RIGHT = 630;
const AXIS_LABEL_X = 42;
const AXIS_LABEL_Y = 220;
const LABEL_OFFSET = 4;
const POINT_R = 3.5;
const MINUS = '−';

const xOf = (column: number, count: number) =>
    count > 1 ? PLOT_LEFT + (column * (PLOT_RIGHT - PLOT_LEFT)) / (count - 1) : (PLOT_LEFT + PLOT_RIGHT) / 2;

function SiteLine({ line, columns, y }: { line: ChartLine; columns: readonly TrendColumn[]; y: (value: number) => number }) {
    const color = toneColor(siteTone(line.siteCode));
    const x = (column: number) => xOf(column, columns.length);
    return (
        <g data-site-line={line.siteId}>
            {line.segments.filter((segment) => segment.length > 1).map((segment, index) => (
                <polyline key={index} className="csi-draw-line" fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" pathLength={1}
                    points={segment.map((point) => `${x(point.column)},${y(point.average)}`).join(' ')} />
            ))}
            {line.segments.flat().map((point) => (
                <circle key={point.column} cx={x(point.column)} cy={y(point.average)} r={POINT_R}
                    fill="hsl(var(--idesk-surface))" stroke={color} strokeWidth={2}>
                    <title>{`${line.siteCode ?? ''} ${columns[point.column]?.label ?? ''}: ${formatFixed2(point.average)}`}</title>
                </circle>
            ))}
        </g>
    );
}

function TrendChart({ data }: { data: CsiDashboard }) {
    const columns = trendColumns(data.trend);
    const lines = chartLines(data.trend, columns);
    // Trend points carry no bands: the axis follows the bands the active surveys share (default otherwise).
    const { min, max, ticks } = yDomain(lines, sharedBands(data.active));
    const y = (value: number) => PLOT_BOTTOM - ((value - min) / (max - min)) * (PLOT_BOTTOM - PLOT_TOP);
    return (
        <>
            <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="img" aria-label="Grafik tren skor per site" className="block h-auto w-full">
                {ticks.map((tick) => (
                    <g key={tick}>
                        <line x1={GRID_LEFT} x2={GRID_RIGHT} y1={y(tick)} y2={y(tick)} stroke="hsl(var(--idesk-border))" />
                        <text x={AXIS_LABEL_X} y={y(tick) + LABEL_OFFSET} fontSize={11} textAnchor="end" fill="hsl(var(--idesk-text-secondary))">{formatFixed2(tick)}</text>
                    </g>
                ))}
                {columns.map((column, index) => (
                    <text key={column.periodId} x={xOf(index, columns.length)} y={AXIS_LABEL_Y} fontSize={11} textAnchor="middle"
                        fill="hsl(var(--idesk-text-secondary))">{column.label}</text>
                ))}
                {lines.map((line) => <SiteLine key={line.siteId} line={line} columns={columns} y={y} />)}
            </svg>
            <ul aria-label="Legenda site" className="mt-2 flex flex-wrap gap-3.5 text-[12.5px]">
                {data.trend.map((row) => (
                    <li key={row.siteId} className="inline-flex items-center gap-1.5">
                        <span aria-hidden="true" className={cn('h-2.5 w-2.5 rounded-full', toneClasses(siteTone(row.siteCode)).fill)} />
                        {row.siteCode ?? '—'}
                    </li>
                ))}
            </ul>
        </>
    );
}

const signed = (delta: number) => `${delta >= 0 ? '+' : MINUS}${formatFixed2(Math.abs(delta))}`;

function PeopleDelta({ data }: { data: CsiDashboard }) {
    const codes = siteCodes(data);
    if (!data.peopleDelta.length) return <p className={MUTED_TEXT}>Belum ada periode pembanding.</p>;
    return (
        <ul aria-label="Perubahan skor per orang">
            {data.peopleDelta.map((person, index) => {
                const tone = toneClasses(person.delta >= 0 ? 'green' : 'red');
                return (
                    <li key={`${person.siteId}:${person.name}:${index}`} className={LIST_ITEM}>
                        <RateeAvatar name={person.name} avatarUrl={person.photoUrl} size="sm" />
                        <b className="min-w-0 flex-1 truncate text-[13px] font-semibold">{person.name}</b>
                        <SiteBadge code={codes.get(person.siteId) ?? null} />
                        <span className={cn(PILL, 'tabular-nums', tone.soft, tone.ink)}>{signed(person.delta)}</span>
                    </li>
                );
            })}
        </ul>
    );
}

/** Tab "Tren": score line per site over the last periods, and each person's change vs the previous period. */
export function DashboardTrend({ data }: { data: CsiDashboard }) {
    const hasTrend = hasTrendData(data.trend);
    if (!hasTrend && !data.peopleDelta.length) return <EmptyNote>Belum ada data tren.</EmptyNote>;
    return (
        <div className="grid grid-cols-12 gap-3">
            <AdminSection title="Skor per site, 5 periode terakhir" description="Skala 1–5; titik kosong = belum ada nilai"
                className="col-span-12 xl:col-span-8">
                {hasTrend ? <TrendChart data={data} /> : <p className={MUTED_TEXT}>Belum ada data tren.</p>}
            </AdminSection>
            <AdminSection title="Perubahan per orang" description="Periode ini dibanding periode sebelumnya" className="col-span-12 xl:col-span-4">
                <PeopleDelta data={data} />
            </AdminSection>
        </div>
    );
}
