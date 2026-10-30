import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, Repository } from 'typeorm';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { DEFAULT_TIMEZONE, localDateKey } from '../../sla-config/business-hours.calc';
import { CsiPeriodPublishStatus, CsiRespondentMode } from '../csi.constants';
import { CsiPeriodRater } from '../entities/csi-period-rater.entity';
import { CsiPeriod } from '../entities/csi-period.entity';
import { CsiResponseComment } from '../entities/csi-response-comment.entity';
import { CsiResponse } from '../entities/csi-response.entity';
import { CsiReportService, CsiSiteStats } from './csi-report.service';
import { round2 } from './csi-score.util';
import { CsiSlaService } from './csi-sla.service';

const TREND_POINTS = 5;
const PENDING_MAX = 10;
const COMMENTS_MAX = 5;
/** Comments are stored trimmed and non-empty; scan a few extra rows in case legacy blanks exist. */
const COMMENT_SCAN = 25;
const MONTHS_PER_QUARTER = 3;
const SORT_LAST = '￿';

export type CsiDashboardActive = {
    periodId: string; title: string; siteId: string; siteCode: string | null; siteName: string | null;
    responses: number; basis: number; target: number; targetPct: number; average: number | null; endDate: string;
};
export type CsiDashboardTrend = { siteId: string; siteCode: string | null; points: Array<{ periodId: string; label: string; average: number | null }> };
export type CsiDashboardPersonDelta = { name: string; photoUrl: string | null; siteId: string; delta: number };
export type CsiDashboardPending = { userId: string; fullName: string; department: string | null; siteId: string | null; periodId: string };
export type CsiDashboardComment = { text: string; subjectName: string; siteId: string | null; createdAt: Date };
export type CsiDashboard = {
    active: CsiDashboardActive[]; trend: CsiDashboardTrend[]; peopleDelta: CsiDashboardPersonDelta[];
    pending: CsiDashboardPending[]; comments: CsiDashboardComment[];
};
type SiteRef = { id: string; code: string | null; name: string | null };

/** "Q<quarter> <yy>" of a 'YYYY-MM-DD' end date, e.g. 2026-10-31 -> "Q4 26". */
export function quarterLabel(endDate: string): string {
    const [year, month] = endDate.split('-');
    return `Q${Math.ceil(Number(month) / MONTHS_PER_QUARTER)} ${year.slice(-2)}`;
}

const sitesOf = (period: CsiPeriod): SiteRef[] =>
    (period.sites ?? []).map((row) => ({ id: row.siteId, code: row.site?.code ?? null, name: row.site?.name ?? null }));
const byEndDate = (a: CsiPeriod, b: CsiPeriod) => a.endDate.localeCompare(b.endDate);
const byCode = (a: { siteCode: string | null }, b: { siteCode: string | null }) => (a.siteCode ?? SORT_LAST).localeCompare(b.siteCode ?? SORT_LAST);

/** CSI dashboard of a scope: active periods split per site, trend, per-person change, pending raters, latest comments. */
@Injectable()
export class CsiDashboardService {
    constructor(
        @InjectRepository(CsiPeriod) private readonly periods: Repository<CsiPeriod>,
        @InjectRepository(CsiPeriodRater) private readonly periodRaters: Repository<CsiPeriodRater>,
        @InjectRepository(CsiResponse) private readonly responses: Repository<CsiResponse>,
        @InjectRepository(CsiResponseComment) private readonly comments: Repository<CsiResponseComment>,
        private readonly reports: CsiReportService,
        private readonly sla: CsiSlaService,
    ) { }

    async getDashboard(scope: ServiceScope, now: Date = new Date()): Promise<CsiDashboard> {
        const today = localDateKey(now, DEFAULT_TIMEZONE);
        const started = (await this.periods.find({
            where: { scope, publishStatus: CsiPeriodPublishStatus.PUBLISHED, startDate: LessThanOrEqual(today) },
            relations: { sites: { site: true } },
        })).sort(byEndDate);
        const active = started.filter((period) => period.endDate >= today);
        const stats = new StatsCache((period) => this.reports.siteStats(scope, period, sitesOf(period).map((site) => site.id)));
        return {
            active: await this.activeRows(active, stats),
            trend: await trendOf(started, stats),
            peopleDelta: await peopleDeltaOf(active, started, stats),
            pending: await this.pendingOf(active),
            comments: await this.latestComments(active),
        };
    }

    private async activeRows(active: CsiPeriod[], stats: StatsCache): Promise<CsiDashboardActive[]> {
        const rows = await Promise.all(active.flatMap((period) => sitesOf(period).map(async (site) => {
            const siteStats = await stats.of(period, site.id);
            const sla = await this.sla.compute(period, [{ id: site.id }], siteStats.responses);
            return {
                periodId: period.id, title: period.title, siteId: site.id, siteCode: site.code, siteName: site.name,
                responses: siteStats.responses, basis: sla.basis, target: sla.target, targetPct: sla.targetPct,
                average: siteStats.average, endDate: period.endDate,
            };
        })));
        return rows.sort((a, b) => a.endDate.localeCompare(b.endDate) || byCode(a, b));
    }

    /** LISTED raters without a response, earliest-ending period first (names alphabetical within a period). */
    private async pendingOf(active: CsiPeriod[]): Promise<CsiDashboardPending[]> {
        const listed = active.filter((period) => period.respondentMode === CsiRespondentMode.LISTED);
        if (!listed.length) return [];
        const periodIds = listed.map((period) => period.id);
        const [raters, responses] = await Promise.all([
            this.periodRaters.find({ where: { periodId: In(periodIds) }, relations: { user: { department: true } } }),
            this.responses.find({ where: { periodId: In(periodIds) }, select: { periodId: true, respondentId: true } }),
        ]);
        const answered = new Set(responses.map((row) => `${row.periodId}:${row.respondentId}`));
        const order = new Map(listed.map((period, index) => [period.id, index]));
        return raters
            .filter((rater) => !answered.has(`${rater.periodId}:${rater.userId}`))
            .sort((a, b) => order.get(a.periodId)! - order.get(b.periodId)! || a.user.fullName.localeCompare(b.user.fullName, 'id'))
            .slice(0, PENDING_MAX)
            .map((rater) => ({
                userId: rater.userId, fullName: rater.user.fullName, department: rater.user.department?.name ?? null,
                siteId: rater.user.siteId ?? null, periodId: rater.periodId,
            }));
    }

    private async latestComments(active: CsiPeriod[]): Promise<CsiDashboardComment[]> {
        if (!active.length) return [];
        const rows = await this.comments.find({
            where: { response: { periodId: In(active.map((period) => period.id)) } },
            relations: { periodRatee: true }, order: { createdAt: 'DESC' }, take: COMMENT_SCAN,
        });
        return rows
            .filter((row) => row.comment?.trim())
            .slice(0, COMMENTS_MAX)
            .map((row) => ({
                text: row.comment.trim(), subjectName: row.periodRatee?.displayName ?? '',
                siteId: row.periodRatee?.siteId ?? null, createdAt: row.createdAt,
            }));
    }
}

/** Loads each period's per-site stats at most once per request. */
class StatsCache {
    private readonly cache = new Map<string, Promise<Map<string, CsiSiteStats>>>();

    constructor(private readonly load: (period: CsiPeriod) => Promise<Map<string, CsiSiteStats>>) { }

    async of(period: CsiPeriod, siteId: string): Promise<CsiSiteStats> {
        if (!this.cache.has(period.id)) this.cache.set(period.id, this.load(period));
        return (await this.cache.get(period.id)!).get(siteId) ?? { average: null, responses: 0, people: [] };
    }
}

/** Per site: the last TREND_POINTS started periods (ended ones plus the running one), oldest first. */
async function trendOf(started: CsiPeriod[], stats: StatsCache): Promise<CsiDashboardTrend[]> {
    const sites = new Map<string, SiteRef>();
    started.forEach((period) => sitesOf(period).forEach((site) => sites.set(site.id, site)));
    const trend = await Promise.all([...sites.values()].map(async (site) => {
        const periods = started.filter((period) => sitesOf(period).some((row) => row.id === site.id)).slice(-TREND_POINTS);
        const points = await Promise.all(periods.map(async (period) => ({
            periodId: period.id, label: quarterLabel(period.endDate), average: (await stats.of(period, site.id)).average,
        })));
        return { siteId: site.id, siteCode: site.code, points };
    }));
    return trend.sort(byCode);
}

/** Per active period and site: each person's average vs the latest earlier period of that site, by delta desc. */
async function peopleDeltaOf(active: CsiPeriod[], started: CsiPeriod[], stats: StatsCache): Promise<CsiDashboardPersonDelta[]> {
    const deltas = await Promise.all(active.flatMap((period) => sitesOf(period).map(async (site) => {
        const previous = started.filter((row) => row.endDate < period.startDate && sitesOf(row).some((ref) => ref.id === site.id)).pop();
        if (!previous) return [];
        const before = new Map((await stats.of(previous, site.id)).people.map((row) => [row.userId, row.average]));
        return (await stats.of(period, site.id)).people.flatMap((row) => {
            const old = before.get(row.userId);
            if (row.average === null || old === null || old === undefined) return [];
            return [{ name: row.displayName, photoUrl: row.photoUrl, siteId: site.id, delta: round2(row.average - old) }];
        });
    })));
    return deltas.flat().sort((a, b) => b.delta - a.delta);
}
