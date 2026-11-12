import { BadRequestException, Logger } from '@nestjs/common';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { CsiPairMode, CsiPeriodPublishStatus, CsiQuestionType, CsiRateeKind, CsiRespondentMode, CsiTeamKind } from '../csi.constants';
import { Site } from '../../sites/entities/site.entity';
import { CsiAssignmentTemplatePic } from '../entities/csi-assignment-template-pic.entity';
import { CsiOrgPerson } from '../entities/csi-org-person.entity';
import { CsiPic } from '../entities/csi-pic.entity';
import { CsiPeriodRateeDimension } from '../entities/csi-period-ratee-dimension.entity';
import { CsiPeriodRatee } from '../entities/csi-period-ratee.entity';
import { CsiPeriodRaterRatee } from '../entities/csi-period-rater-ratee.entity';
import { CsiPeriodRater } from '../entities/csi-period-rater.entity';
import { CsiPeriodSite } from '../entities/csi-period-site.entity';
import { CsiPeriod } from '../entities/csi-period.entity';
import { CsiResponse } from '../entities/csi-response.entity';
import { CsiTeamMember } from '../entities/csi-team-member.entity';
import { CsiTeam } from '../entities/csi-team.entity';
import { CsiTemplateView } from '../org/csi-template-view';
import { User } from '../../users/entities/user.entity';
import { memoryTable } from './csi-memory-table.fixture';
import { CsiTemplateApplyService } from './csi-template-apply.service';

const HC = ServiceScope.HC;
const rater = (id: string, raterName: string, userId: string | null, status: 'confirmed' | 'ok' | 'no-account' | 'ambiguous' = userId ? 'ok' : 'no-account') =>
    ({ id, raterName, raterNik: null, raterJobTitle: null, userId, status, confirmed: status === 'confirmed' });
const view = (): CsiTemplateView => ({
    id: 't1', scope: 'HC', locationCode: 'SMG', name: 'CSI HC 2026 – Semarang', updatedAt: null,
    summary: { pics: 4, picsUnmatched: 1, picsWithoutRaters: 1, raters: 4, ratersConfirmed: 0, ratersOk: 2, ratersNoAccount: 1, ratersAmbiguous: 1 },
    pics: [
        { id: 'tp-rara', area: 'HC Development', serviceCode: 'HCD', picName: 'RARA', jobTitle: 'Staff', serviceFunction: 'People & Organization Development', picId: 'pic-rara', teamId: null, raterCount: 3,
            raters: [rater('a', 'ELVI CYNTHIA', 'u-elvi'), rater('b', 'ARIEF NOEGROHO', null), rater('c', 'AGUS SUBEKTI', null, 'ambiguous')] },
        { id: 'tp-mega', area: 'HC Comben', serviceCode: 'HCC', picName: 'MEGA', jobTitle: 'Supervisor', serviceFunction: 'Benefit', picId: 'pic-mega', teamId: null, raterCount: 1,
            raters: [rater('d', 'ELVI CYNTHIA', 'u-elvi')] },
        { id: 'tp-jingga', area: 'HC Services', serviceCode: 'HCS', picName: 'JINGGA', jobTitle: 'Receptionist', serviceFunction: 'Receptionist', picId: 'pic-jingga', teamId: null, raterCount: 0, raters: [] },
        { id: 'tp-ghost', area: 'HC Services', serviceCode: 'HCS', picName: 'GHOST', jobTitle: null, serviceFunction: null, picId: 'pic-ghost', teamId: null, raterCount: 1,
            raters: [rater('e', 'ELVI CYNTHIA', 'u-elvi')] },
    ],
});
/** KRW: ELVI also rates here (cross-location rater); CICI is a member of the custom team she would otherwise rate. */
const krwView = (): CsiTemplateView => ({
    id: 't2', scope: 'HC', locationCode: 'KRW', name: 'CSI HC 2026 – Karawang', updatedAt: null,
    summary: { pics: 2, picsUnmatched: 0, picsWithoutRaters: 0, raters: 5, ratersConfirmed: 1, ratersOk: 4, ratersNoAccount: 0, ratersAmbiguous: 0 },
    pics: [
        { id: 'tp-ani', area: 'HC Comben', serviceCode: 'HCC', picName: 'ANI', jobTitle: 'Staff', serviceFunction: 'Payroll', picId: 'pic-ani', teamId: null, raterCount: 2,
            raters: [rater('f', 'ELVI CYNTHIA', 'u-elvi'), rater('g', 'CICI', 'u-cici')] },
        { id: 'tp-team', area: 'HC Services', serviceCode: 'HCS', picName: 'TIM RECEPTION', jobTitle: null, serviceFunction: 'Reception', picId: null, teamId: 'team-a', raterCount: 3,
            raters: [rater('h', 'BUDI', 'u-budi', 'confirmed'), rater('i', 'CICI', 'u-cici'), rater('j', 'ELVI CYNTHIA', 'u-elvi')] },
    ],
});
const allSites = [{ id: 's-smg', code: 'SMG' }, { id: 's-krw', code: 'KRW' }, { id: 's-spj', code: 'SPJ' }];
const INPUT = { title: 'CSI HC 2026', startDate: '2026-12-01', endDate: '2026-12-31' };

describe('CsiTemplateApplyService', () => {
    let periods: ReturnType<typeof memoryTable>;
    let ratees: ReturnType<typeof memoryTable>;
    let rateeDims: ReturnType<typeof memoryTable>;
    let raters: ReturnType<typeof memoryTable>;
    let pairs: ReturnType<typeof memoryTable>;
    let teams: ReturnType<typeof memoryTable>;
    let members: ReturnType<typeof memoryTable>;
    let periodSites: ReturnType<typeof memoryTable>;
    let users: ReturnType<typeof memoryTable>;
    let responses: ReturnType<typeof memoryTable>;
    let masters: ReturnType<typeof memoryTable>;
    let templatePics: ReturnType<typeof memoryTable>;
    let directory: ReturnType<typeof memoryTable>;
    let siteRows: ReturnType<typeof memoryTable>;
    let dataSource: { transaction: jest.Mock };
    let service: CsiTemplateApplyService;
    const templates = { get: jest.fn(async (_scope: string, id: string) => (id === 't2' ? krwView() : view())) };
    const pics = [
        { id: 'pic-rara', fullName: 'RARA', jobTitle: 'Staff', serviceCode: 'HCD', serviceFunction: 'People & Organization Development', bagian: 'HCD', siteId: 's-smg', userId: 'u-rara', isActive: true },
        { id: 'pic-mega', fullName: 'MEGA', jobTitle: 'Supervisor', serviceCode: 'HCC', serviceFunction: null, bagian: 'HCC', siteId: 's-smg', userId: null, isActive: true },
        { id: 'pic-jingga', fullName: 'JINGGA', jobTitle: 'Receptionist', serviceCode: 'HCS', serviceFunction: null, bagian: 'HCS', siteId: 's-smg', userId: null, isActive: true },
        { id: 'pic-ghost', fullName: 'GHOST', jobTitle: null, serviceCode: 'HCS', serviceFunction: null, bagian: null, siteId: 's-smg', userId: null, isActive: false },
        { id: 'pic-ani', fullName: 'ANI', jobTitle: 'Staff', serviceCode: 'HCC', serviceFunction: 'Payroll', bagian: 'HCC', siteId: 's-krw', userId: null, isActive: true },
    ];
    const org = { findPics: jest.fn(async (_scope: string, ids: string[]) => masters.rows.filter((pic) => ids.includes(pic.id))) };
    const dimensions = { find: jest.fn(async () => [
        { id: 'd-k', name: 'Knowledge — Pengetahuan', shortLabel: 'Knowledge', type: CsiQuestionType.STAR, required: true, options: [], sortOrder: 0, isActive: true, scope: HC },
        { id: 'd-c', name: 'Courtesy — Kesopanan', shortLabel: 'Courtesy', type: CsiQuestionType.STAR, required: true, options: [], sortOrder: 1, isActive: true, scope: HC },
    ]) };
    const periodService = {
        create: jest.fn(async (_scope: string, dto: { siteIds: string[] }) => {
            periods.rows.push({ id: 'p-new', scope: HC, respondentMode: CsiRespondentMode.LISTED, pairMode: null, unitRules: [], cancelledAt: null, teamEnabled: false,
                sites: dto.siteIds.map((siteId) => ({ siteId, site: allSites.find((site) => site.id === siteId) })) });
            return { id: 'p-new' };
        }),
        remove: jest.fn(async () => undefined),
        overlaps: jest.fn(async (): Promise<Array<{ title: string }>> => []),
    };
    const sites = { find: jest.fn(async ({ where }: any) => allSites.filter((site) => where.code._value.includes(site.code))) };

    beforeEach(() => {
        jest.clearAllMocks();
        periods = memoryTable(); ratees = memoryTable(); rateeDims = memoryTable(); raters = memoryTable(); pairs = memoryTable();
        teams = memoryTable(); members = memoryTable(); periodSites = memoryTable(); users = memoryTable(); responses = memoryTable();
        masters = memoryTable(); templatePics = memoryTable(); directory = memoryTable(); siteRows = memoryTable();
        masters.rows.push(...pics.map((pic) => ({ ...pic, scope: HC, nik: `nik-${pic.id}` })));
        templatePics.rows.push(...[...view().pics, ...krwView().pics].map((row) => ({ id: row.id, picName: row.picName, picId: row.picId, teamId: row.teamId, picNik: null })));
        siteRows.rows.push(...allSites);
        users.rows.push({ id: 'u-elvi', siteId: 's-smg' }, { id: 'u-cici', siteId: 's-krw' }, { id: 'u-budi', siteId: 's-krw' }, { id: 'u-confirmed', siteId: 's-smg' });
        teams.rows.push({ id: 'team-a', scope: HC, kind: CsiTeamKind.CUSTOM, serviceCode: null, siteId: 's-krw', name: 'TIM RECEPTION', isActive: true });
        members.rows.push({ id: 'm1', teamId: 'team-a', userId: 'u-cici', name: 'CICI' }, { id: 'm2', teamId: 'team-a', userId: null, name: 'DEDE' });
        periods.rows.push({ id: 'p1', scope: HC, respondentMode: CsiRespondentMode.LISTED, pairMode: null, unitRules: [], publishStatus: CsiPeriodPublishStatus.PUBLISHED,
            cancelledAt: null, sites: [{ siteId: 's-smg', site: { code: 'SMG' } }] });
        const repositories = new Map<unknown, unknown>([
            [CsiPeriod, periods], [CsiPeriodRatee, ratees], [CsiPeriodRateeDimension, rateeDims], [CsiPeriodRater, raters], [CsiPeriodRaterRatee, pairs],
            [CsiTeam, teams], [CsiTeamMember, members], [CsiPeriodSite, periodSites], [User, users], [CsiResponse, responses],
            [CsiPic, masters], [CsiAssignmentTemplatePic, templatePics], [Site, siteRows],
            // The directory query filters on department in SQL; here every directory row is a candidate.
            [CsiOrgPerson, { ...directory, createQueryBuilder: () => ({ where: () => ({ getMany: async () => directory.rows }) }) }],
        ]);
        const manager = {
            getRepository: (target: unknown) => repositories.get(target),
            query: jest.fn(async () => []),
            update: jest.fn(async (target: unknown, where: any, patch: any) => {
                (repositories.get(target) as ReturnType<typeof memoryTable>).rows.filter((row) => row.id === where.id).forEach((row) => Object.assign(row, patch));
            }),
        };
        dataSource = { transaction: jest.fn(async (work: any) => work(manager)) };
        service = new CsiTemplateApplyService(templates as any, org as any, dimensions as any, sites as any, periodService as any, dataSource as any);
    });

    it('dry run only reports: PICs without raters still added (listed), inactive PICs and raters without account listed', async () => {
        const report = await service.applyToPeriod(HC, 't1', 'p1', false);
        expect(report).toMatchObject({
            committed: false, picsAdded: 3, ratersAdded: 1, pairsAdded: 2,
            picsWithoutRaters: ['JINGGA'], picsUnmatched: ['GHOST (PIC master nonaktif)'], ratersNoAccount: ['ARIEF NOEGROHO'], ratersAmbiguous: ['AGUS SUBEKTI'],
        });
        expect(ratees.rows).toEqual([]);
    });

    it('commit adds PIC ratees (service function snapshot, HC questions), raters and pairs', async () => {
        await service.applyToPeriod(HC, 't1', 'p1', true);
        expect(ratees.rows.map((row) => [row.picId, row.serviceFunction, row.kind])).toEqual([
            ['pic-rara', 'People & Organization Development', CsiRateeKind.PERSON], ['pic-mega', 'Benefit', CsiRateeKind.PERSON],
            ['pic-jingga', 'Receptionist', CsiRateeKind.PERSON],
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
        expect(ratees.rows).toHaveLength(3);
    });

    it('creates a draft period for the template location and applies the template', async () => {
        const result = await service.createPeriodFromTemplates(HC, ['t1'], { title: 'CSI HC 2026 – Semarang', startDate: '2026-12-01', endDate: '2026-12-31' }, 'admin');
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

    it('a sync does not warn "without raters" about a PIC that already has pairs in the survey', async () => {
        raters.rows.push({ id: 'old', periodId: 'p1', userId: 'u-old' });
        ratees.rows.push({ id: 'r-jingga', periodId: 'p1', picId: 'pic-jingga', kind: CsiRateeKind.PERSON });
        pairs.rows.push({ id: 'pair-old', periodId: 'p1', periodRaterId: 'old', periodRateeId: 'r-jingga' });
        expect((await service.applyToPeriod(HC, 't1', 'p1', false)).picsWithoutRaters).toEqual([]);
        pairs.rows.length = 0;
        pairs.rows.push({ id: 'pair-other', periodId: 'p1', periodRaterId: 'old', periodRateeId: 'r-elsewhere' });
        expect((await service.applyToPeriod(HC, 't1', 'p1', false)).picsWithoutRaters).toEqual(['JINGGA']);
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
        await expect(service.createPeriodFromTemplates(HC, ['t1'], { title: 'X', startDate: '2026-12-01', endDate: '2026-12-31' }, 'admin'))
            .rejects.toBeInstanceOf(BadRequestException);
        expect(periodService.create).not.toHaveBeenCalled();
    });

    it('a failing apply removes the draft it just created', async () => {
        org.findPics.mockRejectedValueOnce(new Error('boom'));
        await expect(service.createPeriodFromTemplates(HC, ['t1'], { title: 'X', startDate: '2026-12-01', endDate: '2026-12-31' }, 'admin')).rejects.toThrow('boom');
        expect(periodService.remove).toHaveBeenCalledWith(HC, 'p-new');
    });

    it('a failed draft cleanup is logged, and the original error still surfaces', async () => {
        const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
        org.findPics.mockRejectedValueOnce(new Error('boom'));
        periodService.remove.mockRejectedValueOnce(new Error('db down'));
        await expect(service.createPeriodFromTemplates(HC, ['t1'], INPUT, 'admin')).rejects.toThrow('boom');
        expect(warn).toHaveBeenCalledWith(expect.stringMatching(/p-new.*db down/));
        warn.mockRestore();
    });

    it('a cancelled survey is refused with a reason', async () => {
        periods.rows[0] = { ...periods.rows[0], cancelledAt: new Date() };
        expect((await service.applyToPeriod(HC, 't1', 'p1', false)).blockedReason).toMatch(/dibatalkan/);
        await expect(service.applyToPeriod(HC, 't1', 'p1', true)).rejects.toBeInstanceOf(BadRequestException);
        expect(pairs.rows).toEqual([]);
    });

    it('creates one survey for SMG+KRW', async () => {
        const result = await service.createPeriodFromTemplates(HC, ['t1', 't2'], INPUT, 'admin');
        expect(periodService.create).toHaveBeenCalledTimes(1);
        expect(periodService.create).toHaveBeenCalledWith(HC, expect.objectContaining({ siteIds: ['s-smg', 's-krw'], respondentMode: CsiRespondentMode.LISTED }), 'admin');
        expect(dataSource.transaction).toHaveBeenCalledTimes(1);
        expect(ratees.rows.map((row) => row.displayName)).toEqual(['RARA', 'MEGA', 'JINGGA', 'ANI', 'TIM RECEPTION']);
        expect(result).toMatchObject({ periodId: 'p-new', report: { committed: true, picsAdded: 4, teamsAdded: 1, siteAdded: null } });
    });

    it('a failing second template removes the multi-location draft', async () => {
        org.findPics.mockImplementationOnce(async (_scope: string, ids: string[]) => pics.filter((pic) => ids.includes(pic.id))).mockRejectedValueOnce(new Error('boom'));
        await expect(service.createPeriodFromTemplates(HC, ['t1', 't2'], INPUT, 'admin')).rejects.toThrow('boom');
        expect(periodService.remove).toHaveBeenCalledWith(HC, 'p-new');
    });

    it('a template whose location has no site fails before any survey is created', async () => {
        sites.find.mockResolvedValueOnce([{ id: 's-smg', code: 'SMG' }]);
        await expect(service.createPeriodFromTemplates(HC, ['t1', 't2'], INPUT, 'admin')).rejects.toThrow(/KRW/);
        expect(periodService.create).not.toHaveBeenCalled();
    });

    it('rater in two locations counted once', async () => {
        const preview = await service.previewPeriod(HC, ['t1', 't2']);
        expect(preview).toMatchObject({ committed: false, ratersAdded: 3, picsAdded: 4, teamsAdded: 1, blockedReason: null });
        expect(ratees.rows).toEqual([]);
        const created = await service.createPeriodFromTemplates(HC, ['t1', 't2'], INPUT, 'admin');
        expect(raters.rows.map((row) => row.userId).sort()).toEqual(['u-budi', 'u-cici', 'u-elvi']);
        expect(created.report.ratersAdded).toBe(3);
    });

    it('custom team becomes TEAM ratee', async () => {
        await service.createPeriodFromTemplates(HC, ['t2'], INPUT, 'admin');
        const team = ratees.rows.find((row) => row.kind === CsiRateeKind.TEAM);
        expect(team).toMatchObject({
            teamId: 'team-a', siteId: 's-krw', serviceCode: 'HCS', serviceFunction: 'Reception', displayName: 'TIM RECEPTION',
            jobTitle: null, picId: null, userId: null,
        });
        expect(rateeDims.rows.filter((row) => row.periodRateeId === team!.id).map((row) => row.shortLabel)).toEqual(['Knowledge', 'Courtesy']);
        expect(periods.rows.find((row) => row.id === 'p-new')!.teamEnabled).toBe(true);
        teams.rows[0].isActive = false;
        expect(await service.previewPeriod(HC, ['t2'])).toMatchObject({ teamsAdded: 0, picsUnmatched: ['TIM RECEPTION (tim nonaktif atau tidak ditemukan)'] });
    });

    it('member never rates own team', async () => {
        await service.createPeriodFromTemplates(HC, ['t2'], INPUT, 'admin');
        const raterUser = new Map(raters.rows.map((row) => [row.id, row.userId]));
        const ratersOf = (name: string) => {
            const ratee = ratees.rows.find((row) => row.displayName === name)!;
            return pairs.rows.filter((row) => row.periodRateeId === ratee.id).map((row) => raterUser.get(row.periodRaterId)).sort();
        };
        expect(ratersOf('TIM RECEPTION')).toEqual(['u-budi', 'u-elvi']);
        expect(ratersOf('ANI')).toEqual(['u-cici', 'u-elvi']);
    });

    it('sync adds missing site', async () => {
        periods.rows[0] = { ...periods.rows[0], sites: [{ siteId: 's-spj', site: { code: 'SPJ' } }] };
        const dry = await service.applyToPeriod(HC, 't1', 'p1', false);
        expect(dry).toMatchObject({ blockedReason: null, siteAdded: 'SMG', committed: false });
        expect(periodSites.rows).toEqual([]);
        const done = await service.applyToPeriod(HC, 't1', 'p1', true);
        expect(done).toMatchObject({ siteAdded: 'SMG', committed: true });
        expect(periodSites.rows).toEqual([expect.objectContaining({ periodId: 'p1', siteId: 's-smg' })]);
        expect(pairs.rows).toHaveLength(2);
        periods.rows[0] = { ...periods.rows[0], sites: [{ siteId: 's-smg', site: { code: 'SMG' } }] };
        expect((await service.applyToPeriod(HC, 't1', 'p1', false)).siteAdded).toBeNull();
    });

    it('sync refuses to add a site when the published survey would clash with another published survey there', async () => {
        periods.rows[0] = { ...periods.rows[0], sites: [{ siteId: 's-spj', site: { code: 'SPJ' } }] };
        periodService.overlaps.mockResolvedValueOnce([{ title: 'CSI HC Semarang' }]).mockResolvedValueOnce([{ title: 'CSI HC Semarang' }]);
        expect((await service.applyToPeriod(HC, 't1', 'p1', false)).blockedReason).toMatch(/SMG.*CSI HC Semarang/);
        await expect(service.applyToPeriod(HC, 't1', 'p1', true)).rejects.toBeInstanceOf(BadRequestException);
        expect(periodSites.rows).toEqual([]);
    });

    it('report counts unconfirmed', async () => {
        expect((await service.applyToPeriod(HC, 't1', 'p1', false)).ratersUnconfirmed).toBe(1);
        // ELVI (ok) counts once across both locations, CICI is ok, BUDI is confirmed.
        expect((await service.previewPeriod(HC, ['t1', 't2'])).ratersUnconfirmed).toBe(2);
    });

    it('two template rows linked to the same PIC become one ratee', async () => {
        const twice = view();
        twice.pics.push({ ...twice.pics[0], id: 'tp-rara-2', picName: 'RARA (dobel)', raters: [rater('k', 'BUDI', 'u-budi')] });
        templates.get.mockResolvedValueOnce(twice);
        const report = await service.applyToPeriod(HC, 't1', 'p1', true);
        expect(ratees.rows.filter((row) => row.picId === 'pic-rara')).toHaveLength(1);
        expect(report.picsAdded).toBe(3);
        expect(pairs.rows).toHaveLength(3);
    });

    it('preview reports the create-period failures as blockedReason instead of throwing', async () => {
        sites.find.mockResolvedValueOnce([{ id: 's-smg', code: 'SMG' }]);
        expect((await service.previewPeriod(HC, ['t1', 't2'])).blockedReason).toBe('Site KRW tidak ditemukan');
        dimensions.find.mockResolvedValueOnce([]);
        expect((await service.previewPeriod(HC, ['t1'])).blockedReason).toBe('Belum ada pertanyaan HC aktif. Buat template 5 dimensi dulu.');
        expect(periodService.create).not.toHaveBeenCalled();
    });

    it('reports raters whose account site is outside the survey sites (they would never see it)', async () => {
        users.rows.find((row) => row.id === 'u-budi')!.siteId = 's-spj';
        expect((await service.previewPeriod(HC, ['t2'])).ratersOutsideSites).toEqual(['BUDI', 'ELVI CYNTHIA']);
        expect((await service.previewPeriod(HC, ['t1', 't2'])).ratersOutsideSites).toEqual(['BUDI']);
        expect((await service.applyToPeriod(HC, 't1', 'p1', false)).ratersOutsideSites).toEqual([]);
        // A sync that adds the template site counts that site as covered.
        periods.rows[0] = { ...periods.rows[0], sites: [{ siteId: 's-spj', site: { code: 'SPJ' } }] };
        expect((await service.applyToPeriod(HC, 't1', 'p1', false)).ratersOutsideSites).toEqual([]);
        users.rows.find((row) => row.id === 'u-elvi')!.siteId = null;
        expect((await service.applyToPeriod(HC, 't1', 'p1', false)).ratersOutsideSites).toEqual(['ELVI CYNTHIA']);
        const created = await service.createPeriodFromTemplates(HC, ['t2'], INPUT, 'admin');
        expect(created.report.ratersOutsideSites).toEqual(['BUDI', 'ELVI CYNTHIA']);
    });

    it('the overlap check of an added site runs on the sync transaction', async () => {
        periods.rows[0] = { ...periods.rows[0], sites: [{ siteId: 's-spj', site: { code: 'SPJ' } }] };
        await service.applyToPeriod(HC, 't1', 'p1', false);
        expect(periodService.overlaps).toHaveBeenCalledWith(HC, ['s-smg'], undefined, undefined, 'p1', expect.objectContaining({ getRepository: expect.any(Function) }));
    });
    describe('every template PIC is rated (no master yet, no raters)', () => {
        /** The SMG case: four new staff in the template with no PIC master and no raters yet. */
        const NEW_STAFF = ['JINGGA FERDASIWI', 'KUSMANTO', 'AGUS SULISTYONO', 'WAHYU PURWO ANOM SASONGKO'];
        const newStaffView = (): CsiTemplateView => {
            const base = view();
            const rows = NEW_STAFF.map((picName, i) => ({
                id: `tp-new-${i}`, area: 'HC Services', serviceCode: 'HCS', picName, jobTitle: 'Staff', serviceFunction: 'General Affair', picId: null, teamId: null, raterCount: 0, raters: [],
            }));
            return { ...base, pics: [base.pics[0], ...rows] };
        };
        beforeEach(() => {
            templatePics.rows.push(...NEW_STAFF.map((picName, i) => ({ id: `tp-new-${i}`, picName, picId: null, teamId: null, picNik: i === 1 ? '1234' : null })));
            // JINGGA is in the HC directory: her master takes the directory NIK and bagian.
            directory.rows.push({ nik: '00099001', fullName: 'Jingga Ferdasiwi', bagian: 'GA MANAGEMENT', jobTitle: 'Receptionist', workLocation: 'SMG' });
            users.rows.push({ id: 'u-jingga', fullName: 'JINGGA FERDASIWI', employeeId: '00099001', siteId: 's-smg', isActive: true });
            templates.get.mockImplementation(async (_scope: string, id: string) => (id === 't2' ? krwView() : newStaffView()));
        });
        afterEach(() => templates.get.mockImplementation(async (_scope: string, id: string) => (id === 't2' ? krwView() : view())));

        it('apply creates the missing masters (site = template location) and rates them with 0 pairs and the HC questions', async () => {
            const { periodId, report } = await service.createPeriodFromTemplates(HC, ['t1'], INPUT, 'admin');
            expect(periodId).toBe('p-new');
            const created = masters.rows.filter((row) => NEW_STAFF.includes(row.fullName.toUpperCase()));
            expect(created).toHaveLength(4);
            expect(created.every((row) => row.siteId === 's-smg' && row.isActive && row.serviceCode === 'HCS')).toBe(true);
            expect(created.find((row) => row.fullName === 'Jingga Ferdasiwi')).toMatchObject({ nik: '00099001', bagian: 'GA MANAGEMENT', userId: 'u-jingga' });
            expect(created.find((row) => row.fullName === 'KUSMANTO')!.nik).toBe('00001234');
            expect(created.find((row) => row.fullName === 'AGUS SULISTYONO')!.nik).toMatch(/^TPL-[0-9A-F]{8}$/);
            // The template rows are linked, so the next apply finds the same masters.
            expect(templatePics.rows.filter((row) => row.id.startsWith('tp-new-')).every((row) => created.some((master) => master.id === row.picId))).toBe(true);
            const added = ratees.rows.filter((row) => created.some((master) => master.id === row.picId));
            expect(added).toHaveLength(4);
            expect(added.every((row) => row.siteId === 's-smg' && row.serviceFunction === 'General Affair')).toBe(true);
            expect(rateeDims.rows.filter((row) => added.some((ratee) => ratee.id === row.periodRateeId))).toHaveLength(8);
            expect(pairs.rows.filter((row) => added.some((ratee) => ratee.id === row.periodRateeId))).toEqual([]);
            expect(report).toMatchObject({ picsAdded: 5, picsUnmatched: [], picsWithoutRaters: [...NEW_STAFF].sort() });
        });

        it('a dry run creates nothing but reports the same counts; a second apply reuses the masters', async () => {
            const preview = await service.previewPeriod(HC, ['t1']);
            expect(preview).toMatchObject({ picsAdded: 5, picsWithoutRaters: [...NEW_STAFF].sort(), picsUnmatched: [] });
            expect(masters.rows).toHaveLength(pics.length);
            expect(templatePics.rows.filter((row) => row.id.startsWith('tp-new-')).every((row) => row.picId === null)).toBe(true);
            await service.applyToPeriod(HC, 't1', 'p1', true);
            const count = masters.rows.length;
            const linked = new Map(templatePics.rows.map((row) => [row.id, row.picId]));
            templates.get.mockImplementation(async () => {
                const next = newStaffView();
                return { ...next, pics: next.pics.map((row) => ({ ...row, picId: linked.get(row.id) ?? row.picId })) };
            });
            const again = await service.applyToPeriod(HC, 't1', 'p1', true);
            expect(masters.rows).toHaveLength(count);
            expect(again).toMatchObject({ picsAdded: 0 });
        });

        it('a name matching an existing master links to it instead of creating one; an inactive master stays out with its reason', async () => {
            masters.rows.push({ id: 'pic-kus', scope: HC, nik: '77', fullName: 'Kusmanto', serviceCode: 'HCS', isActive: false, siteId: 's-smg', userId: null });
            const report = await service.applyToPeriod(HC, 't1', 'p1', true);
            expect(masters.rows.filter((row) => row.fullName.toUpperCase() === 'KUSMANTO')).toHaveLength(1);
            expect(templatePics.rows.find((row) => row.id === 'tp-new-1')!.picId).toBe('pic-kus');
            expect(report.picsUnmatched).toEqual(['KUSMANTO (PIC master nonaktif)']);
            expect(ratees.rows.some((row) => row.picId === 'pic-kus')).toBe(false);
        });
    });

    describe('applyManyToPeriod (Ambil dari template)', () => {
        const nonPic = () => {
            ratees.rows.push({ id: 'r-user', periodId: 'p1', kind: CsiRateeKind.PERSON, picId: null, userId: 'u-x', displayName: 'USER X' });
            rateeDims.rows.push({ id: 'd-user', periodRateeId: 'r-user', dimensionId: 'd-k' });
            raters.rows.push({ id: 'rt-x', periodId: 'p1', userId: 'u-y' });
            pairs.rows.push({ id: 'pair-user', periodId: 'p1', periodRaterId: 'rt-x', periodRateeId: 'r-user' });
        };

        it('dry run merges the templates once (rater in two locations counted once) and adds both sites', async () => {
            periods.rows[0] = { ...periods.rows[0], publishStatus: CsiPeriodPublishStatus.DRAFT, sites: [] };
            const report = await service.applyManyToPeriod(HC, ['t1', 't2'], 'p1', false, false);
            expect(report).toMatchObject({ committed: false, picsAdded: 4, teamsAdded: 1, ratersAdded: 3, nonPicRatees: 0, blockedReason: null, siteAdded: 'SMG, KRW' });
            expect(ratees.rows).toEqual([]);
            expect(dataSource.transaction).toHaveBeenCalledTimes(1);
        });

        it('commit writes all templates in one transaction', async () => {
            const report = await service.applyManyToPeriod(HC, ['t1', 't2'], 'p1', true, false);
            expect(dataSource.transaction).toHaveBeenCalledTimes(1);
            expect(report).toMatchObject({ committed: true, picsAdded: 4, teamsAdded: 1, ratersAdded: 3 });
            expect(ratees.rows.map((row) => row.displayName)).toEqual(['RARA', 'MEGA', 'JINGGA', 'ANI', 'TIM RECEPTION']);
            expect(periodSites.rows).toEqual([expect.objectContaining({ periodId: 'p1', siteId: 's-krw' })]);
        });

        it('counts non-PIC people and, with replaceNonPic, deletes them and their pairs and dimensions before applying', async () => {
            nonPic();
            const dry = await service.applyManyToPeriod(HC, ['t1'], 'p1', false, true);
            expect(dry.nonPicRatees).toBe(1);
            expect(ratees.rows.map((row) => row.id)).toEqual(['r-user']);
            const done = await service.applyManyToPeriod(HC, ['t1'], 'p1', true, true);
            expect(done).toMatchObject({ committed: true, picsAdded: 3, nonPicRatees: 1 });
            expect(ratees.rows.some((row) => row.id === 'r-user')).toBe(false);
            expect(pairs.rows.some((row) => row.id === 'pair-user')).toBe(false);
            expect(rateeDims.rows.some((row) => row.id === 'd-user')).toBe(false);
            // A rater who only rated the removed people would leave an unmapped rater behind: removed too.
            expect(raters.rows.some((row) => row.id === 'rt-x')).toBe(false);
            expect(ratees.rows.every((row) => row.picId)).toBe(true);
        });

        it('without replaceNonPic the non-PIC people stay (add-only)', async () => {
            nonPic();
            await service.applyManyToPeriod(HC, ['t1'], 'p1', true, false);
            expect(ratees.rows.some((row) => row.id === 'r-user')).toBe(true);
        });

        it('refuses replaceNonPic once the survey has answers', async () => {
            nonPic();
            responses.rows.push({ id: 'resp', periodId: 'p1' });
            await expect(service.applyManyToPeriod(HC, ['t1'], 'p1', false, true)).rejects.toThrow('Survei sudah ada jawaban; ambil template hanya untuk survei tanpa jawaban');
            await expect(service.applyManyToPeriod(HC, ['t1'], 'p1', true, true)).rejects.toBeInstanceOf(BadRequestException);
            expect(ratees.rows.some((row) => row.id === 'r-user')).toBe(true);
        });

        it('a blocked survey is reported on dry run and refused on commit', async () => {
            periods.rows[0] = { ...periods.rows[0], cancelledAt: new Date() };
            expect((await service.applyManyToPeriod(HC, ['t1', 't2'], 'p1', false, false)).blockedReason).toMatch(/dibatalkan/);
            await expect(service.applyManyToPeriod(HC, ['t1', 't2'], 'p1', true, false)).rejects.toBeInstanceOf(BadRequestException);
            expect(ratees.rows).toEqual([]);
        });

        it('commit turns on the sections of the ratees it added (per orang for PICs, tim for custom teams)', async () => {
            periods.rows[0] = { ...periods.rows[0], teamEnabled: true, individualEnabled: false };
            await service.applyManyToPeriod(HC, ['t1'], 'p1', true, false);
            expect(periods.rows[0]).toMatchObject({ individualEnabled: true, teamEnabled: true });
            periods.rows[0] = { ...periods.rows[0], teamEnabled: false };
            await service.applyManyToPeriod(HC, ['t2'], 'p1', true, false);
            expect(periods.rows[0]).toMatchObject({ teamEnabled: true, individualEnabled: true });
        });

        it('a sync that adds no new ratee of a switched-off section leaves it off', async () => {
            periods.rows[0] = { ...periods.rows[0], publishStatus: CsiPeriodPublishStatus.DRAFT, teamEnabled: true, individualEnabled: true };
            await service.applyManyToPeriod(HC, ['t2'], 'p1', true, false);
            periods.rows[0] = { ...periods.rows[0], teamEnabled: false };
            await service.applyManyToPeriod(HC, ['t2'], 'p1', true, false);
            expect(periods.rows[0]).toMatchObject({ teamEnabled: false });
            await service.applyManyToPeriod(HC, ['t1'], 'p1', true, false);
            expect(periods.rows[0]).toMatchObject({ teamEnabled: false, individualEnabled: true });
        });

        it('a survey with answers keeps its sections as they are', async () => {
            periods.rows[0] = { ...periods.rows[0], teamEnabled: true, individualEnabled: false };
            responses.rows.push({ id: 'resp', periodId: 'p1' });
            await service.applyManyToPeriod(HC, ['t1'], 'p1', true, false);
            expect(periods.rows[0]).toMatchObject({ individualEnabled: false });
        });

        it('is HC only', async () => {
            await expect(service.applyManyToPeriod(ServiceScope.ICT, ['t1'], 'p1', false, false)).rejects.toBeInstanceOf(BadRequestException);
        });
    });
});
