import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Request } from 'express';
import { DataSource, FindOptionsRelations, In, LessThan, Repository } from 'typeorm';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { AuditService } from '../../audit/audit.service';
import { AuditAction } from '../../audit/entities/audit-log.entity';
import { CSI_RESET_REASON_MIN, CsiPeriodPublishStatus, CsiQuestionType, CsiRateeKind, CsiRespondentMode } from '../csi.constants';
import { CsiPeriodRateeDimension } from '../entities/csi-period-ratee-dimension.entity';
import { CsiPeriodRatee } from '../entities/csi-period-ratee.entity';
import { CsiPeriodRater } from '../entities/csi-period-rater.entity';
import { CsiPeriod } from '../entities/csi-period.entity';
import { CsiResponseComment } from '../entities/csi-response-comment.entity';
import { CsiResponseItem } from '../entities/csi-response-item.entity';
import { CsiResponse } from '../entities/csi-response.entity';
import { lockPeriodRow } from './csi-period-lock.util';
import { CsiItemRow, itemsForSite, overallStats, rateeStats } from './csi-report.calc';
import { assertPeriodInScope } from './csi-scope.util';
import { CsiAssignmentService } from './csi-assignment.service';
import { raterMatrix } from './csi-rater-matrix.calc';
import { CsiSlaService } from './csi-sla.service';
import { CsiDepartment } from '../entities/csi-department.entity';
import { User } from '../../users/entities/user.entity';
import { buildReportModel, CsiReportModel, subjectKeyOf } from './csi-report-model';
import { CsiRateeView, CsiSubjectService } from './csi-subject.service';
import { buildHcRecap, CsiHcPic, CsiHcRating, CsiHcRecap } from '../org/csi-hc-report.calc';
import { locationOfSiteCode } from '../org/csi-org.constants';
import { CsiPendingDepartment, pendingByDepartment } from '../org/csi-service-report.calc';
import { ratedAccountOf } from './csi-ratee-owner.util';

const RESPONSE_NOT_FOUND_MESSAGE = 'Jawaban tidak ditemukan';
const RESET_ENTITY_TYPE = 'csi_response';
const SORT_LAST = '￿';
const RATEE_ORDER_FACTOR = 1e6;
const SITE_NOT_IN_PERIOD_MESSAGE = 'Site tidak termasuk dalam periode ini';

export type CsiActorRef = { id: string };
export type CsiHcPeriodRef = { id: string; title: string; startDate: string; endDate: string };
export type CsiHcRecapInput = {
    period: CsiHcPeriodRef; pics: CsiHcPic[]; ratings: CsiHcRating[]; dimensions: string[];
    /** Account behind each PIC row (null when the PIC has no iDesk account). */
    userIdOf: Map<string, string | null>;
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

    /** `siteId` narrows ratees to that site and counts only answers of respondents whose user site is that site. */
    async getReport(scope: ServiceScope, periodId: string, siteId?: string) {
        const period = await this.findInScope(scope, periodId, { sites: { site: true } });
        const allSites = siteSummaries(period);
        if (siteId && !allSites.some((site) => site.id === siteId)) throw new BadRequestException(SITE_NOT_IN_PERIOD_MESSAGE);
        const data = narrowToSite(await this.loadPeriodData(scope, period), siteId);
        const sites = siteId ? allSites.filter((site) => site.id === siteId) : allSites;
        const comments = await this.rateeComments(data);
        return {
            period: { ...period, sites: allSites },
            overall: overallStats(data.items, data.responses.length),
            previousAverage: await this.previousAverage(scope, period, siteId),
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

    /** One load per period, then per-site stats in memory (same site rules as the filtered report). */
    async siteStats(scope: ServiceScope, period: CsiPeriod, siteIds: string[]): Promise<Map<string, CsiSiteStats>> {
        const data = await this.loadPeriodData(scope, period);
        return new Map(siteIds.map((siteId) => {
            const site = narrowToSite(data, siteId);
            const people = site.ratees.filter((ratee) => ratee.kind !== CsiRateeKind.TEAM && ratee.userId).map((ratee) => ({
                userId: ratee.userId!, displayName: ratee.displayName, photoUrl: site.views.get(ratee.id)?.photoUrl ?? null,
                average: rateeStats(ratee, site.dimensions, site.items).average,
            }));
            return [siteId, { average: overallStats(site.items, site.responses.length).average, responses: site.responses.length, people }];
        }));
    }

    /** Overall average of the latest earlier PUBLISHED period of the scope sharing a site (that site when filtered). */
    private async previousAverage(scope: ServiceScope, period: CsiPeriod, siteId?: string): Promise<number | null> {
        const previous = await this.previousPeriod(scope, period, siteId);
        if (!previous) return null;
        const data = narrowToSite(await this.loadPeriodData(scope, previous), siteId);
        return overallStats(data.items, data.responses.length).average;
    }

    private async previousPeriod(scope: ServiceScope, period: CsiPeriod, siteId?: string): Promise<CsiPeriod | null> {
        const wanted = siteId ? [siteId] : (period.sites ?? []).map((row) => row.siteId);
        const candidates = await this.periods.find({
            where: { scope, publishStatus: CsiPeriodPublishStatus.PUBLISHED, endDate: LessThan(period.startDate) },
            relations: { sites: true },
        });
        return candidates
            .filter((row) => (row.sites ?? []).some((site) => wanted.includes(site.siteId)))
            .sort((a, b) => b.endDate.localeCompare(a.endDate))[0] ?? null;
    }

    /**
     * Executive report model (PDF + Excel): every parameter, nothing capped. Adds to the report the previous period per
     * subject, participation per site with its basis people (answered or not), every active department (also 0 answers)
     * and every comment.
     */
    async getExecutiveModel(scope: ServiceScope, periodId: string, input: { siteId?: string; notes?: string; matrix: Awaited<ReturnType<CsiReportService['getRaterMatrix']>> }): Promise<CsiReportModel> {
        const { siteId, matrix } = input;
        const report = await this.getReport(scope, periodId, siteId);
        const period = await this.findInScope(scope, periodId, { sites: { site: true } });
        const sites = siteId ? report.period.sites.filter((site) => site.id === siteId) : report.period.sites;
        const data = narrowToSite(await this.loadPeriodData(scope, period), siteId);
        // Previous period, per subject (people by name, teams by name + site).
        const previousBySubject = new Map<string, number | null>();
        const previous = await this.previousPeriod(scope, period, siteId);
        if (previous) {
            const before = narrowToSite(await this.loadPeriodData(scope, previous), siteId);
            before.ratees.forEach((ratee) => {
                const stats = rateeStats(ratee, before.dimensions, before.items);
                const name = ratee.kind === CsiRateeKind.TEAM ? ratee.displayName || previous.teamLabel : ratee.displayName;
                previousBySubject.set(subjectKeyOf({ kind: ratee.kind, siteId: rateeSiteOf(before, ratee) }, name), stats.average);
            });
        }
        // Participation per site (same SLA rules, one site at a time).
        const siteStats = await this.siteStats(scope, period, sites.map((site) => site.id));
        const siteBasis = [];
        for (const site of sites) {
            const stats = siteStats.get(site.id);
            const sla = await this.sla.compute(period, [site], stats?.responses ?? 0);
            siteBasis.push({ siteId: site.id, reporters: sla.reporters, responses: stats?.responses ?? 0, average: stats?.average ?? null });
        }
        const answeredUserIds = new Set(data.responses.map((response) => response.respondentId));
        const reporterUserIds = new Map(data.responses.map((response) => [(response.respondent?.email ?? '').toLowerCase(), response.respondentId]));
        const basisEmails = siteBasis.flatMap((row) => row.reporters.map((reporter) => reporter.email.toLowerCase()));
        if (basisEmails.length) {
            const users = await this.dataSource.getRepository(User).find({ where: { email: In([...new Set(basisEmails)]) }, select: { id: true, email: true } });
            users.forEach((user) => reporterUserIds.set(user.email.toLowerCase(), user.id));
        }
        // Every active department of the scope, including the ones without any answer.
        const departmentRows = await this.dataSource.getRepository(CsiDepartment).find({ where: { scope, isActive: true }, order: { sortOrder: 'ASC', name: 'ASC' } });
        const counts = new Map<string, number>();
        data.responses.forEach((response) => counts.set(response.departmentName, (counts.get(response.departmentName) ?? 0) + 1));
        const names = new Set([...departmentRows.map((row) => row.name), ...counts.keys()]);
        const departments = [...names].map((name) => ({ name, responses: counts.get(name) ?? 0 }));
        const comments = report.ratees.flatMap((ratee) => ratee.comments.map((comment) => ({
            periodRateeId: ratee.periodRateeId, text: comment.text, department: comment.departmentName, date: comment.submittedAt,
        })));
        return buildReportModel({
            report, matrix, scopeLabel: scope, previousBySubject, siteBasis, answeredUserIds, reporterUserIds, departments, comments,
            notes: input.notes ?? '',
        });
    }

    /**
     * HC per-PIC recap: layanan / bagian / PIC and respondent division / department / bagian, each averaged per
     * location (SJA 1-4, Jakarta) and ALL SJA, plus every respondent's stars. Only scored answers count.
     */
    async getHcRecap(scope: ServiceScope, periodId: string): Promise<CsiHcRecap & { period: CsiHcPeriodRef }> {
        const { period, pics, ratings, dimensions } = await this.hcRecapInput(scope, periodId);
        return { period, ...buildHcRecap({ pics, ratings, dimensions, scope }) };
    }

    /** Period, PIC rows (with the viewer-relevant userId), scored ratings and dimension labels behind every HC recap. */
    async hcRecapInput(scope: ServiceScope, periodId: string): Promise<CsiHcRecapInput> {
        const period = await this.findInScope(scope, periodId, { sites: { site: true } });
        const data = await this.loadPeriodData(scope, period);
        const people = data.ratees.filter((ratee) => ratee.kind !== CsiRateeKind.TEAM);
        const ids = new Set(people.map((ratee) => ratee.id));
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
        const pics = people.map((ratee) => ({
            periodRateeId: ratee.id, name: ratee.displayName, jobTitle: ratee.jobTitle, serviceCode: ratee.serviceCode ?? null,
            bagian: ratee.bagian ?? (ratee.siteId ? rateeSites.get(ratee.siteId) ?? null : null), serviceFunction: ratee.serviceFunction ?? null,
        }));
        const linkedByPic = await this.linkedAccounts(people.map((ratee) => ratee.picId).filter((id): id is string => !!id));
        return {
            period: { id: period.id, title: period.title, startDate: period.startDate, endDate: period.endDate },
            pics, ratings, dimensions, userIdOf: new Map(people.map((ratee) => [ratee.id, ratedAccountOf(ratee, linkedByPic)])),
        };
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
        const ratees = (await this.ratees.find({ where: { periodId: period.id }, order: { sortOrder: 'ASC' } })).filter(inEnabledSection(period));
        const rateeIds = ratees.map((ratee) => ratee.id);
        const [views, dimensions, items, responses] = await Promise.all([
            rateeIds.length ? this.subjects.viewsFor(scope, ratees) : new Map<string, CsiRateeView>(),
            rateeIds.length ? this.rateeDimensions.find({ where: { periodRateeId: In(rateeIds) }, relations: { dimension: true }, order: { sortOrder: 'ASC' } }) : [],
            rateeIds.length ? this.items.find({ where: { periodRateeId: In(rateeIds) } }) : [],
            this.responses.find({ where: { periodId: period.id }, relations: { respondent: true } }),
        ]);
        return { ratees, views, dimensions, items, responses };
    }

    /**
     * "Siapa menilai siapa": every response × every subject of the (site-narrowed) report with the average given.
     * Respondent names are shown to scope admins only (this endpoint sits behind CsiAdminGuard); the PDF never uses it.
     */
    async getRaterMatrix(scope: ServiceScope, periodId: string, siteId?: string) {
        const report = await this.getReport(scope, periodId, siteId);
        const answers = await this.listAnswers(scope, periodId);
        const subjects = report.ratees.map((ratee) => ({
            periodRateeId: ratee.periodRateeId, kind: ratee.kind, siteId: ratee.siteId,
            displayName: ratee.kind === CsiRateeKind.TEAM ? ratee.displayName || report.period.teamLabel : ratee.displayName,
        }));
        const subjectIds = new Set(subjects.map((subject) => subject.periodRateeId));
        // Same site rule as the report: with a site filter, only respondents of that site count (see narrowToSite).
        const relevant = answers.filter((answer) => (!siteId || answer.siteId === siteId)
            && answer.ratees.some((ratee) => subjectIds.has(ratee.periodRateeId)));
        return raterMatrix(subjects, relevant);
    }

    async getRespondents(scope: ServiceScope, periodId: string) {
        const period = await this.findInScope(scope, periodId);
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
            // In a mapped period a rater without pairs cannot see the survey, so they are not pending.
            const paired = await this.assignments.ratersWithPairs(periodId);
            const expected = raters.filter((rater) => !paired || paired.has(rater.id));
            const audience = expected.filter((rater) => !answered.has(rater.userId));
            const departmentOf = await this.directoryDepartments(expected.map((rater) => rater.user.employeeId));
            byDepartment = pendingByDepartment(expected.map((rater) => ({
                department: departmentOf.get(rater.user.employeeId ?? '') ?? rater.user.department?.name ?? null, answered: answered.has(rater.userId),
            })));
            pending = sortBy(audience, (rater) => rater.user.fullName)
                .map((rater) => ({
                    userId: rater.userId, fullName: rater.user.fullName,
                    department: rater.user.department?.name ?? null, siteId: rater.user.siteId ?? null,
                }));
        }
        return {
            mode: period.respondentMode, submitted, pending, pendingByDepartment: byDepartment,
            totals: { submitted: submitted.length, pending: pending ? pending.length : null },
        };
    }

    /** Directory department (csi_org_people) per NIK; accounts without a directory row fall back to their own department. */
    private async directoryDepartments(niks: Array<string | null | undefined>) {
        const unique = [...new Set(niks.filter((nik): nik is string => !!nik))];
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

const rateeSiteOf = (data: Pick<PeriodData, 'views'>, ratee: CsiPeriodRatee) => data.views.get(ratee.id)?.siteId ?? ratee.siteId ?? null;

/** Site filter: ratees of the site, and only responses (and their items) of respondents whose user site is the site. */
function narrowToSite(data: PeriodData, siteId?: string): PeriodData {
    if (!siteId) return data;
    // HC PICs serve every site from head office: only the respondent's site decides (they stay in every site view).
    const siteOfRatee = (ratee: CsiPeriodRatee) => (ratee.picId ? siteId : rateeSiteOf(data, ratee));
    const ratees = data.ratees.filter((ratee) => siteOfRatee(ratee) === siteId);
    const responseSite = new Map(data.responses.map((response) => [response.id, response.respondent?.siteId ?? null]));
    const rateeSite = new Map(ratees.map((ratee) => [ratee.id, siteOfRatee(ratee)]));
    return {
        ...data, ratees,
        items: itemsForSite(data.items, rateeSite, responseSite, siteId),
        responses: data.responses.filter((response) => responseSite.get(response.id) === siteId),
    };
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
