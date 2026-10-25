import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Request } from 'express';
import { DataSource, In, Repository } from 'typeorm';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { AuditService } from '../../audit/audit.service';
import { AuditAction } from '../../audit/entities/audit-log.entity';
import { CSI_RESET_REASON_MIN, CSI_SCORE_MAX, CsiRespondentMode } from '../csi.constants';
import { CsiPeriodRateeDimension } from '../entities/csi-period-ratee-dimension.entity';
import { CsiPeriodRatee } from '../entities/csi-period-ratee.entity';
import { CsiPeriodRater } from '../entities/csi-period-rater.entity';
import { CsiPeriod } from '../entities/csi-period.entity';
import { CsiResponseComment } from '../entities/csi-response-comment.entity';
import { CsiResponseItem } from '../entities/csi-response-item.entity';
import { CsiResponse } from '../entities/csi-response.entity';
import { lockPeriodRow } from './csi-period.service';
import { assertPeriodInScope } from './csi-scope.util';

const RESPONSE_NOT_FOUND_MESSAGE = 'Jawaban tidak ditemukan';
const RESET_ENTITY_TYPE = 'csi_response';
const PERCENT = 100;

export type CsiActorRef = { id: string };
export type CsiAnswerScore = { dimension: string; score: number };
export type CsiAnswerRatee = { periodRateeId: string; displayName: string; jobTitle: string | null; comment: string | null; scores: CsiAnswerScore[] };
export type CsiAnswer = { responseId: string; fullName: string; departmentName: string; submittedAt: Date; ratees: CsiAnswerRatee[] };
type ItemReaders = { items: Repository<CsiResponseItem>; comments: Repository<CsiResponseComment> };

const round = (value: number, decimals: number) => {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
};
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

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
    ) { }

    private get readers(): ItemReaders {
        return { items: this.items, comments: this.comments };
    }

    async getReport(scope: ServiceScope, periodId: string) {
        const period = await this.findInScope(scope, periodId);
        const ratees = await this.ratees.find({ where: { periodId }, order: { sortOrder: 'ASC' } });
        const rateeIds = ratees.map((ratee) => ratee.id);
        const [dimensions, scoreStats, respondentCounts] = rateeIds.length
            ? await Promise.all([
                this.rateeDimensions.find({ where: { periodRateeId: In(rateeIds) }, order: { sortOrder: 'ASC' } }),
                this.dimensionStats(rateeIds),
                this.respondentCounts(rateeIds),
            ])
            : [[], new Map<string, { average: number; count: number }>(), new Map<string, number>()];
        return {
            period,
            ratees: ratees.map((ratee) => {
                const own = dimensions.filter((dimension) => dimension.periodRateeId === ratee.id).map((dimension) => {
                    const stats = scoreStats.get(dimension.id);
                    return { name: dimension.dimensionName, rawAverage: stats?.average ?? null, count: stats?.count ?? 0 };
                });
                const scored = own.flatMap((dimension) => (dimension.rawAverage === null ? [] : [dimension.rawAverage]));
                const average = scored.length ? round(mean(scored), 2) : null;
                return {
                    periodRateeId: ratee.id, displayName: ratee.displayName, jobTitle: ratee.jobTitle,
                    respondentCount: respondentCounts.get(ratee.id) ?? 0,
                    average,
                    indexPct: average === null ? null : round((average / CSI_SCORE_MAX) * PERCENT, 1),
                    dimensions: own.map(({ name, rawAverage, count }) => ({ name, average: rawAverage === null ? null : round(rawAverage, 2), count })),
                };
            }),
        };
    }

    async getRespondents(scope: ServiceScope, periodId: string) {
        const period = await this.findInScope(scope, periodId);
        const responses = await this.responses.find({ where: { periodId }, relations: { respondent: true }, order: { submittedAt: 'ASC' } });
        const submitted = responses.map((response) => ({
            responseId: response.id, fullName: response.respondent.fullName,
            departmentName: response.departmentName, submittedAt: response.submittedAt,
        }));
        let pending: Array<{ userId: string; fullName: string }> | null = null;
        if (period.respondentMode === CsiRespondentMode.LISTED) {
            const answered = new Set(responses.map((response) => response.respondentId));
            const raters = await this.periodRaters.find({ where: { periodId }, relations: { user: true } });
            pending = sortBy(raters.filter((rater) => !answered.has(rater.userId)), (rater) => rater.user.fullName)
                .map((rater) => ({ userId: rater.userId, fullName: rater.user.fullName }));
        }
        return {
            mode: period.respondentMode, submitted, pending,
            totals: { submitted: submitted.length, pending: pending ? pending.length : null },
        };
    }

    async getResponseDetail(scope: ServiceScope, periodId: string, responseId: string): Promise<CsiAnswer> {
        await this.findInScope(scope, periodId);
        const response = await this.responses.findOne({ where: { id: responseId, periodId }, relations: { respondent: true } });
        if (!response) throw new NotFoundException(RESPONSE_NOT_FOUND_MESSAGE);
        const [answer] = await this.buildAnswers(this.readers, [response]);
        return answer;
    }

    /** Every response of the period with its scores and comments, in submit order (used by the Excel export). */
    async listAnswers(scope: ServiceScope, periodId: string): Promise<CsiAnswer[]> {
        await this.findInScope(scope, periodId);
        const responses = await this.responses.find({ where: { periodId }, relations: { respondent: true }, order: { submittedAt: 'ASC' } });
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
                periodId, respondentId: response.respondentId, respondentName: answer.fullName,
                departmentName: answer.departmentName, submittedAt: answer.submittedAt,
                scores: answer.ratees.flatMap((ratee) => ratee.scores.map(({ dimension, score }) => ({ ratee: ratee.displayName, dimension, score }))),
            },
            description: `Reset jawaban CSI ${answer.fullName}. Alasan: ${trimmed}`,
            request: req,
        });
        return { reset: true as const };
    }

    private async findInScope(scope: ServiceScope, periodId: string) {
        return assertPeriodInScope(await this.periods.findOne({ where: { id: periodId } }), scope);
    }

    private async dimensionStats(rateeIds: string[]) {
        const rows: Array<{ periodRateeDimensionId: string; average: string; count: string }> = await this.items.createQueryBuilder('item')
            .select('item.periodRateeDimensionId', 'periodRateeDimensionId')
            .addSelect('AVG(item.score)', 'average').addSelect('COUNT(*)', 'count')
            .where('item.periodRateeId IN (:...rateeIds)', { rateeIds })
            .groupBy('item.periodRateeDimensionId').getRawMany();
        return new Map(rows.map((row) => [row.periodRateeDimensionId, { average: Number(row.average), count: Number(row.count) }]));
    }

    private async respondentCounts(rateeIds: string[]) {
        const rows: Array<{ periodRateeId: string; respondents: string }> = await this.items.createQueryBuilder('item')
            .select('item.periodRateeId', 'periodRateeId')
            .addSelect('COUNT(DISTINCT item.responseId)', 'respondents')
            .where('item.periodRateeId IN (:...rateeIds)', { rateeIds })
            .groupBy('item.periodRateeId').getRawMany();
        return new Map(rows.map((row) => [row.periodRateeId, Number(row.respondents)]));
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
                (item) => item.periodRatee.sortOrder * 1e6 + item.periodRateeDimension.sortOrder,
            );
            const ratees = new Map<string, CsiAnswerRatee>();
            for (const item of own) {
                const entry = ratees.get(item.periodRateeId) ?? {
                    periodRateeId: item.periodRateeId, displayName: item.periodRatee.displayName, jobTitle: item.periodRatee.jobTitle,
                    comment: commentOf.get(`${response.id}:${item.periodRateeId}`) ?? null, scores: [],
                };
                ratees.set(item.periodRateeId, { ...entry, scores: [...entry.scores, { dimension: item.periodRateeDimension.dimensionName, score: item.score }] });
            }
            return {
                responseId: response.id, fullName: response.respondent.fullName, departmentName: response.departmentName,
                submittedAt: response.submittedAt, ratees: [...ratees.values()],
            };
        });
    }
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
