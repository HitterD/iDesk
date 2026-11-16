import { BadRequestException, ConflictException } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { wibEndOfDate } from '../../../shared/core/utils/wib-date.util';
import { CSI_SCORE_MAX, CSI_SCORE_MIN, CsiOption, CsiPeriodPublishStatus, CsiQuestionType } from '../csi.constants';
import { INVALID_OPTIONS_MESSAGE, optionsMatchType } from '../csi-question.util';
import { CSI_PRESET_SATISFACTION } from '../csi-template';
import { CsiDimension } from '../entities/csi-dimension.entity';
import { CsiPeriodRateeDimension } from '../entities/csi-period-ratee-dimension.entity';
import { CsiPeriodRatee } from '../entities/csi-period-ratee.entity';
import { CsiPeriod } from '../entities/csi-period.entity';
import { CsiResponseDraft, DraftAnswers } from '../entities/csi-response-draft.entity';
import { CsiResponse } from '../entities/csi-response.entity';
import { lockPeriodRow } from './csi-period-lock.util';

const SCORED_TYPES = new Set<CsiQuestionType>([CsiQuestionType.STAR, CsiQuestionType.SCALE]);
const CLOSED_PERIOD_MESSAGE = 'Survei sudah berakhir atau dibatalkan sehingga pertanyaan tidak dapat diubah';
const INCOMPATIBLE_TYPE_MESSAGE = 'Setelah ada jawaban, tipe pertanyaan hanya dapat diubah antara Skala nilai 1–5 dan Bintang 1–5';
const NO_QUESTION_CHANGES_MESSAGE = 'Tidak ada perubahan pertanyaan yang dikirim';

export type PeriodQuestionUpdateItem = {
    dimensionId: string;
    type: CsiQuestionType;
    options?: CsiOption[];
};

export type UpdatePeriodQuestionsInput = {
    syncFromMaster?: boolean;
    convertScaleToStar?: boolean;
    updates?: PeriodQuestionUpdateItem[];
};

type SnapshotShape = {
    dimensionName: string;
    shortLabel: string | null;
    type: CsiQuestionType;
    required: boolean;
    options: CsiOption[];
};

type Transition = {
    fromType: CsiQuestionType;
    fromOptions: CsiOption[];
    toType: CsiQuestionType;
    toOptions: CsiOption[];
};

const copyOptions = (options: readonly CsiOption[] | null | undefined): CsiOption[] =>
    (options ?? []).map((option) => ({ label: option.label, points: option.points ?? null }));

const sameOptions = (left: readonly CsiOption[], right: readonly CsiOption[]): boolean =>
    left.length === right.length
    && left.every((opt, idx) => opt.label === right[idx]?.label && (opt.points ?? null) === (right[idx]?.points ?? null));

const isValidScore = (value: unknown): value is number =>
    typeof value === 'number' && Number.isInteger(value) && value >= CSI_SCORE_MIN && value <= CSI_SCORE_MAX;

/**
 * Converts existing in-progress draft entries when a period question changes between SCALE and STAR
 * (or drops incompatible draft values when an unanswered survey changes question type/options).
 */
export function convertDraftAnswersForTransitions(
    answers: DraftAnswers,
    transitions: ReadonlyMap<string, Transition>,
): { answers: DraftAnswers; changed: boolean } {
    if (!transitions.size || !answers) return { answers, changed: false };
    let changed = false;
    const nextAnswers: DraftAnswers = {};

    for (const [rateeId, byDim] of Object.entries(answers)) {
        if (!byDim || typeof byDim !== 'object') continue;
        const nextRatee: Record<string, string | number> = {};
        for (const [dimId, value] of Object.entries(byDim)) {
            const transition = transitions.get(dimId);
            if (!transition) {
                nextRatee[dimId] = value;
                continue;
            }
            const { fromType, fromOptions, toType, toOptions } = transition;
            if (fromType === toType && sameOptions(fromOptions, toOptions)) {
                nextRatee[dimId] = value;
                continue;
            }
            changed = true;
            if (fromType === CsiQuestionType.SCALE && toType === CsiQuestionType.STAR) {
                const points = typeof value === 'number' && Number.isInteger(value) ? fromOptions[value]?.points : null;
                if (isValidScore(points)) nextRatee[dimId] = points;
            } else if (fromType === CsiQuestionType.STAR && toType === CsiQuestionType.SCALE) {
                const idx = isValidScore(value) ? toOptions.findIndex((option) => option.points === value) : -1;
                if (idx >= 0) nextRatee[dimId] = idx;
            }
        }
        if (Object.keys(nextRatee).length) nextAnswers[rateeId] = nextRatee;
    }
    return { answers: nextAnswers, changed };
}

/**
 * Updates `csi_period_ratee_dimensions` snapshots for a draft or published period while it has not ended
 * or been cancelled. Once responses exist, type changes are restricted to scored types (SCALE <-> STAR)
 * and existing server drafts are converted to match so respondent drafts stay accurate.
 */
export async function applyPeriodQuestionUpdates(
    manager: EntityManager,
    scope: ServiceScope,
    periodId: string,
    input: UpdatePeriodQuestionsInput,
    now: Date = new Date(),
): Promise<{ updated: number; convertedDrafts: number }> {
    const hasAction = Boolean(input.syncFromMaster || input.convertScaleToStar || input.updates?.length);
    if (!hasAction) throw new BadRequestException(NO_QUESTION_CHANGES_MESSAGE);

    const period = await lockPeriodRow(manager, periodId);
    if (!period || period.publishStatus === CsiPeriodPublishStatus.CANCELLED || now.getTime() > wibEndOfDate(period.endDate).getTime()) {
        throw new ConflictException(CLOSED_PERIOD_MESSAGE);
    }

    const ratees = await manager.getRepository(CsiPeriodRatee).find({ where: { periodId }, select: { id: true } });
    if (!ratees.length) return { updated: 0, convertedDrafts: 0 };

    const dimRepo = manager.getRepository(CsiPeriodRateeDimension);
    const snapshotRows = await dimRepo.find({ where: { periodRateeId: In(ratees.map((ratee) => ratee.id)) } });
    if (!snapshotRows.length) return { updated: 0, convertedDrafts: 0 };

    const responseCount = await manager.getRepository(CsiResponse).count({ where: { periodId } });
    const hasAnswers = responseCount > 0;

    const dimensionIds = [...new Set(snapshotRows.map((row) => row.dimensionId))];
    const needMaster = Boolean(input.syncFromMaster || input.updates?.some((item) => item.type === CsiQuestionType.SCALE && !item.options?.length));
    const masters = needMaster && dimensionIds.length
        ? await manager.getRepository(CsiDimension).find({ where: { id: In(dimensionIds), scope } })
        : [];
    const masterById = new Map(masters.map((item) => [item.id, item]));
    const updatesByDim = new Map((input.updates ?? []).map((item) => [item.dimensionId, item]));

    const toSave: CsiPeriodRateeDimension[] = [];
    const transitions = new Map<string, Transition>();

    for (const row of snapshotRows) {
        const currentType = row.type ?? CsiQuestionType.STAR;
        const currentOptions = copyOptions(row.options);
        const next: SnapshotShape = {
            dimensionName: row.dimensionName,
            shortLabel: row.shortLabel ?? null,
            type: currentType,
            required: row.required !== false,
            options: currentOptions,
        };

        if (input.syncFromMaster) {
            const master = masterById.get(row.dimensionId);
            if (master) {
                if (hasAnswers && master.type !== next.type && (!SCORED_TYPES.has(next.type) || !SCORED_TYPES.has(master.type))) {
                    throw new BadRequestException(INCOMPATIBLE_TYPE_MESSAGE);
                }
                next.dimensionName = master.name;
                next.shortLabel = master.shortLabel ?? null;
                next.type = master.type;
                next.options = copyOptions(master.options);
                if (!hasAnswers) next.required = master.required;
            }
        }

        if (input.convertScaleToStar && next.type === CsiQuestionType.SCALE) {
            next.type = CsiQuestionType.STAR;
            next.options = [];
        }

        const direct = updatesByDim.get(row.dimensionId);
        if (direct) {
            if (hasAnswers && direct.type !== currentType && (!SCORED_TYPES.has(currentType) || !SCORED_TYPES.has(direct.type))) {
                throw new BadRequestException(INCOMPATIBLE_TYPE_MESSAGE);
            }
            next.type = direct.type;
            if (direct.type === CsiQuestionType.STAR || direct.type === CsiQuestionType.TEXT) {
                next.options = [];
            } else if (direct.options?.length) {
                next.options = copyOptions(direct.options);
            } else if (direct.type === CsiQuestionType.SCALE) {
                const master = masterById.get(row.dimensionId);
                next.options = master && master.type === CsiQuestionType.SCALE && optionsMatchType(CsiQuestionType.SCALE, master.options)
                    ? copyOptions(master.options)
                    : copyOptions(CSI_PRESET_SATISFACTION);
            }
        }

        if (!optionsMatchType(next.type, next.options)) {
            throw new BadRequestException(INVALID_OPTIONS_MESSAGE);
        }

        const changed = next.dimensionName !== row.dimensionName
            || (next.shortLabel ?? null) !== (row.shortLabel ?? null)
            || next.type !== currentType
            || next.required !== (row.required !== false)
            || !sameOptions(next.options, currentOptions);
        if (!changed) continue;

        if (next.type !== currentType || !sameOptions(next.options, currentOptions)) {
            transitions.set(row.id, { fromType: currentType, fromOptions: currentOptions, toType: next.type, toOptions: next.options });
        }
        toSave.push({
            ...row,
            dimensionName: next.dimensionName,
            shortLabel: next.shortLabel,
            type: next.type,
            required: next.required,
            options: next.options,
        });
    }

    if (toSave.length) await dimRepo.save(toSave);

    let convertedDrafts = 0;
    if (transitions.size) {
        const draftRepo = manager.getRepository(CsiResponseDraft);
        const drafts = await draftRepo.find({ where: { periodId } });
        const changedDrafts: CsiResponseDraft[] = [];
        for (const draft of drafts) {
            const result = convertDraftAnswersForTransitions(draft.answers ?? {}, transitions);
            if (!result.changed) continue;
            changedDrafts.push({ ...draft, answers: result.answers, updatedAt: now });
        }
        if (changedDrafts.length) {
            await draftRepo.save(changedDrafts);
            convertedDrafts = changedDrafts.length;
        }
    }

    return { updated: toSave.length, convertedDrafts };
}
