import { ConflictException, Injectable, Optional } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
    CSI_ANSWER_TEXT_MAX,
    CSI_COMMENT_MAX,
    CSI_ITEMS_MAX,
    CSI_OPTIONS_MAX,
    CSI_SCORE_MAX,
    CSI_SCORE_MIN,
    CsiQuestionType,
} from '../csi.constants';
import { SaveDraftDto } from '../dto/draft.dto';
import { CsiPeriod } from '../entities/csi-period.entity';
import { CsiPeriodRatee } from '../entities/csi-period-ratee.entity';
import { CsiPeriodRateeDimension } from '../entities/csi-period-ratee-dimension.entity';
import { CsiResponseDraft, DraftAnswers, DraftAnswerValue, DraftComments } from '../entities/csi-response-draft.entity';
import { CsiResponse } from '../entities/csi-response.entity';
import { CsiRespondentRef, CsiRespondentService } from './csi-respondent.service';

export interface SerializedCsiDraft {
    departmentId: string | null;
    position: number;
    answers: DraftAnswers;
    comments: DraftComments;
    picks: string[] | null;
    updatedAt: string;
}

interface DraftValidationContext {
    period: CsiPeriod;
    ratees: CsiPeriodRatee[];
    dimensions: CsiPeriodRateeDimension[];
    departmentIds: Set<string>;
}

const ALREADY_SUBMITTED_MESSAGE = 'Anda sudah mengirim survei ini';

@Injectable()
export class CsiDraftService {
    constructor(
        @InjectRepository(CsiResponseDraft)
        private readonly drafts: Repository<CsiResponseDraft>,
        private readonly respondent: CsiRespondentService,
        @Optional() @InjectDataSource()
        private readonly dataSource?: DataSource,
    ) { }

    /** Marks unsubmitted active periods with `hasDraft: true` when a saved server draft exists. */
    async withDraftFlags<T extends { id: string; submitted: boolean }>(
        respondentId: string,
        periods: T[],
    ): Promise<Array<T & { hasDraft: boolean }>> {
        const unsubmittedIds = periods.filter((period) => !period.submitted).map((period) => period.id);
        if (!unsubmittedIds.length) {
            return periods.map((period) => ({ ...period, hasDraft: false }));
        }
        const rows = await this.drafts.find({
            where: { respondentId, periodId: In(unsubmittedIds) },
            select: { periodId: true },
        });
        const draftSet = new Set(rows.map((row) => row.periodId));
        return periods.map((period) => ({
            ...period,
            hasDraft: !period.submitted && draftSet.has(period.id),
        }));
    }

    async getForForm(periodId: string, respondentId: string): Promise<SerializedCsiDraft | null> {
        const row = await this.drafts.findOne({ where: { periodId, respondentId } });
        return row ? serializeDraft(row) : null;
    }

    async save(
        user: CsiRespondentRef,
        periodId: string,
        dto: SaveDraftDto,
        now: Date = new Date(),
    ): Promise<{ draft: SerializedCsiDraft | null }> {
        const ctx = await this.respondent.draftContext(user, periodId, now);
        if (ctx.submittedAt) throw new ConflictException(ALREADY_SUBMITTED_MESSAGE);

        const clean = sanitizeDraft(dto, ctx);
        const persist = async (draftRepo: Repository<CsiResponseDraft>, responseRepo?: Repository<CsiResponse>) => {
            if (responseRepo && (await responseRepo.count({ where: { periodId: ctx.period.id, respondentId: ctx.respondentId } }))) {
                throw new ConflictException(ALREADY_SUBMITTED_MESSAGE);
            }
            if (isDraftEmpty(clean)) {
                await draftRepo.delete({ periodId: ctx.period.id, respondentId: ctx.respondentId });
                return { draft: null };
            }
            await draftRepo.upsert(
                {
                    periodId: ctx.period.id,
                    respondentId: ctx.respondentId,
                    departmentId: clean.departmentId,
                    position: clean.position,
                    answers: clean.answers,
                    comments: clean.comments,
                    picks: clean.picks,
                    updatedAt: now,
                },
                ['periodId', 'respondentId'],
            );
            return {
                draft: {
                    ...clean,
                    updatedAt: now.toISOString(),
                },
            };
        };

        if (this.dataSource) {
            return this.dataSource.transaction(async (manager) => {
                await manager.query?.('SELECT pg_advisory_xact_lock(hashtext($1))', [`csi-draft:${ctx.period.id}:${ctx.respondentId}`]);
                return persist(manager.getRepository(CsiResponseDraft), manager.getRepository(CsiResponse));
            });
        }
        return persist(this.drafts);
    }

    async clear(respondentId: string, periodId: string): Promise<void> {
        await this.drafts.delete({ periodId, respondentId });
    }
}

function serializeDraft(row: CsiResponseDraft): SerializedCsiDraft {
    return {
        departmentId: row.departmentId ?? null,
        position: row.position ?? 0,
        answers: row.answers ?? {},
        comments: row.comments ?? {},
        picks: row.picks ?? null,
        updatedAt: (row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt)).toISOString(),
    };
}

function sanitizeDraft(dto: SaveDraftDto, ctx: DraftValidationContext) {
    const rateeIds = new Set(ctx.ratees.map((row) => row.id));
    const dimensionsById = new Map(ctx.dimensions.map((row) => [row.id, row]));

    const departmentId = dto.departmentId && ctx.departmentIds.has(dto.departmentId)
        ? dto.departmentId
        : null;
    const rawPos = typeof dto.position === 'number' && Number.isInteger(dto.position) ? dto.position : 0;
    const position = Math.min(Math.max(rawPos, 0), ctx.ratees.length + 1);

    const answers = sanitizeAnswers(dto.answers, rateeIds, dimensionsById);
    const comments = sanitizeComments(dto.comments, rateeIds);
    const picks = sanitizePicks(dto.picks, Boolean(ctx.period.respondentPicks), rateeIds);

    return { departmentId, position, answers, comments, picks };
}

function sanitizeAnswers(
    raw: Record<string, Record<string, DraftAnswerValue>> | undefined,
    rateeIds: Set<string>,
    dimensionsById: Map<string, CsiPeriodRateeDimension>,
): DraftAnswers {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const out: DraftAnswers = {};
    let total = 0;

    for (const [rateeId, byDim] of Object.entries(raw)) {
        if (!rateeIds.has(rateeId) || !byDim || typeof byDim !== 'object' || Array.isArray(byDim)) continue;
        const cleanRatee: Record<string, DraftAnswerValue> = {};
        for (const [dimId, value] of Object.entries(byDim)) {
            if (total >= CSI_ITEMS_MAX) break;
            const dim = dimensionsById.get(dimId);
            if (!dim || dim.periodRateeId !== rateeId) continue;
            const cleanValue = sanitizeAnswerValue(dim, value);
            if (cleanValue === null) continue;
            cleanRatee[dimId] = cleanValue;
            total += 1;
        }
        if (Object.keys(cleanRatee).length) out[rateeId] = cleanRatee;
        if (total >= CSI_ITEMS_MAX) break;
    }
    return out;
}

function sanitizeAnswerValue(dim: CsiPeriodRateeDimension, value: unknown): DraftAnswerValue | null {
    if (dim.type === CsiQuestionType.TEXT) {
        if (typeof value !== 'string') return null;
        const trimmed = value.trim();
        return trimmed ? trimmed.slice(0, CSI_ANSWER_TEXT_MAX) : null;
    }
    if (typeof value !== 'number' || !Number.isInteger(value)) return null;
    if (dim.type === CsiQuestionType.CHOICE || dim.type === CsiQuestionType.SCALE) {
        const maxIdx = Math.max(0, (dim.options?.length ?? CSI_OPTIONS_MAX) - 1);
        return value >= 0 && value <= maxIdx ? value : null;
    }
    return value >= CSI_SCORE_MIN && value <= CSI_SCORE_MAX ? value : null;
}

function sanitizeComments(raw: Record<string, string> | undefined, rateeIds: Set<string>): DraftComments {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const out: DraftComments = {};
    for (const [rateeId, value] of Object.entries(raw)) {
        if (!rateeIds.has(rateeId) || typeof value !== 'string') continue;
        const trimmed = value.trim();
        if (trimmed) out[rateeId] = trimmed.slice(0, CSI_COMMENT_MAX);
    }
    return out;
}

function sanitizePicks(raw: string[] | null | undefined, allowPicks: boolean, rateeIds: Set<string>): string[] | null {
    if (!allowPicks || !Array.isArray(raw)) return null;
    const valid = [...new Set(raw.filter((id) => typeof id === 'string' && rateeIds.has(id)))];
    return valid.length ? valid : null;
}

function isDraftEmpty(draft: {
    departmentId: string | null;
    answers: DraftAnswers;
    comments: DraftComments;
    picks: string[] | null;
}): boolean {
    return (
        draft.departmentId === null
        && Object.keys(draft.answers).length === 0
        && Object.keys(draft.comments).length === 0
        && (!draft.picks || draft.picks.length === 0)
    );
}
