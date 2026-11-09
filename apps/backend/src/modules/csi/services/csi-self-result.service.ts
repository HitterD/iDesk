import { Inject, Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { CsiPeriodPublishStatus, CsiQuestionType, CsiRateeKind } from '../csi.constants';
import { CsiPeriodRateeDimension } from '../entities/csi-period-ratee-dimension.entity';
import { CsiPeriodRatee } from '../entities/csi-period-ratee.entity';
import { CsiResponseComment } from '../entities/csi-response-comment.entity';
import { CsiResponseItem } from '../entities/csi-response-item.entity';
import { CsiPic } from '../entities/csi-pic.entity';
import { computeStatus, CsiPeriodStatus } from './csi-period.service';
import { ratedAccountOf } from './csi-ratee-owner.util';

/** Results stay hidden until this many people rated the person, so no single rater can be singled out. */
export const CSI_SELF_RESULT_MIN_RATERS = 3;
export const CSI_RANDOM = Symbol('CSI_RANDOM');
const NOT_SCORED = new Set<string>([CsiQuestionType.CHOICE, CsiQuestionType.TEXT]);

export type CsiSelfResult = {
    periodId: string; title: string; startDate: string; endDate: string; status: CsiPeriodStatus;
    serviceFunction: string | null; raters: number; minRaters: number; ready: boolean;
    average: number | null; dimensions: Array<{ label: string; average: number }>; comments: string[];
};

const round2 = (value: number) => Math.round(value * 100) / 100;
const mean = (values: number[]) => (values.length ? round2(values.reduce((sum, value) => sum + value, 0) / values.length) : null);

/** Fisher–Yates with an injectable random source (tests pin it). */
function shuffled<T>(rows: T[], random: () => number): T[] {
    const copy = [...rows];
    for (let index = copy.length - 1; index > 0; index -= 1) {
        const other = Math.floor(random() * (index + 1));
        [copy[index], copy[other]] = [copy[other], copy[index]];
    }
    return copy;
}

/**
 * "Hasil penilaian saya" (HC, and ICT surveys created with selfResults): what people rated about the
 * signed-in account, live while the survey runs. Never carries a
 * rater's name, unit, answer id or date; scores and comments only appear from CSI_SELF_RESULT_MIN_RATERS raters on.
 */
@Injectable()
export class CsiSelfResultService {
    constructor(
        @InjectRepository(CsiPeriodRatee) private readonly ratees: Repository<CsiPeriodRatee>,
        @InjectRepository(CsiPeriodRateeDimension) private readonly dimensions: Repository<CsiPeriodRateeDimension>,
        @InjectRepository(CsiResponseItem) private readonly items: Repository<CsiResponseItem>,
        @InjectRepository(CsiResponseComment) private readonly comments: Repository<CsiResponseComment>,
        @InjectRepository(CsiPic) private readonly pics: Repository<CsiPic>,
        @Optional() @Inject(CSI_RANDOM) private readonly random: () => number = Math.random,
    ) { }

    async list(userId: string, now: Date = new Date()): Promise<CsiSelfResult[]> {
        // A PIC linked to this account later than the survey was built is still this person (see ratedAccountOf).
        const picIds = (await this.pics.find({ where: { userId }, select: { id: true } })).map((pic) => pic.id);
        // HC surveys, and ICT surveys created from the release on (older ICT surveys were answered without that promise).
        const published = { publishStatus: CsiPeriodPublishStatus.PUBLISHED };
        const hc = { kind: CsiRateeKind.PERSON, period: { ...published, scope: ServiceScope.HC } };
        // ICT only for surveys created with the promise (csi_periods.selfResults), never for older ICT surveys.
        const ict = { kind: CsiRateeKind.PERSON, period: { ...published, scope: ServiceScope.ICT, selfResults: true } };
        const rows = (await this.ratees.find({
            where: [{ ...hc, userId }, { ...ict, userId }, ...(picIds.length ? [{ ...hc, picId: In(picIds) }] : [])],
            relations: { period: true },
        }))
            .filter((row) => row.period?.scope === ServiceScope.HC || (row.period?.scope === ServiceScope.ICT && row.period.selfResults === true)).filter((row, index, all) => all.findIndex((other) => other.id === row.id) === index)
            .filter((row) => ratedAccountOf(row, new Map(row.picId && picIds.includes(row.picId) ? [[row.picId, userId]] : [])) === userId)
            .filter((row) => row.period && !row.period.cancelledAt && row.period.individualEnabled !== false);
        const results = await Promise.all(rows.map((row) => this.resultOf(row, now)));
        return results.sort((a, b) => b.startDate.localeCompare(a.startDate));
    }

    private async resultOf(ratee: CsiPeriodRatee, now: Date): Promise<CsiSelfResult> {
        const questions = (await this.dimensions.find({ where: { periodRateeId: ratee.id } }))
            .filter((row) => !NOT_SCORED.has(row.type ?? CsiQuestionType.STAR))
            .sort((a, b) => a.sortOrder - b.sortOrder);
        const scored = questions.length
            ? (await this.items.find({ where: { periodRateeId: ratee.id, periodRateeDimensionId: In(questions.map((row) => row.id)) } }))
                .filter((item) => item.score !== null && item.score !== undefined)
            : [];
        const byResponse = new Map<string, number[]>();
        scored.forEach((item) => byResponse.set(item.responseId, [...(byResponse.get(item.responseId) ?? []), item.score!]));
        const raters = byResponse.size;
        const ready = raters >= CSI_SELF_RESULT_MIN_RATERS;
        const { period } = ratee;
        const base = {
            periodId: period.id, title: period.title, startDate: period.startDate, endDate: period.endDate, status: computeStatus(period, now),
            serviceFunction: ratee.serviceFunction ?? null, raters, minRaters: CSI_SELF_RESULT_MIN_RATERS, ready,
        };
        if (!ready) return { ...base, average: null, dimensions: [], comments: [] };
        const dimensions = questions.flatMap((question) => {
            const average = mean(scored.filter((item) => item.periodRateeDimensionId === question.id).map((item) => item.score!));
            return average === null ? [] : [{ label: question.shortLabel || question.dimensionName, average }];
        });
        const average = mean([...byResponse.values()].map((scores) => mean(scores)!));
        const texts = (await this.comments.find({ where: { periodRateeId: ratee.id } })).map((row) => row.comment.trim()).filter(Boolean);
        return { ...base, average, dimensions, comments: shuffled(texts, this.random) };
    }
}
