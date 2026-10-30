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
import { CsiSlaService } from './csi-sla.service';
import { CsiRateeView, CsiSubjectService } from './csi-subject.service';

const RESPONSE_NOT_FOUND_MESSAGE = 'Jawaban tidak ditemukan';
const RESET_ENTITY_TYPE = 'csi_response';
const SORT_LAST = '￿';
const RATEE_ORDER_FACTOR = 1e6;
const SITE_NOT_IN_PERIOD_MESSAGE = 'Site tidak termasuk dalam periode ini';

export type CsiActorRef = { id: string };
/** `score` is null for CHOICE/TEXT answers; `answerLabel` (SCALE/CHOICE) and `answerText` (TEXT) carry the non-numeric answer. */
export type CsiAnswerScore = {
    dimension: string; type: CsiQuestionType; score: number | null; answerLabel: string | null; answerText: string | null;
};
export type CsiAnswerRatee = {
    periodRateeId: string; kind: CsiRateeKind; displayName: string; jobTitle: string | null; comment: string | null; scores: CsiAnswerScore[];
};
export type CsiAnswer = {
    responseId: string; respondentName: string; accountName: string; areaName: string | null;
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
        const wanted = siteId ? [siteId] : (period.sites ?? []).map((row) => row.siteId);
        const candidates = await this.periods.find({
            where: { scope, publishStatus: CsiPeriodPublishStatus.PUBLISHED, endDate: LessThan(period.startDate) },
            relations: { sites: true },
        });
        const previous = candidates
            .filter((row) => (row.sites ?? []).some((site) => wanted.includes(site.siteId)))
            .sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
        if (!previous) return null;
        const data = narrowToSite(await this.loadPeriodData(scope, previous), siteId);
        return overallStats(data.items, data.responses.length).average;
    }

    private async loadPeriodData(scope: ServiceScope, period: CsiPeriod): Promise<PeriodData> {
        const ratees = (await this.ratees.find({ where: { periodId: period.id }, order: { sortOrder: 'ASC' } })).filter(inEnabledSection(period));
        const rateeIds = ratees.map((ratee) => ratee.id);
        const [views, dimensions, items, responses] = await Promise.all([
            rateeIds.length ? this.subjects.viewsFor(scope, ratees) : new Map<string, CsiRateeView>(),
            rateeIds.length ? this.rateeDimensions.find({ where: { periodRateeId: In(rateeIds) }, order: { sortOrder: 'ASC' } }) : [],
            rateeIds.length ? this.items.find({ where: { periodRateeId: In(rateeIds) } }) : [],
            this.responses.find({ where: { periodId: period.id }, relations: { respondent: true } }),
        ]);
        return { ratees, views, dimensions, items, responses };
    }

    async getRespondents(scope: ServiceScope, periodId: string) {
        const period = await this.findInScope(scope, periodId);
        const responses = await this.responses.find({ where: { periodId }, relations: { respondent: true }, order: { submittedAt: 'ASC' } });
        const submitted = responses.map((response) => ({
            responseId: response.id, userId: response.respondentId, respondentName: response.respondentName, accountName: response.respondent.fullName,
            departmentName: response.departmentName, siteId: response.respondent.siteId ?? null, submittedAt: response.submittedAt,
        }));
        let pending: Array<{ userId: string; fullName: string; department: string | null; siteId: string | null }> | null = null;
        if (period.respondentMode === CsiRespondentMode.LISTED) {
            const answered = new Set(responses.map((response) => response.respondentId));
            const raters = await this.periodRaters.find({ where: { periodId }, relations: { user: { department: true } } });
            pending = sortBy(raters.filter((rater) => !answered.has(rater.userId)), (rater) => rater.user.fullName)
                .map((rater) => ({
                    userId: rater.userId, fullName: rater.user.fullName,
                    department: rater.user.department?.name ?? null, siteId: rater.user.siteId ?? null,
                }));
        }
        return {
            mode: period.respondentMode, submitted, pending,
            totals: { submitted: submitted.length, pending: pending ? pending.length : null },
        };
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
                areaName: response.respondent.site?.name ?? null, departmentName: response.departmentName,
                submittedAt: response.submittedAt, ratees: [...ratees.values()],
            };
        });
    }
}

const rateeSiteOf = (data: Pick<PeriodData, 'views'>, ratee: CsiPeriodRatee) => data.views.get(ratee.id)?.siteId ?? ratee.siteId ?? null;

/** Site filter: ratees of the site, and only responses (and their items) of respondents whose user site is the site. */
function narrowToSite(data: PeriodData, siteId?: string): PeriodData {
    if (!siteId) return data;
    const ratees = data.ratees.filter((ratee) => rateeSiteOf(data, ratee) === siteId);
    const responseSite = new Map(data.responses.map((response) => [response.id, response.respondent?.siteId ?? null]));
    const rateeSite = new Map(ratees.map((ratee) => [ratee.id, rateeSiteOf(data, ratee)]));
    return {
        ...data, ratees,
        items: itemsForSite(data.items, rateeSite, responseSite, siteId),
        responses: data.responses.filter((response) => responseSite.get(response.id) === siteId),
    };
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
