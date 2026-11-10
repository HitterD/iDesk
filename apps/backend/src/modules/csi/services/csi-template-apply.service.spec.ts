import { BadRequestException } from '@nestjs/common';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { CsiPairMode, CsiPeriodPublishStatus, CsiQuestionType, CsiRateeKind, CsiRespondentMode } from '../csi.constants';
import { CsiPeriodRateeDimension } from '../entities/csi-period-ratee-dimension.entity';
import { CsiPeriodRatee } from '../entities/csi-period-ratee.entity';
import { CsiPeriodRaterRatee } from '../entities/csi-period-rater-ratee.entity';
import { CsiPeriodRater } from '../entities/csi-period-rater.entity';
import { CsiPeriod } from '../entities/csi-period.entity';
import { CsiTemplateView } from '../org/csi-template-view';
import { memoryTable } from './csi-memory-table.fixture';
import { CsiTemplateApplyService } from './csi-template-apply.service';

const HC = ServiceScope.HC;
const rater = (id: string, raterName: string, userId: string | null, status: 'confirmed' | 'ok' | 'no-account' | 'ambiguous' = userId ? 'ok' : 'no-account') =>
    ({ id, raterName, raterNik: null, raterJobTitle: null, userId, status, confirmed: status === 'confirmed' });
const view = (): CsiTemplateView => ({
    id: 't1', scope: 'HC', locationCode: 'SMG', name: 'CSI HC 2026 – Semarang', updatedAt: null,
    summary: { pics: 4, picsUnmatched: 1, picsWithoutRaters: 1, raters: 4, ratersConfirmed: 0, ratersOk: 2, ratersNoAccount: 1, ratersAmbiguous: 1 },
    pics: [
        { id: 'tp-rara', area: 'HC Development', serviceCode: 'HCD', picName: 'RARA', jobTitle: 'Staff', serviceFunction: 'People & Organization Development', picId: 'pic-rara', raterCount: 3,
            raters: [rater('a', 'ELVI CYNTHIA', 'u-elvi'), rater('b', 'ARIEF NOEGROHO', null), rater('c', 'AGUS SUBEKTI', null, 'ambiguous')] },
        { id: 'tp-mega', area: 'HC Comben', serviceCode: 'HCC', picName: 'MEGA', jobTitle: 'Supervisor', serviceFunction: 'Benefit', picId: 'pic-mega', raterCount: 1,
            raters: [rater('d', 'ELVI CYNTHIA', 'u-elvi')] },
        { id: 'tp-jingga', area: 'HC Services', serviceCode: 'HCS', picName: 'JINGGA', jobTitle: 'Receptionist', serviceFunction: 'Receptionist', picId: 'pic-jingga', raterCount: 0, raters: [] },
        { id: 'tp-ghost', area: 'HC Services', serviceCode: 'HCS', picName: 'GHOST', jobTitle: null, serviceFunction: null, picId: null, raterCount: 1,
            raters: [rater('e', 'ELVI CYNTHIA', 'u-elvi')] },
    ],
});

describe('CsiTemplateApplyService', () => {
    let periods: ReturnType<typeof memoryTable>;
    let ratees: ReturnType<typeof memoryTable>;
    let rateeDims: ReturnType<typeof memoryTable>;
    let raters: ReturnType<typeof memoryTable>;
    let pairs: ReturnType<typeof memoryTable>;
    let service: CsiTemplateApplyService;
    const templates = { get: jest.fn(async () => view()) };
    const pics = [
        { id: 'pic-rara', fullName: 'RARA', jobTitle: 'Staff', serviceCode: 'HCD', serviceFunction: 'People & Organization Development', bagian: 'HCD', siteId: 's-smg', userId: 'u-rara', isActive: true },
        { id: 'pic-mega', fullName: 'MEGA', jobTitle: 'Supervisor', serviceCode: 'HCC', serviceFunction: null, bagian: 'HCC', siteId: 's-smg', userId: null, isActive: true },
        { id: 'pic-jingga', fullName: 'JINGGA', jobTitle: 'Receptionist', serviceCode: 'HCS', serviceFunction: null, bagian: 'HCS', siteId: 's-smg', userId: null, isActive: true },
    ];
    const org = { findPics: jest.fn(async (_scope: string, ids: string[]) => pics.filter((pic) => ids.includes(pic.id))) };
    const dimensions = { find: jest.fn(async () => [
        { id: 'd-k', name: 'Knowledge — Pengetahuan', shortLabel: 'Knowledge', type: CsiQuestionType.STAR, required: true, options: [], sortOrder: 0, isActive: true, scope: HC },
        { id: 'd-c', name: 'Courtesy — Kesopanan', shortLabel: 'Courtesy', type: CsiQuestionType.STAR, required: true, options: [], sortOrder: 1, isActive: true, scope: HC },
    ]) };
    const periodService = {
        create: jest.fn(async () => { periods.rows.push({ id: 'p-new', scope: HC, respondentMode: CsiRespondentMode.LISTED, pairMode: null, unitRules: [], cancelledAt: null, sites: [{ siteId: 's-smg', site: { code: 'SMG' } }] }); return { id: 'p-new' }; }),
        remove: jest.fn(async () => undefined),
    };
    const sites = { findOne: jest.fn(async () => ({ id: 's-smg', code: 'SMG' })) };

    beforeEach(() => {
        jest.clearAllMocks();
        periods = memoryTable(); ratees = memoryTable(); rateeDims = memoryTable(); raters = memoryTable(); pairs = memoryTable();
        periods.rows.push({ id: 'p1', scope: HC, respondentMode: CsiRespondentMode.LISTED, pairMode: null, unitRules: [], publishStatus: CsiPeriodPublishStatus.PUBLISHED,
            cancelledAt: null, sites: [{ siteId: 's-smg', site: { code: 'SMG' } }] });
        const repositories = new Map<unknown, unknown>([
            [CsiPeriod, periods], [CsiPeriodRatee, ratees], [CsiPeriodRateeDimension, rateeDims], [CsiPeriodRater, raters], [CsiPeriodRaterRatee, pairs],
        ]);
        const manager = {
            getRepository: (target: unknown) => repositories.get(target),
            query: jest.fn(async () => []),
            update: jest.fn(async (target: unknown, where: any, patch: any) => {
                (repositories.get(target) as ReturnType<typeof memoryTable>).rows.filter((row) => row.id === where.id).forEach((row) => Object.assign(row, patch));
            }),
        };
        const dataSource = { transaction: jest.fn(async (work: any) => work(manager)) };
        service = new CsiTemplateApplyService(templates as any, org as any, dimensions as any, sites as any, periodService as any, dataSource as any);
    });

    it('dry run only reports: PICs without raters skipped, unknown PICs and raters without account listed', async () => {
        const report = await service.applyToPeriod(HC, 't1', 'p1', false);
        expect(report).toMatchObject({
            committed: false, picsAdded: 2, ratersAdded: 1, pairsAdded: 2,
            picsSkippedNoRaters: ['JINGGA'], picsUnmatched: ['GHOST'], ratersNoAccount: ['ARIEF NOEGROHO'], ratersAmbiguous: ['AGUS SUBEKTI'],
        });
        expect(ratees.rows).toEqual([]);
    });

    it('commit adds PIC ratees (service function snapshot, HC questions), raters and pairs', async () => {
        await service.applyToPeriod(HC, 't1', 'p1', true);
        expect(ratees.rows.map((row) => [row.picId, row.serviceFunction, row.kind])).toEqual([
            ['pic-rara', 'People & Organization Development', CsiRateeKind.PERSON], ['pic-mega', 'Benefit', CsiRateeKind.PERSON],
        ]);
        expect(rateeDims.rows.filter((row) => row.periodRateeId === ratees.rows[0].id).map((row) => row.shortLabel)).toEqual(['Knowledge', 'Courtesy']);
        expect(raters.rows.map((row) => row.userId)).toEqual(['u-elvi']);
        expect(pairs.rows).toHaveLength(2);
        expect(periods.rows[0]).toMatchObject({ respondentMode: CsiRespondentMode.LISTED, pairMode: CsiPairMode.CUSTOM });
    });

    it('applies confirmed raters just like automatically matched raters', async () => {
        const confirmedView = view();
        confirmedView.pics[0].raters[0] = rater('a', 'ELVI CYNTHIA', 'u-confirmed', 'confirmed');
        templates.get.mockResolvedValueOnce(confirmedView);
        await service.applyToPeriod(HC, 't1', 'p1', true);
        expect(raters.rows.map((row) => row.userId)).toContain('u-confirmed');
        expect(pairs.rows).toHaveLength(2);
    });

    it('is add-only and idempotent: a second run adds nothing and keeps existing pairs', async () => {
        await service.applyToPeriod(HC, 't1', 'p1', true);
        pairs.rows.push({ id: 'manual', periodId: 'p1', periodRaterId: 'r-x', periodRateeId: 'x' });
        const again = await service.applyToPeriod(HC, 't1', 'p1', true);
        expect(again).toMatchObject({ picsAdded: 0, ratersAdded: 0, pairsAdded: 0 });
        expect(pairs.rows.some((row) => row.id === 'manual')).toBe(true);
        expect(ratees.rows).toHaveLength(2);
    });

    it('creates a draft period for the template location and applies the template', async () => {
        const result = await service.createPeriodFromTemplate(HC, 't1', { title: 'CSI HC 2026 – Semarang', startDate: '2026-12-01', endDate: '2026-12-31' }, 'admin');
        expect(periodService.create).toHaveBeenCalledWith(HC, expect.objectContaining({ siteIds: ['s-smg'], respondentMode: CsiRespondentMode.LISTED, individualEnabled: true, teamEnabled: false }), 'admin');
        expect(result.periodId).toBe('p-new');
        expect(result.report.committed).toBe(true);
    });

    it('never locks people out: OPEN, respondent-picks and "everyone rates everyone" surveys are refused, mode untouched', async () => {
        periods.rows[0] = { ...periods.rows[0], respondentMode: CsiRespondentMode.OPEN };
        expect((await service.applyToPeriod(HC, 't1', 'p1', false)).blockedReason).toMatch(/terbuka/);
        await expect(service.applyToPeriod(HC, 't1', 'p1', true)).rejects.toBeInstanceOf(BadRequestException);
        periods.rows[0] = { ...periods.rows[0], respondentMode: CsiRespondentMode.LISTED, respondentPicks: true };
        expect((await service.applyToPeriod(HC, 't1', 'p1', false)).blockedReason).toMatch(/memilih PIC sendiri/);
        periods.rows[0] = { ...periods.rows[0], respondentPicks: false };
        raters.rows.push({ id: 'old', periodId: 'p1', userId: 'u-old' });
        expect((await service.applyToPeriod(HC, 't1', 'p1', false)).blockedReason).toMatch(/semua orang/);
        await expect(service.applyToPeriod(HC, 't1', 'p1', true)).rejects.toBeInstanceOf(BadRequestException);
        expect(pairs.rows).toEqual([]);
        expect(periods.rows[0].respondentMode).toBe(CsiRespondentMode.LISTED);
    });

    it('a mapped survey with answers keeps its raters and pairs; template pairs are added next to them', async () => {
        raters.rows.push({ id: 'old', periodId: 'p1', userId: 'u-old' });
        ratees.rows.push({ id: 'r-old', periodId: 'p1', picId: 'pic-other', kind: CsiRateeKind.PERSON });
        pairs.rows.push({ id: 'pair-old', periodId: 'p1', periodRaterId: 'old', periodRateeId: 'r-old' });
        const report = await service.applyToPeriod(HC, 't1', 'p1', true);
        expect(report.blockedReason).toBeNull();
        expect(pairs.rows.map((row) => row.id)).toContain('pair-old');
        expect(pairs.rows).toHaveLength(3);
    });

    it('creating from a template without HC questions fails before any survey is created', async () => {
        dimensions.find.mockResolvedValueOnce([]);
        await expect(service.createPeriodFromTemplate(HC, 't1', { title: 'X', startDate: '2026-12-01', endDate: '2026-12-31' }, 'admin'))
            .rejects.toBeInstanceOf(BadRequestException);
        expect(periodService.create).not.toHaveBeenCalled();
    });

    it('a failing apply removes the draft it just created', async () => {
        org.findPics.mockRejectedValueOnce(new Error('boom'));
        await expect(service.createPeriodFromTemplate(HC, 't1', { title: 'X', startDate: '2026-12-01', endDate: '2026-12-31' }, 'admin')).rejects.toThrow('boom');
        expect(periodService.remove).toHaveBeenCalledWith(HC, 'p-new');
    });

    it('a cancelled survey, or one without the template location, is refused with a reason', async () => {
        periods.rows[0] = { ...periods.rows[0], cancelledAt: new Date() };
        expect((await service.applyToPeriod(HC, 't1', 'p1', false)).blockedReason).toMatch(/dibatalkan/);
        periods.rows[0] = { ...periods.rows[0], cancelledAt: null, sites: [{ siteId: 's-spj', site: { code: 'SPJ' } }] };
        expect((await service.applyToPeriod(HC, 't1', 'p1', false)).blockedReason).toMatch(/SMG/);
        await expect(service.applyToPeriod(HC, 't1', 'p1', true)).rejects.toBeInstanceOf(BadRequestException);
        expect(pairs.rows).toEqual([]);
    });
});
