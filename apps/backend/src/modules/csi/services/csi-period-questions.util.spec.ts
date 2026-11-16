import { BadRequestException, ConflictException } from '@nestjs/common';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { CsiPeriodPublishStatus, CsiQuestionType } from '../csi.constants';
import { CSI_PRESET_SATISFACTION } from '../csi-template';
import { CsiDimension } from '../entities/csi-dimension.entity';
import { CsiPeriodRateeDimension } from '../entities/csi-period-ratee-dimension.entity';
import { CsiPeriodRatee } from '../entities/csi-period-ratee.entity';
import { CsiPeriod } from '../entities/csi-period.entity';
import { CsiResponseDraft } from '../entities/csi-response-draft.entity';
import { CsiResponse } from '../entities/csi-response.entity';
import { applyPeriodQuestionUpdates, convertDraftAnswersForTransitions } from './csi-period-questions.util';

const NOW = new Date('2026-11-16T11:00:00Z');
const ICT = ServiceScope.ICT;

function makeManager(seed: {
    period: Partial<CsiPeriod>;
    ratees: Array<Partial<CsiPeriodRatee>>;
    snapshots: Array<Partial<CsiPeriodRateeDimension>>;
    masters?: Array<Partial<CsiDimension>>;
    responses?: Array<Partial<CsiResponse>>;
    drafts?: Array<Partial<CsiResponseDraft>>;
}) {
    const snapshots = seed.snapshots.map((row) => ({ ...row }));
    const drafts = (seed.drafts ?? []).map((row) => ({ ...row }));
    const masters = (seed.masters ?? []).map((row) => ({ ...row }));
    const responses = seed.responses ?? [];

    const repos = new Map<unknown, any>([
        [CsiPeriod, {
            createQueryBuilder: () => {
                const b: any = { setLock: () => b, where: () => b, getOne: async () => seed.period };
                return b;
            },
        }],
        [CsiPeriodRatee, { find: async () => seed.ratees }],
        [CsiResponse, { count: async () => responses.length }],
        [CsiPeriodRateeDimension, {
            find: async () => snapshots,
            save: async (rows: any[]) => {
                for (const next of rows) {
                    const idx = snapshots.findIndex((item) => item.id === next.id);
                    if (idx >= 0) snapshots[idx] = next;
                }
                return rows;
            },
        }],
        [CsiDimension, { find: async () => masters }],
        [CsiResponseDraft, {
            find: async () => drafts,
            save: async (rows: any[]) => {
                for (const next of rows) {
                    const idx = drafts.findIndex((item) => item.id === next.id);
                    if (idx >= 0) drafts[idx] = next;
                }
                return rows;
            },
        }],
    ]);

    return {
        manager: { getRepository: (entity: unknown) => repos.get(entity) } as any,
        snapshots,
        drafts,
    };
}

describe('csi-period-questions.util', () => {
    it('converts server draft answers accurately between SCALE optionIndex and STAR 1-5 score', () => {
        const transitions = new Map([
            ['prd-scale', {
                fromType: CsiQuestionType.SCALE,
                fromOptions: CSI_PRESET_SATISFACTION, // index 0 = 5 pts, index 4 = 1 pt
                toType: CsiQuestionType.STAR,
                toOptions: [],
            }],
            ['prd-star', {
                fromType: CsiQuestionType.STAR,
                fromOptions: [],
                toType: CsiQuestionType.SCALE,
                toOptions: CSI_PRESET_SATISFACTION,
            }],
        ]);
        const result = convertDraftAnswersForTransitions(
            {
                ratee1: { 'prd-scale': 0, 'prd-star': 4, 'prd-unchanged': 'text' },
            },
            transitions,
        );
        expect(result.changed).toBe(true);
        // Index 0 ("Sangat puas") -> 5 stars; 4 stars -> index 1 ("Puas")
        expect(result.answers).toEqual({
            ratee1: { 'prd-scale': 5, 'prd-star': 1, 'prd-unchanged': 'text' },
        });
    });

    it('syncs updated master STAR definition onto an answered active period and converts drafts', async () => {
        const { manager, snapshots, drafts } = makeManager({
            period: { id: 'p1', scope: ICT, endDate: '2026-11-30', publishStatus: CsiPeriodPublishStatus.PUBLISHED },
            ratees: [{ id: 're1', periodId: 'p1' }],
            snapshots: [
                {
                    id: 'prd-1', periodRateeId: 're1', dimensionId: 'dim-1', dimensionName: 'Old scale title',
                    shortLabel: 'Speed', type: CsiQuestionType.SCALE, required: true, options: CSI_PRESET_SATISFACTION,
                },
                {
                    id: 'prd-choice', periodRateeId: 're1', dimensionId: 'dim-2', dimensionName: 'Freq',
                    shortLabel: null, type: CsiQuestionType.CHOICE, required: true, options: [{ label: 'A', points: null }, { label: 'B', points: null }],
                },
            ],
            masters: [
                { id: 'dim-1', scope: ICT, name: 'Kecepatan respon', shortLabel: 'Respons', type: CsiQuestionType.STAR, required: false, options: [] },
                { id: 'dim-2', scope: ICT, name: 'Freq', shortLabel: null, type: CsiQuestionType.CHOICE, required: true, options: [{ label: 'A', points: null }, { label: 'B', points: null }] },
            ],
            responses: [{ id: 'resp-1', periodId: 'p1' }],
            drafts: [{ id: 'dr-1', periodId: 'p1', answers: { re1: { 'prd-1': 1 } }, updatedAt: new Date('2026-11-15T00:00:00Z') }],
        });

        const res = await applyPeriodQuestionUpdates(manager, ICT, 'p1', { syncFromMaster: true }, NOW);
        expect(res).toEqual({ updated: 1, convertedDrafts: 1 });
        expect(snapshots[0]).toMatchObject({
            dimensionName: 'Kecepatan respon',
            shortLabel: 'Respons',
            type: CsiQuestionType.STAR,
            options: [],
            required: true, // required stays locked when responses exist
        });
        expect(drafts[0].answers).toEqual({ re1: { 'prd-1': 4 } });
        expect(drafts[0].updatedAt).toEqual(NOW);
    });

    it('rejects changing CHOICE/TEXT to STAR when answered, and converts all SCALE when convertScaleToStar is true', async () => {
        const incompatible = makeManager({
            period: { id: 'p1', scope: ICT, endDate: '2026-11-30', publishStatus: CsiPeriodPublishStatus.PUBLISHED },
            ratees: [{ id: 're1', periodId: 'p1' }],
            snapshots: [{ id: 'prd-c', periodRateeId: 're1', dimensionId: 'dim-c', dimensionName: 'Freq', type: CsiQuestionType.CHOICE, required: true, options: [{ label: 'A', points: null }, { label: 'B', points: null }] }],
            responses: [{ id: 'resp-1', periodId: 'p1' }],
        });
        await expect(applyPeriodQuestionUpdates(incompatible.manager, ICT, 'p1', {
            updates: [{ dimensionId: 'dim-c', type: CsiQuestionType.STAR }],
        }, NOW)).rejects.toBeInstanceOf(BadRequestException);

        const ended = makeManager({
            period: { id: 'p1', scope: ICT, endDate: '2026-11-01', publishStatus: CsiPeriodPublishStatus.PUBLISHED },
            ratees: [{ id: 're1', periodId: 'p1' }],
            snapshots: [],
        });
        await expect(applyPeriodQuestionUpdates(ended.manager, ICT, 'p1', { convertScaleToStar: true }, NOW)).rejects.toBeInstanceOf(ConflictException);

        const bulk = makeManager({
            period: { id: 'p1', scope: ICT, endDate: '2026-11-30', publishStatus: CsiPeriodPublishStatus.PUBLISHED },
            ratees: [{ id: 're1', periodId: 'p1' }],
            snapshots: [
                { id: 'prd-1', periodRateeId: 're1', dimensionId: 'dim-1', dimensionName: 'Q1', type: CsiQuestionType.SCALE, required: true, options: CSI_PRESET_SATISFACTION },
                { id: 'prd-2', periodRateeId: 're1', dimensionId: 'dim-2', dimensionName: 'Q2', type: CsiQuestionType.CHOICE, required: true, options: [{ label: 'A', points: null }, { label: 'B', points: null }] },
            ],
            responses: [{ id: 'resp-1', periodId: 'p1' }],
        });
        const out = await applyPeriodQuestionUpdates(bulk.manager, ICT, 'p1', { convertScaleToStar: true }, NOW);
        expect(out).toEqual({ updated: 1, convertedDrafts: 0 });
        expect(bulk.snapshots[0].type).toBe(CsiQuestionType.STAR);
        expect(bulk.snapshots[0].options).toEqual([]);
        expect(bulk.snapshots[1].type).toBe(CsiQuestionType.CHOICE);
    });
});
