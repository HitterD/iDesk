import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Request } from 'express';
import { DataSource, FindOptionsRelations, In, LessThan, Repository } from 'typeorm';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { AuditService } from '../../audit/audit.service';
import { AuditAction } from '../../audit/entities/audit-log.entity';
import { CSI_RESET_REASON_MIN, isSimulation, CsiPairMode, CsiPeriodPublishStatus, CsiQuestionType, CsiRateeKind, CsiRespondentMode } from '../csi.constants';
import { CsiPeriodRateeDimension } from '../entities/csi-period-ratee-dimension.entity';
import { CsiPeriodRatee } from '../entities/csi-period-ratee.entity';
import { CsiPeriodRater } from '../entities/csi-period-rater.entity';
import { CsiPeriod } from '../entities/csi-period.entity';
import { CsiResponseComment } from '../entities/csi-response-comment.entity';
import { CsiResponseItem } from '../entities/csi-response-item.entity';
import { CsiResponse } from '../entities/csi-response.entity';
import { lockPeriodRow } from './csi-period-lock.util';
import { CsiItemRow, itemsForSite, overallStats, rateeStats, ratingAverage } from './csi-report.calc';
import { assertPeriodInScope } from './csi-scope.util';
import { CsiAssignmentService } from './csi-assignment.service';
import { raterMatrix } from './csi-rater-matrix.calc';
import { CsiSlaReporter, CsiSlaService } from './csi-sla.service';
import { User } from '../../users/entities/user.entity';
import { Site } from '../../sites/entities/site.entity';
import { buildReportModel, CsiReportModel, previousSubjectMap } from './csi-report-model';
import { bandsOf, CsiScoreBands } from './csi-score-bands';
import { CsiRateeView, CsiSubjectService } from './csi-subject.service';
import { buildHcRecap, CsiHcPic, CsiHcRating, CsiHcRecap, recapAverages } from '../org/csi-hc-report.calc';
import { locationOfSiteCode, normalizeNik } from '../org/csi-org.constants';
import { CsiPendingDepartment, pendingByDepartment } from '../org/csi-service-report.calc';
import { ratedAccountOf } from './csi-ratee-owner.util';
import { isRaterInAudience } from './csi-rater-audience.util';
import { CsiDepartmentParticipation, departmentParticipation } from './csi-report-participation';
import { CsiAssignmentTemplate } from '../entities/csi-assignment-template.entity';
import { CsiAssignmentTemplatePic } from '../entities/csi-assignment-template-pic.entity';
import { CsiAssignmentTemplateRater } from '../entities/csi-assignment-template-rater.entity';
import { ratersWithoutAccount } from '../org/csi-template-view';

const RESPONSE_NOT_FOUND_MESSAGE = 'Jawaban tidak ditemukan';
const RESET_ENTITY_TYPE = 'csi_response';
const SORT_LAST = '￿';
const RATEE_ORDER_FACTOR = 1e6;
const SITE_NOT_IN_PERIOD_MESSAGE = 'Site tidak termasuk dalam periode ini';

export type CsiActorRef = { id: string };
export type CsiHcPeriodRef = { id: string; title: string; startDate: string; endDate: string };
export type CsiHcRecapInput = {
    period: CsiHcPeriodRef; scoreBands: CsiScoreBands; pics: CsiHcPic[]; ratings: CsiHcRating[]; dimensions: string[];
    /**
     * Accounts that ARE each rated row: the PIC's account, or every member account of a custom team. A viewer listed
     * here sees that row only as their own (masked, raters anonymous).
     */
    ownersOf: Map<string, string[]>;
};
/** `score` is null for CHOICE/TEXT answers; `answerLabel` (SCALE/CHOICE) and `answerText` (TEXT) carry the non-numeric answer. */
export type CsiAnswerScore = {
    dimension: string; type: CsiQuestionType; score: number | null; answerLabel: string | null; answerText: string | null;
};
export type CsiAnswerRatee = {
    periodRateeId: string; kind: CsiRateeKind; displayName: string; jobTitle: string | null; comment: string | null; scores: CsiAnswerScore[];
};
export type CsiAnswer = {
    responseId: string; respondentName: string; accountName: string; areaName: string | null;
    /** Site of the respondent's account (report site filter); null when the account has none. */
    siteId?: string | null;
    departmentName: string; submittedAt: Date; ratees: CsiAnswerRatee[];
};
/** Ratees (enabled sections), their resolved views, dimensions, items and responses of one period. */
type PeriodData = {
    ratees: CsiPeriodRatee[]; views: Map<string, CsiRateeView>; dimensions: CsiPeriodRateeDimension[];
    items: CsiItemRow[]; responses: CsiResponse[];
};
/** Per-site stats of one period (dashboard): overall average, responses and each PERSON ratee's average. */
export type CsiSiteStats = {
    average: number | null; responses: number;
    /** Units behind `average` (HC: ratings, ICT: responses): weight when site averages are combined. */
    scoreWeight: number;
    people: Array<{ userId: string; displayName: string; photoUrl: string | null; average: number | null }>;
};
export type CsiReportComment = { text: string; departmentName: string; submittedAt: Date };
type ItemReaders = { items: Repository<CsiResponseItem>; comments: Repository<CsiResponseComment> };

const toScore = (item: CsiResponseItem): CsiAnswerScore => ({
    dimension: item.periodRateeDimension.dimensionName, type: item.periodRateeDimension.type ?? CsiQuestionType.STAR,
    score: item.score ?? null, answerLabel: item.answerLabel ?? null, answerText: item.answerText ?? null,
});

const siteSummaries = (period: CsiPeriod) =>
    (period.sites ?? []).map((row) => ({ id: row.siteId, code: row.site?.code ?? null, name: row.site?.name ?? null }))
        .sort((a, b) => (a.code ?? SORT_LAST).localeCompare(b.code ?? SORT_LAST));

type SiteScopeFilter = { rateeSites: Set<string>; respondentSites: Set<string>; slaSiteIds: Set<string> };

/**
 * Resolves effective site filters for report queries:
 * - HC stays strictly isolated (`rateeSite === siteId && responseSite === siteId`).
 * - For ICT, sites can delegate to a handler site (`SKD -> SPJ`):
 *   - Filtering by a handler site (e.g. SPJ) includes delegated sites' respondents & SLA in combined report mode.
 *   - Filtering by a delegated site (e.g. SKD) without its own ratees evaluates the handler site's subjects
 *     scored strictly by SKD respondents.
 */
function resolveSiteFilter(
    scope: ServiceScope,
    handlers: ReadonlyMap<string, string>,
    data: Pick<PeriodData, 'ratees' | 'views'>,
    siteId: string,
    includeDelegatedInHandler: boolean,
): SiteScopeFilter {
    if (scope !== ServiceScope.ICT) {
        return { rateeSites: new Set([siteId]), respondentSites: new Set([siteId]), slaSiteIds: new Set([siteId]) };
    }
    const handledBy = handlers.get(siteId);
    const hasOwnRatees = data.ratees.some((ratee) => rateeSiteOf(data, ratee) === siteId);
    if (handledBy && !hasOwnRatees) {
        return {
            rateeSites: new Set([siteId, handledBy]),
            respondentSites: new Set([siteId]),
            slaSiteIds: new Set([siteId]),
        };
    }
    const delegated = includeDelegatedInHandler
        ? [...handlers.entries()].filter(([, handler]) => handler === siteId).map(([child]) => child)
        : [];
    const combined = new Set([siteId, ...delegated]);
    return { rateeSites: combined, respondentSites: combined, slaSiteIds: combined };
}

/** A disabled section keeps its rows (re-enabling restores them) but never appears in reports, exports or the memo. */
const inEnabledSection = (period: CsiPeriod) => (ratee: CsiPeriodRatee) =>
    ratee.kind === CsiRateeKind.TEAM ? period.teamEnabled === true : period.individualEnabled !== false;

/** TEAM ratee first, then people in their stored order. */
const teamFirst = (ratees: CsiPeriodRatee[]) =>
    [...ratees].sort((a, b) => Number(b.kind === CsiRateeKind.TEAM) - Number(a.kind === CsiRateeKind.TEAM));

@Injectable()
export class CsiReportService {
    constructor(
        @InjectRepository(CsiPeriod) private readonly periods: Repository<CsiPeriod>,
        @InjectRepository(CsiPeriodRatee) private readonly ratees: Repository<CsiPeriodRatee>,
        @InjectRepository(CsiPeriodRateeDimension) private readonly rateeDimensions: Repository<CsiPeriodRateeDimension>,
        @InjectRepository(CsiPeriodRater) private readonly periodRaters: Repository<CsiPeriodRater>,
        @InjectRepository(CsiResponse) private readonly responses: Repository<CsiResponse>,
        @InjectRepository(CsiResponseItem) private readonly items: Repository<CsiResponseItem>,
        @InjectRepository(CsiResponseComment) private readonly comments: Repository<CsiResponseComment>,
        @InjectDataSource() private readonly dataSource: DataSource,
        private readonly audit: AuditService,
        private readonly sla: CsiSlaService,
        private readonly subjects: CsiSubjectService,
        private readonly assignments: CsiAssignmentService,
    ) { }

    private get readers(): ItemReaders {
        return { items: this.items, comments: this.comments };
    }

    /** `siteId` narrows ratees and respondent answers (with ICT delegated-site fallback like SKD -> SPJ). */
    async getReport(scope: ServiceScope, periodId: string, siteId?: string) {
        const period = await this.findInScope(scope, periodId, { sites: { site: true } });
        const allSites = siteSummaries(period);
        if (siteId && !allSites.some((site) => site.id === siteId)) throw new BadRequestException(SITE_NOT_IN_PERIOD_MESSAGE);
        const raw = await this.loadPeriodData(scope, period);
        const handlers = await this.siteHandlerMap(scope, period);
        const filter = siteId ? resolveSiteFilter(scope, handlers, raw, siteId, true) : null;
        const data = filter ? narrowToSites(raw, filter) : raw;
        const sites = filter ? allSites.filter((site) => filter.slaSiteIds.has(site.id)) : allSites;
        const comments = await this.rateeComments(data);
        return {
            period: { ...period, sites: allSites },
            scoreBands: bandsOf(period),
            overall: { average: overallScoreOf(scope, data).average, respondentCount: data.responses.length },
            previousAverage: await this.previousAverage(scope, period, siteId, handlers),
            ratees: teamFirst(data.ratees).map((ratee) => rateeStats(ratee, data.dimensions, data.items, {
                siteId: rateeSiteOf(data, ratee), photoUrl: data.views.get(ratee.id)?.photoUrl ?? null,
            })).map((row) => ({ ...row, comments: comments.get(row.periodRateeId) ?? [] })),
            sla: await this.sla.compute(period, sites, data.responses.length),
        };
    }

    /** Non-empty comments per ratee from the (site-narrowed) responses, newest first; department + date only, no name. */
    private async rateeComments(data: PeriodData): Promise<Map<string, CsiReportComment[]>> {
        const rateeIds = data.ratees.map((ratee) => ratee.id);
        if (!rateeIds.length || !data.responses.length) return new Map();
        const byResponse = new Map(data.responses.map((response) => [response.id, response]));
        const rows = await this.comments.find({ where: { periodRateeId: In(rateeIds) } });
        const result = new Map<string, CsiReportComment[]>();
        for (const row of rows) {
            const response = byResponse.get(row.responseId);
            const text = row.comment?.trim();
            if (!response || !text) continue;
            result.set(row.periodRateeId, [...(result.get(row.periodRateeId) ?? []),
                { text, departmentName: response.departmentName, submittedAt: response.submittedAt }]);
        }
        result.forEach((list, key) => result.set(key, [...list].sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime())));
        return result;
    }

    /** One load per period, then per-site stats in memory (each site keeps only its own respondents so counts sum to total). */
    async siteStats(scope: ServiceScope, period: CsiPeriod, siteIds: string[]): Promise<Map<string, CsiSiteStats>> {
        const [data, handlers] = await Promise.all([this.loadPeriodData(scope, period), this.siteHandlerMap(scope, period)]);
        return new Map(siteIds.map((siteId) => {
            const site = narrowToSites(data, resolveSiteFilter(scope, handlers, data, siteId, false));
            const people = site.ratees.filter((ratee) => ratee.kind !== CsiRateeKind.TEAM && ratee.userId).map((ratee) => ({
                userId: ratee.userId!, displayName: ratee.displayName, photoUrl: site.views.get(ratee.id)?.photoUrl ?? null,
                average: rateeStats(ratee, site.dimensions, site.items).average,
            }));
            return [siteId, { ...overallScoreOf(scope, site), responses: site.responses.length, people }];
        }));
    }

    /** Overall average of the latest earlier PUBLISHED period of the scope sharing a site (that site when filtered). */
    private async previousAverage(
        scope: ServiceScope,
        period: CsiPeriod,
        siteId?: string,
        handlers: ReadonlyMap<string, string> = new Map(),
    ): Promise<number | null> {
        const previous = await this.previousPeriod(scope, period, siteId, handlers);
        if (!previous) return null;
        const data = await this.loadPeriodData(scope, previous);
        if (!siteId) return overallScoreOf(scope, data).average;
        const filter = resolveSiteFilter(scope, handlers, data, siteId, true);
        return overallScoreOf(scope, narrowToSites(data, filter)).average;
    }

    private async previousPeriod(
        scope: ServiceScope,
        period: CsiPeriod,
        siteId?: string,
        handlers: ReadonlyMap<string, string> = new Map(),
    ): Promise<CsiPeriod | null> {
        const wanted = siteId
            ? [siteId, ...(scope === ServiceScope.ICT ? [...handlers.entries()].filter(([, handler]) => handler === siteId).map(([child]) => child) : [])]
            : (period.sites ?? []).map((row) => row.siteId);
        const candidates = await this.periods.find({
            where: { scope, publishStatus: CsiPeriodPublishStatus.PUBLISHED, endDate: LessThan(period.startDate) },
            relations: { sites: true },
        });
        // A simulation (fictitious answers) is never the previous period of another survey.
        return candidates
            .filter((row) => !isSimulation(row) && (row.sites ?? []).some((site) => wanted.includes(site.siteId)))
            .sort((a, b) => b.endDate.localeCompare(a.endDate))[0] ?? null;
    }

    /**
     * Executive report model (PDF + Excel): every parameter, nothing capped. Adds to the report the previous period per
     * subject, participation per site, anonymous participation per rater department (numbers only), the HC layanan
     * averages and every comment.
     */
    async getExecutiveModel(scope: ServiceScope, periodId: string, input: { siteId?: string; notes?: string; matrix: Awaited<ReturnType<CsiReportService['getRaterMatrix']>> }): Promise<CsiReportModel> {
        const { siteId, matrix } = input;
        const report = await this.getReport(scope, periodId, siteId);
        const period = await this.findInScope(scope, periodId, { sites: { site: true } });
        const raw = await this.loadPeriodData(scope, period);
        const handlers = await this.siteHandlerMap(scope, period);
        const filter = siteId ? resolveSiteFilter(scope, handlers, raw, siteId, true) : null;
        const sites = filter ? report.period.sites.filter((site) => filter.slaSiteIds.has(site.id)) : report.period.sites;
        const data = filter ? narrowToSites(raw, filter) : raw;
        // Previous period, per subject (master PIC, else people by name and teams by name + site).
        const previous = await this.previousPeriod(scope, period, siteId, handlers);
        let previousBySubject = new Map<string, number | null>();
        if (previous) {
            const rawBefore = await this.loadPeriodData(scope, previous);
            const before = siteId ? narrowToSites(rawBefore, resolveSiteFilter(scope, handlers, rawBefore, siteId, true)) : rawBefore;
            previousBySubject = previousSubjectMap(before.ratees.map((ratee) => ({
                kind: ratee.kind, siteId: rateeSiteOf(before, ratee), picId: ratee.picId ?? null,
                name: ratee.kind === CsiRateeKind.TEAM ? ratee.displayName || previous.teamLabel : ratee.displayName,
                average: rateeStats(ratee, before.dimensions, before.items).average,
            })));
        }
        // Participation per site (same SLA rules, one site at a time).
        const siteStats = await this.siteStats(scope, period, sites.map((site) => site.id));
        const siteBasis = [];
        const reporters: CsiSlaReporter[] = [];
        for (const site of sites) {
            const stats = siteStats.get(site.id);
            const sla = await this.sla.compute(period, [site], stats?.responses ?? 0);
            reporters.push(...sla.reporters);
            siteBasis.push({ siteId: site.id, basis: sla.basis, responses: stats?.responses ?? 0, average: stats?.average ?? null });
        }
        const comments = report.ratees.flatMap((ratee) => ratee.comments.map((comment) => ({
            periodRateeId: ratee.periodRateeId, text: comment.text, department: comment.departmentName, date: comment.submittedAt,
        })));
        // HC: the per-PIC recap with the same site filter, loaded once (layanan averages for the highlight + recap pages).
        const hcRecap = scope === ServiceScope.HC ? await this.executiveHcRecap(scope, periodId, siteId, previous?.id) : null;
        const model = buildReportModel({
            report, matrix, scopeLabel: scope, scope, previousBySubject, hasPrevious: !!previous, siteBasis, comments,
            raters: await this.basisRaters(reporters, data.responses),
            serviceAverages: (hcRecap?.services ?? []).filter((row) => row.level === 'service').map((row) => ({ serviceCode: row.serviceCode, average: row.all.average })),
            notes: input.notes ?? '', hcRecap,
            templateRatersWithoutAccount: scope === ServiceScope.HC ? await this.templateRatersWithoutAccount(scope, sites.map((site) => site.code)) : 0,
        });
        return { ...model, hcRecap: hcRecap?.services.some((row) => row.level === 'pic' && row.serviceCode) ? hcRecap : null };
    }

    /**
     * Participation per rater department without names (the report's Lampiran B), for the whole survey: the basis
     * raters of the given report's SLA (`report.sla.reporters`) against the period's answers.
     */
    async departmentParticipation(scope: ServiceScope, periodId: string, report: { sla: { reporters: CsiSlaReporter[]; targetPct: number } }): Promise<CsiDepartmentParticipation[]> {
        await this.findInScope(scope, periodId);
        const responses = await this.responses.find({ where: { periodId } });
        return departmentParticipation(await this.basisRaters(report.sla.reporters, responses), report.sla.targetPct);
    }

    /**
     * Raters of the location templates of the report sites (template code = site code) without a usable iDesk account:
     * they are outside the SLA basis, so page 1 / Ringkasan say how many.
     */
    private async templateRatersWithoutAccount(scope: ServiceScope, siteCodes: Array<string | null>): Promise<number> {
        const codes = siteCodes.filter((code): code is string => !!code);
        if (!codes.length) return 0;
        const templates = await this.dataSource.getRepository(CsiAssignmentTemplate).find({ where: { scope, locationCode: In(codes) }, select: { id: true } });
        if (!templates.length) return 0;
        const pics = await this.dataSource.getRepository(CsiAssignmentTemplatePic).find({ where: { templateId: In(templates.map((row) => row.id)) }, select: { id: true } });
        if (!pics.length) return 0;
        const raters = await this.dataSource.getRepository(CsiAssignmentTemplateRater).find({ where: { templatePicId: In(pics.map((row) => row.id)) } });
        if (!raters.length) return 0;
        const accounts = await this.dataSource.getRepository(User).find({ where: { isActive: true }, select: { id: true, fullName: true, employeeId: true } });
        return ratersWithoutAccount(raters, accounts.map((account) => ({ id: account.id, fullName: account.fullName, employeeId: account.employeeId ?? null })));
    }

    /**
     * Basis raters as department + answered, no names (report "Partisipasi per departemen"). Department as in
     * getRespondents' pendingByDepartment: the directory department of the NIK, else the account's department.
     */
    private async basisRaters(reporters: CsiSlaReporter[], responses: CsiResponse[]): Promise<Array<{ department: string | null; answered: boolean }>> {
        const unique = [...new Map(reporters.map((reporter) => [reporter.email.toLowerCase(), reporter])).values()];
        if (!unique.length) return [];
        const answered = new Set(responses.map((response) => response.respondentId));
        const users = await this.dataSource.getRepository(User).find({
            where: { email: In(unique.map((reporter) => reporter.email)) }, select: { id: true, email: true, employeeId: true },
        });
        const userOf = new Map(users.map((user) => [user.email.toLowerCase(), user]));
        const departmentOf = await this.directoryDepartments(users.map((user) => user.employeeId));
        return unique.map((reporter) => {
            const user = userOf.get(reporter.email.toLowerCase());
            const nik = normalizeNik(user?.employeeId);
            return { department: (nik ? departmentOf.get(nik) : undefined) ?? reporter.department, answered: !!user && answered.has(user.id) };
        });
    }

    /**
     * HC recap of the executive report (site filter as the rest of the report: respondents of that site only), with the
     * previous period's average per layanan / bagian / PIC (recapRowKey) when there is one.
     */
    private async executiveHcRecap(scope: ServiceScope, periodId: string, siteId?: string, previousId?: string): Promise<CsiHcRecap> {
        const { pics, ratings, dimensions } = await this.hcRecapInput(scope, periodId, siteId);
        const recap = buildHcRecap({ pics, ratings, dimensions, scope });
        if (!previousId) return recap;
        const before = buildHcRecap({ ...(await this.hcRecapInput(scope, previousId, siteId)), scope });
        return { ...recap, previous: recapAverages(before), previousOverall: before.overall.all.average };
    }

    /**
     * HC per-PIC recap: layanan / bagian / PIC and respondent division / department / bagian, each averaged per
     * location (SJA 1-4, Jakarta) and ALL SJA, plus every respondent's stars. Only scored answers count.
     */
    async getHcRecap(scope: ServiceScope, periodId: string): Promise<CsiHcRecap & { period: CsiHcPeriodRef; scoreBands: CsiScoreBands }> {
        const { period, scoreBands, pics, ratings, dimensions } = await this.hcRecapInput(scope, periodId);
        return { period, scoreBands, ...buildHcRecap({ pics, ratings, dimensions, scope }) };
    }

    /**
     * Period, PIC rows (with the viewer-relevant userId), scored ratings and dimension labels behind every HC recap.
     * `siteId` keeps only answers of respondents of that site (same rule as the report site filter).
     */
    async hcRecapInput(scope: ServiceScope, periodId: string, siteId?: string): Promise<CsiHcRecapInput> {
        const period = await this.findInScope(scope, periodId, { sites: { site: true } });
        const data = narrowResponsesToSite(await this.loadPeriodData(scope, period), siteId);
        const people = data.ratees.filter((ratee) => ratee.kind !== CsiRateeKind.TEAM);
        // HC custom teams are rated under a layanan like a PIC; ICT site teams keep their own report.
        const teams = scope === ServiceScope.HC ? data.ratees.filter((ratee) => ratee.kind === CsiRateeKind.TEAM && ratee.serviceCode) : [];
        const ids = new Set([...people, ...teams].map((ratee) => ratee.id));
        const labelOf = new Map(data.dimensions.map((row) => [row.id, row.shortLabel || row.dimensionName]));
        const scored = data.dimensions.filter((row) => ids.has(row.periodRateeId) && row.type !== CsiQuestionType.CHOICE && row.type !== CsiQuestionType.TEXT);
        const dimensions = [...new Set(scored.sort((a, b) => a.sortOrder - b.sortOrder).map((row) => labelOf.get(row.id)!))];
        const responses = new Map(data.responses.map((response) => [response.id, response]));
        const siteCodes = await this.siteCodes(data.responses.map((response) => response.respondent?.siteId).filter((id): id is string => !!id));
        const grouped = new Map<string, { responseId: string; periodRateeId: string; scores: Record<string, number> }>();
        for (const item of data.items) {
            if (!ids.has(item.periodRateeId) || item.score === null || item.score === undefined) continue;
            const key = `${item.responseId}:${item.periodRateeId}`;
            const entry = grouped.get(key) ?? { responseId: item.responseId, periodRateeId: item.periodRateeId, scores: {} };
            entry.scores[labelOf.get(item.periodRateeDimensionId) ?? '-'] = item.score;
            grouped.set(key, entry);
        }
        const ratings = [...grouped.values()].flatMap((entry) => {
            const response = responses.get(entry.responseId);
            if (!response) return [];
            const fallbackLocation = locationOfSiteCode(siteCodes.get(response.respondent?.siteId ?? '') ?? null);
            const [division, department] = response.orgDivision || response.orgDepartment
                ? [response.orgDivision, response.orgDepartment] : splitDepartment(response.departmentName);
            return [{
                ...entry, location: response.orgLocation ?? fallbackLocation,
                respondent: { name: response.respondentName, division, department, bagian: response.orgBagian ?? null },
            }];
        });
        // ICT has no bagian: its people are grouped by the site they serve.
        const rateeSites = scope === ServiceScope.ICT ? await this.siteCodes(people.map((ratee) => ratee.siteId).filter((id): id is string => !!id)) : new Map<string, string>();
        const pics: CsiHcPic[] = [
            ...people.map((ratee) => ({
                periodRateeId: ratee.id, name: ratee.displayName, jobTitle: ratee.jobTitle, serviceCode: ratee.serviceCode ?? null, picId: ratee.picId ?? null,
                bagian: ratee.bagian ?? (ratee.siteId ? rateeSites.get(ratee.siteId) ?? null : null), serviceFunction: ratee.serviceFunction ?? null,
            })),
            ...teams.map((ratee) => ({
                periodRateeId: ratee.id, name: ratee.displayName || period.teamLabel, jobTitle: null, serviceCode: ratee.serviceCode ?? null, picId: null,
                bagian: null, serviceFunction: ratee.serviceFunction ?? null, team: true,
            })),
        ];
        const linkedByPic = await this.linkedAccounts(people.map((ratee) => ratee.picId).filter((id): id is string => !!id));
        const membersByTeam = await this.teamMemberAccounts(teams.map((ratee) => ratee.teamId).filter((id): id is string => !!id));
        const pic = people.map((ratee): [string, string[]] => {
            const owner = ratedAccountOf(ratee, linkedByPic);
            return [ratee.id, owner ? [owner] : []];
        });
        const team = teams.map((ratee): [string, string[]] => [ratee.id, ratee.teamId ? membersByTeam.get(ratee.teamId) ?? [] : []]);
        return {
            period: { id: period.id, title: period.title, startDate: period.startDate, endDate: period.endDate },
            scoreBands: bandsOf(period), pics, ratings, dimensions, ownersOf: new Map([...pic, ...team]),
        };
    }

    /** Member accounts of each custom team now (a member is part of the rated team, like a PIC is their own row). */
    private async teamMemberAccounts(teamIds: string[]): Promise<Map<string, string[]>> {
        if (!teamIds.length) return new Map();
        const rows: Array<{ teamId: string; userId: string }> = await this.dataSource.query(
            'SELECT "teamId", "userId" FROM "csi_team_members" WHERE "teamId" = ANY($1) AND "userId" IS NOT NULL', [[...new Set(teamIds)]]);
        const result = new Map<string, string[]>();
        rows.forEach((row) => result.set(row.teamId, [...(result.get(row.teamId) ?? []), row.userId]));
        return result;
    }

    /** Account linked to each PIC now (a PIC may get its account after the survey was built). */
    private async linkedAccounts(picIds: string[]): Promise<Map<string, string | null>> {
        if (!picIds.length) return new Map();
        const rows: Array<{ id: string; userId: string | null }> = await this.dataSource.query(
            'SELECT "id", "userId" FROM "csi_pics" WHERE "id" = ANY($1)', [[...new Set(picIds)]]);
        return new Map(rows.map((row) => [row.id, row.userId]));
    }

    private async siteCodes(siteIds: string[]) {
        const unique = [...new Set(siteIds)];
        if (!unique.length) return new Map<string, string>();
        const rows: Array<{ id: string; code: string }> = await this.dataSource.query('SELECT "id", "code" FROM "sites" WHERE "id" = ANY($1)', [unique]);
        return new Map(rows.map((row) => [row.id, row.code]));
    }

    private async loadPeriodData(scope: ServiceScope, period: CsiPeriod): Promise<PeriodData> {
        const allRatees = (await this.ratees.find({ where: { periodId: period.id }, order: { sortOrder: 'ASC' } })).filter(inEnabledSection(period));
        const pairedRatees = period.pairMode === CsiPairMode.ALL || period.respondentPicks
            ? null
            : (await this.assignments.rateesWithPairs?.(period.id)) ?? null;
        const rawIds = allRatees.map((ratee) => ratee.id);
        const rawItems = rawIds.length ? await this.items.find({ where: { periodRateeId: In(rawIds) } }) : [];
        const answeredRatees = new Set(rawItems.map((item) => item.periodRateeId));
        const ratees = pairedRatees
            ? allRatees.filter((ratee) => pairedRatees.has(ratee.id) || answeredRatees.has(ratee.id))
            : allRatees;
        const rateeIds = ratees.map((ratee) => ratee.id);
        const rateeIdSet = new Set(rateeIds);
        const items = rawItems.filter((item) => rateeIdSet.has(item.periodRateeId));
        const [views, dimensions, responses] = await Promise.all([
            rateeIds.length ? this.subjects.viewsFor(scope, ratees) : new Map<string, CsiRateeView>(),
            rateeIds.length ? this.rateeDimensions.find({ where: { periodRateeId: In(rateeIds) }, relations: { dimension: true }, order: { sortOrder: 'ASC' } }) : [],
            this.responses.find({ where: { periodId: period.id }, relations: { respondent: true } }),
        ]);
        return { ratees, views, dimensions, items, responses };
    }

    private async siteHandlerMap(scope: ServiceScope, period: CsiPeriod): Promise<Map<string, string>> {
        if (scope !== ServiceScope.ICT) return new Map();
        const map = new Map<string, string>();
        (period.sites ?? []).forEach((row) => { if (row.site?.handledBySiteId) map.set(row.siteId, row.site.handledBySiteId); });
        const repo = this.dataSource.getRepository?.(Site);
        if (repo) {
            const rows = await repo.find({ where: { isActive: true }, select: { id: true, handledBySiteId: true } });
            rows.forEach((row) => { if (row.handledBySiteId) map.set(row.id, row.handledBySiteId); });
        }
        return map;
    }

    /**
     * "Siapa menilai siapa": every response × every subject of the (site-narrowed) report with the average given.
     * Respondent names are shown to scope admins only (this endpoint sits behind CsiAdminGuard); the PDF never uses it.
     */
    async getRaterMatrix(scope: ServiceScope, periodId: string, siteId?: string) {
        const report = await this.getReport(scope, periodId, siteId);
        const answers = await this.listAnswers(scope, periodId);
        const period = await this.findInScope(scope, periodId, { sites: { site: true } });
        const handlers = await this.siteHandlerMap(scope, period);
        const respondentSites = siteId
            ? resolveSiteFilter(scope, handlers, { ratees: report.ratees.map((ratee) => ({ id: ratee.periodRateeId, siteId: ratee.siteId }) as CsiPeriodRatee), views: new Map() }, siteId, true)
            : null;
        const subjects = report.ratees.map((ratee) => ({
            periodRateeId: ratee.periodRateeId, kind: ratee.kind, siteId: ratee.siteId,
            displayName: ratee.kind === CsiRateeKind.TEAM ? ratee.displayName || report.period.teamLabel : ratee.displayName,
        }));
        const subjectIds = new Set(subjects.map((subject) => subject.periodRateeId));
        // Same site rule as the report: only respondents whose effective site filter matches count.
        const relevant = answers.filter((answer) => (!respondentSites || (answer.siteId ? respondentSites.respondentSites.has(answer.siteId) : false))
            && answer.ratees.some((ratee) => subjectIds.has(ratee.periodRateeId)));
        return raterMatrix(subjects, relevant);
    }

    async getRespondents(scope: ServiceScope, periodId: string) {
        const period = await this.findInScope(scope, periodId, { sites: true });
        const responses = await this.responses.find({ where: { periodId }, relations: { respondent: true }, order: { submittedAt: 'ASC' } });
        const submitted = responses.map((response) => ({
            responseId: response.id, userId: response.respondentId, respondentName: response.respondentName, accountName: response.respondent.fullName,
            departmentName: response.departmentName, siteId: response.respondent.siteId ?? null, submittedAt: response.submittedAt,
        }));
        let pending: Array<{ userId: string; fullName: string; department: string | null; siteId: string | null }> | null = null;
        let byDepartment: CsiPendingDepartment[] | null = null;
        if (period.respondentMode === CsiRespondentMode.LISTED) {
            const answered = new Set(responses.map((response) => response.respondentId));
            const raters = await this.periodRaters.find({ where: { periodId }, relations: { user: { department: true } } });
            // Same audience as the SLA basis: raters who cannot open the survey (other site, inactive, no pairs in a
            // mapped period) are not pending.
            const paired = await this.assignments.ratersWithPairs(periodId);
            const siteIds = (period.sites ?? []).map((row) => row.siteId);
            const expected = raters.filter((rater) => isRaterInAudience(rater, siteIds, paired));
            const audience = expected.filter((rater) => !answered.has(rater.userId));
            const departmentOf = await this.directoryDepartments(expected.map((rater) => rater.user.employeeId));
            const deptOf = (rater: CsiPeriodRater) => {
                const nik = normalizeNik(rater.user.employeeId);
                return (nik ? departmentOf.get(nik) : undefined) ?? rater.user.department?.name ?? null;
            };
            byDepartment = pendingByDepartment(expected.map((rater) => ({
                department: deptOf(rater), answered: answered.has(rater.userId),
            })));
            pending = sortBy(audience, (rater) => rater.user.fullName)
                .map((rater) => ({
                    userId: rater.userId, fullName: rater.user.fullName,
                    department: deptOf(rater), siteId: rater.user.siteId ?? null,
                }));
        }
        return {
            mode: period.respondentMode, submitted, pending, pendingByDepartment: byDepartment,
            totals: { submitted: submitted.length, pending: pending ? pending.length : null },
        };
    }

    /** Directory department (csi_org_people) per normalized NIK; accounts without a directory row fall back to their own department. */
    private async directoryDepartments(niks: Array<string | null | undefined>) {
        const unique = [...new Set(niks.map((nik) => normalizeNik(nik)).filter((nik): nik is string => !!nik))];
        if (!unique.length) return new Map<string, string>();
        const rows: Array<{ nik: string; department: string | null }> = await this.dataSource.query(
            'SELECT "nik", "department" FROM "csi_org_people" WHERE "nik" = ANY($1)', [unique]);
        return new Map(rows.filter((row) => row.department).map((row) => [row.nik, row.department!]));
    }

    async getResponseDetail(scope: ServiceScope, periodId: string, responseId: string): Promise<CsiAnswer> {
        await this.findInScope(scope, periodId);
        const response = await this.responses.findOne({ where: { id: responseId, periodId }, relations: { respondent: { site: true } } });
        if (!response) throw new NotFoundException(RESPONSE_NOT_FOUND_MESSAGE);
        const [answer] = await this.buildAnswers(this.readers, [response]);
        return answer;
    }

    /** Every response of the period with its answers and comments, in submit order (used by the Excel export). */
    async listAnswers(scope: ServiceScope, periodId: string): Promise<CsiAnswer[]> {
        await this.findInScope(scope, periodId);
        const responses = await this.responses.find({ where: { periodId }, relations: { respondent: { site: true } }, order: { submittedAt: 'ASC' } });
        return this.buildAnswers(this.readers, responses);
    }

    async resetResponse(scope: ServiceScope, periodId: string, responseId: string, reason: string, actor: CsiActorRef, req?: Request) {
        const trimmed = typeof reason === 'string' ? reason.trim() : '';
        if (trimmed.length < CSI_RESET_REASON_MIN) {
            throw new BadRequestException(`Alasan reset minimal ${CSI_RESET_REASON_MIN} karakter`);
        }
        await this.findInScope(scope, periodId);
        const snapshot = await this.dataSource.transaction(async (manager) => {
            // Same row lock as admin edits: a reset never interleaves with ratee/rater changes or other resets.
            if (!(await lockPeriodRow(manager, periodId))) throw new NotFoundException('Periode tidak ditemukan');
            const response = await manager.getRepository(CsiResponse).findOne({ where: { id: responseId, periodId }, relations: { respondent: true } });
            if (!response) throw new NotFoundException(RESPONSE_NOT_FOUND_MESSAGE);
            const readers = { items: manager.getRepository(CsiResponseItem), comments: manager.getRepository(CsiResponseComment) };
            const [answer] = await this.buildAnswers(readers, [response]);
            await manager.delete(CsiResponse, { id: responseId });
            return { response, answer };
        });
        const { response, answer } = snapshot;
        await this.audit.log({
            userId: actor.id, action: AuditAction.CSI_RESPONSE_RESET, entityType: RESET_ENTITY_TYPE, entityId: responseId,
            oldValue: {
                periodId, respondentId: response.respondentId, respondentName: answer.respondentName,
                departmentName: answer.departmentName, submittedAt: answer.submittedAt,
                scores: answer.ratees.flatMap((ratee) => ratee.scores.map(({ dimension, score, answerLabel, answerText }) =>
                    ({ ratee: ratee.displayName, dimension, score, answerLabel, answerText }))),
            },
            description: `Reset jawaban CSI ${answer.respondentName}. Alasan: ${trimmed}`,
            request: req,
        });
        return { reset: true as const };
    }

    private async findInScope(scope: ServiceScope, periodId: string, relations?: FindOptionsRelations<CsiPeriod>) {
        return assertPeriodInScope(await this.periods.findOne({ where: { id: periodId }, ...(relations ? { relations } : {}) }), scope);
    }

    /** Groups each response's items by ratee (ratee and dimension sortOrder) and attaches the comment per ratee. */
    private async buildAnswers(readers: ItemReaders, responses: CsiResponse[]): Promise<CsiAnswer[]> {
        if (!responses.length) return [];
        const responseIds = responses.map((response) => response.id);
        const [items, comments] = await Promise.all([
            readers.items.find({ where: { responseId: In(responseIds) }, relations: { periodRatee: true, periodRateeDimension: true } }),
            readers.comments.find({ where: { responseId: In(responseIds) } }),
        ]);
        const commentOf = new Map(comments.map((row) => [`${row.responseId}:${row.periodRateeId}`, row.comment]));
        return responses.map((response) => {
            const own = sortBy(
                items.filter((item) => item.responseId === response.id),
                (item) => item.periodRatee.sortOrder * RATEE_ORDER_FACTOR + item.periodRateeDimension.sortOrder,
            );
            const ratees = new Map<string, CsiAnswerRatee>();
            for (const item of own) {
                const entry = ratees.get(item.periodRateeId) ?? {
                    periodRateeId: item.periodRateeId, kind: item.periodRatee.kind ?? CsiRateeKind.PERSON,
                    displayName: item.periodRatee.displayName, jobTitle: item.periodRatee.jobTitle,
                    comment: commentOf.get(`${response.id}:${item.periodRateeId}`) ?? null, scores: [],
                };
                ratees.set(item.periodRateeId, { ...entry, scores: [...entry.scores, toScore(item)] });
            }
            return {
                responseId: response.id, respondentName: response.respondentName, accountName: response.respondent.fullName,
                areaName: response.respondent.site?.name ?? null, siteId: response.respondent.siteId ?? null, departmentName: response.departmentName,
                submittedAt: response.submittedAt, ratees: [...ratees.values()],
            };
        });
    }
}

/** Subjects of the HC per-PIC recap: PICs (people) and custom teams rated under a layanan. */
const isHcRecapSubject = (ratee: CsiPeriodRatee) => ratee.kind !== CsiRateeKind.TEAM || !!ratee.serviceCode;

/**
 * Overall average of a (site-narrowed) period and its weight. HC: per rating (1 respondent × 1 PIC), the same basis as
 * the recap, PDF page 1, Excel and dashboard. ICT: mean of the response averages, weighted by responses.
 */
function overallScoreOf(scope: ServiceScope, data: PeriodData): { average: number | null; scoreWeight: number } {
    if (scope !== ServiceScope.HC) return { average: overallStats(data.items, data.responses.length).average, scoreWeight: data.responses.length };
    const ids = new Set(data.ratees.filter(isHcRecapSubject).map((ratee) => ratee.id));
    const { average, ratings } = ratingAverage(data.items.filter((item) => ids.has(item.periodRateeId)));
    return { average, scoreWeight: ratings };
}

const rateeSiteOf = (data: Pick<PeriodData, 'views'>, ratee: CsiPeriodRatee) => data.views.get(ratee.id)?.siteId ?? ratee.siteId ?? null;

/** Site filter: ratees matching `filter.rateeSites` and responses (with items) matching `filter.respondentSites`. */
function narrowToSites(data: PeriodData, filter: SiteScopeFilter): PeriodData {
    const ratees = data.ratees.filter((ratee) => {
        const site = rateeSiteOf(data, ratee);
        return !!site && filter.rateeSites.has(site);
    });
    const responseSite = new Map(data.responses.map((response) => [response.id, response.respondent?.siteId ?? null]));
    const rateeSite = new Map(ratees.map((ratee) => [ratee.id, rateeSiteOf(data, ratee)]));
    return {
        ...data, ratees,
        items: itemsForSite(data.items, rateeSite, responseSite, filter.rateeSites, filter.respondentSites),
        responses: data.responses.filter((response) => {
            const site = responseSite.get(response.id);
            return !!site && filter.respondentSites.has(site);
        }),
    };
}

/** HC recap site filter: keeps every ratee rated by that site's respondents, narrowing answers by respondent site. */
function narrowResponsesToSite(data: PeriodData, siteId?: string): PeriodData {
    if (!siteId) return data;
    const responses = data.responses.filter((response) => response.respondent?.siteId === siteId);
    const responseIds = new Set(responses.map((response) => response.id));
    return { ...data, responses, items: data.items.filter((item) => responseIds.has(item.responseId)) };
}

/** Older answers carry only "DIVISION / DEPARTMENT". */
function splitDepartment(name: string): [string | null, string | null] {
    const at = (name ?? '').indexOf(' / ');
    return at >= 0 ? [name.slice(0, at), name.slice(at + 3)] : [null, name || null];
}

/** Sorted copy; strings compare with Indonesian collation. */
function sortBy<T>(rows: T[], key: (row: T) => number | string): T[] {
    return [...rows].sort((a, b) => {
        const left = key(a);
        const right = key(b);
        if (typeof left === 'string' && typeof right === 'string') return left.localeCompare(right, 'id');
        return left < right ? -1 : left > right ? 1 : 0;
    });
}
