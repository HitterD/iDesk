import { differenceInCalendarDays, parseISO } from 'date-fns';
import { CSI_SCORE_FAIR } from '../../../lib/csiTone';
import type { CsiDashboard, CsiDashboardActive, CsiDashboardPending, CsiDashboardTrend } from '../../../types';
import { ratioPct } from '../report/reportModel';

export const SCORE_MIN = 1;
export const SCORE_MAX = 5;

/** Responses reached the per-site target (an empty basis never counts as reached). */
export const isReached = (row: CsiDashboardActive) => row.basis > 0 && row.responses >= row.target;
/** A site counts only when it has a basis (assigned raters / reporters) or answers; "0/0" sites are not shown. */
export const hasAudience = (row: CsiDashboardActive) => row.basis > 0 || row.responses > 0;
export const fillPct = (row: CsiDashboardActive) => ratioPct(row.responses, row.basis);
/** Calendar days until the end date (parsed as a local date, no UTC shift). */
export const daysLeft = (endDate: string, today: Date) => differenceInCalendarDays(parseISO(endDate), today);

export function remainingLabel(endDate: string, today: Date): string {
    const days = daysLeft(endDate, today);
    return days > 0 ? `sisa ${days} hari` : 'berakhir hari ini';
}

/** Site code (or name) per site id from every row that carries one. */
export function siteCodes(data: CsiDashboard): ReadonlyMap<string, string | null> {
    const codes = new Map<string, string | null>();
    data.trend.forEach((row) => codes.set(row.siteId, row.siteCode));
    data.active.forEach((row) => codes.set(row.siteId, row.siteCode));
    return codes;
}

export interface LiveSummary {
    surveys: number;
    siteCodes: string[];
    responses: number;
    basis: number;
    average: number | null;
    delta: number | null;
    behind: CsiDashboardActive[];
}

/** Score of the trend point before this period's point on the same site, if any. */
function previousAverage(row: CsiDashboardActive, trend: readonly CsiDashboardTrend[]): number | null {
    const points = trend.find((item) => item.siteId === row.siteId)?.points ?? [];
    const index = points.findIndex((point) => point.periodId === row.periodId);
    return index > 0 ? points[index - 1].average : null;
}

const mean = (values: readonly number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

/**
 * Average = response-weighted mean of the active site averages.
 * Delta = mean change of the sites that have both this and the previous period score.
 */
export function liveSummary(data: CsiDashboard): LiveSummary {
    const { active, trend } = data;
    const scored = active.filter((row) => row.average !== null && row.responses > 0);
    const weight = scored.reduce((sum, row) => sum + row.responses, 0);
    const deltas = active.flatMap((row) => {
        const before = previousAverage(row, trend);
        return row.average !== null && before !== null ? [row.average - before] : [];
    });
    return {
        surveys: new Set(active.map((row) => row.periodId)).size,
        siteCodes: [...new Set(active.map((row) => row.siteCode ?? row.siteName ?? '—'))],
        responses: active.reduce((sum, row) => sum + row.responses, 0),
        basis: active.reduce((sum, row) => sum + row.basis, 0),
        average: weight > 0 ? scored.reduce((sum, row) => sum + (row.average as number) * row.responses, 0) / weight : null,
        delta: mean(deltas),
        behind: active.filter((row) => hasAudience(row) && !isReached(row)),
    };
}

/** Pending raters grouped per period (one reminder call per period). */
export function groupByPeriod(rows: readonly CsiDashboardPending[]): Map<string, string[]> {
    const groups = new Map<string, string[]>();
    rows.forEach((row) => groups.set(row.periodId, [...(groups.get(row.periodId) ?? []), row.userId]));
    return groups;
}

export const reminderKey = (periodId: string, userId: string) => `${periodId}:${userId}`;

/** The backend returns at most this many pending raters (csi-dashboard.service PENDING_MAX). */
export const PENDING_MAX = 10;
/** A full list may be truncated, so the bulk action only promises the people shown. */
export const remindAllLabel = (pendingCount: number) => pendingCount >= PENDING_MAX ? 'Ingatkan yang tampil' : 'Ingatkan semua';

// ─── Trend chart ─────────────────────────────────────────────────────────────
export interface TrendColumn { periodId: string; label: string }
export interface ChartPoint { column: number; average: number }
export interface ChartLine { siteId: string; siteCode: string | null; segments: ChartPoint[][] }

/** Columns = every period of every site, each site's own order kept (a new period goes after its predecessor). */
export function trendColumns(trend: readonly CsiDashboardTrend[]): TrendColumn[] {
    const columns: TrendColumn[] = [];
    trend.forEach(({ points }) => {
        let insertAt = 0;
        points.forEach((point) => {
            const known = columns.findIndex((column) => column.periodId === point.periodId);
            if (known >= 0) { insertAt = known + 1; return; }
            columns.splice(insertAt, 0, { periodId: point.periodId, label: point.label });
            insertAt += 1;
        });
    });
    return columns;
}

/** One line per site; a null average breaks the line into separate segments (a gap, never zero). */
export function chartLines(trend: readonly CsiDashboardTrend[], columns: readonly TrendColumn[]): ChartLine[] {
    const indexOf = new Map(columns.map((column, index) => [column.periodId, index]));
    return trend.map(({ siteId, siteCode, points }) => {
        const segments: ChartPoint[][] = [];
        let current: ChartPoint[] = [];
        points.forEach((point) => {
            if (point.average === null) {
                if (current.length) segments.push(current);
                current = [];
                return;
            }
            current.push({ column: indexOf.get(point.periodId) ?? 0, average: point.average });
        });
        if (current.length) segments.push(current);
        return { siteId, siteCode, segments };
    });
}

/** 4,00–5,00 when every score is at least 4 (differences stay visible); otherwise the full 1–5 scale. */
export function yDomain(lines: readonly ChartLine[]): { min: number; max: number; ticks: number[] } {
    const values = lines.flatMap((line) => line.segments.flat().map((point) => point.average));
    if (values.length > 0 && values.every((value) => value >= CSI_SCORE_FAIR)) {
        return { min: CSI_SCORE_FAIR, max: SCORE_MAX, ticks: [4, 4.25, 4.5, 4.75, 5] };
    }
    return { min: SCORE_MIN, max: SCORE_MAX, ticks: [1, 2, 3, 4, 5] };
}

export const hasTrendData = (trend: readonly CsiDashboardTrend[]) =>
    trend.some((row) => row.points.some((point) => point.average !== null));
