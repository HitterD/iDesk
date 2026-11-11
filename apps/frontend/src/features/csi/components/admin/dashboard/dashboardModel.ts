import { differenceInCalendarDays, parseISO } from 'date-fns';
import { CSI_SCORE_BANDS_DEFAULT, type CsiScoreBands } from '../../../lib/csiTone';
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
    /** Colour bands for the combined numbers (see sharedBands). */
    bands: CsiScoreBands;
}

/**
 * Bands of the active rows when they all agree; surveys with different bands have no common rule, so the combined
 * average and the trend axis fall back to the default (each site card keeps its own survey's bands).
 */
export function sharedBands(rows: readonly CsiDashboardActive[]): CsiScoreBands {
    const first = rows.find((row) => row.scoreBands)?.scoreBands;
    const same = !!first && rows.every((row) => !row.scoreBands || (row.scoreBands.fairMin === first.fairMin && row.scoreBands.goodMin === first.goodMin));
    return same && first ? first : CSI_SCORE_BANDS_DEFAULT;
}

/** Score of the trend point before this period's point on the same site, if any. */
function previousAverage(row: CsiDashboardActive, trend: readonly CsiDashboardTrend[]): number | null {
    const points = trend.find((item) => item.siteId === row.siteId)?.points ?? [];
    const index = points.findIndex((point) => point.periodId === row.periodId);
    return index > 0 ? points[index - 1].average : null;
}

const mean = (values: readonly number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

/** Weight of a site average: its score units (HC ratings, ICT responses); older payloads fall back to responses. */
const weightOf = (row: CsiDashboardActive) => row.scoreWeight ?? row.responses;

/**
 * Average = mean of the active site averages weighted by their score units (HC: ratings, the per-rating basis of the
 * report; ICT: responses).
 * Delta = mean change of the sites that have both this and the previous period score.
 */
export function liveSummary(data: CsiDashboard): LiveSummary {
    const { active, trend } = data;
    const scored = active.filter((row) => row.average !== null && weightOf(row) > 0);
    const weight = scored.reduce((sum, row) => sum + weightOf(row), 0);
    const deltas = active.flatMap((row) => {
        const before = previousAverage(row, trend);
        return row.average !== null && before !== null ? [row.average - before] : [];
    });
    return {
        surveys: new Set(active.map((row) => row.periodId)).size,
        siteCodes: [...new Set(active.map((row) => row.siteCode ?? row.siteName ?? '—'))],
        responses: active.reduce((sum, row) => sum + row.responses, 0),
        basis: active.reduce((sum, row) => sum + row.basis, 0),
        average: weight > 0 ? scored.reduce((sum, row) => sum + (row.average as number) * weightOf(row), 0) / weight : null,
        delta: mean(deltas),
        behind: active.filter((row) => hasAudience(row) && !isReached(row)),
        bands: sharedBands(active),
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

const ZOOM_TICKS = 5;
const evenTicks = (min: number, max: number, count: number) =>
    Array.from({ length: count }, (_, index) => Math.round((min + ((max - min) * index) / (count - 1)) * 100) / 100);

/**
 * Zoomed fairMin–5 axis when every score is at least the orange band (differences stay visible), five even ticks;
 * otherwise the full 1–5 scale.
 */
export function yDomain(lines: readonly ChartLine[], bands: CsiScoreBands = CSI_SCORE_BANDS_DEFAULT): { min: number; max: number; ticks: number[] } {
    const values = lines.flatMap((line) => line.segments.flat().map((point) => point.average));
    if (values.length > 0 && bands.fairMin < SCORE_MAX && values.every((value) => value >= bands.fairMin)) {
        return { min: bands.fairMin, max: SCORE_MAX, ticks: evenTicks(bands.fairMin, SCORE_MAX, ZOOM_TICKS) };
    }
    return { min: SCORE_MIN, max: SCORE_MAX, ticks: [1, 2, 3, 4, 5] };
}

export const hasTrendData = (trend: readonly CsiDashboardTrend[]) =>
    trend.some((row) => row.points.some((point) => point.average !== null));
