import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { AuditAction } from '../../audit/entities/audit-log.entity';
import { CsiRespondentMode } from '../csi.constants';
import { CsiAssignmentTemplatePic } from '../entities/csi-assignment-template-pic.entity';
import { CsiAssignmentTemplateRater } from '../entities/csi-assignment-template-rater.entity';
import { CsiAssignmentTemplate } from '../entities/csi-assignment-template.entity';
import { CsiPeriod } from '../entities/csi-period.entity';
import { User } from '../../users/entities/user.entity';
import { CsiResponseComment } from '../entities/csi-response-comment.entity';
import { CsiResponseItem } from '../entities/csi-response-item.entity';
import { CsiResponse } from '../entities/csi-response.entity';
import { CsiReportService } from './csi-report.service';

const ICT = ServiceScope.ICT;
const HC = ServiceScope.HC;

/** Equality filter good enough for the plain where clauses the service uses (plus In()). */
function matches(row: Record<string, any>, where: Record<string, any> = {}): boolean {
    return Object.entries(where).every(([key, value]): boolean => {
        if (value && typeof value === 'object' && '_type' in value) {
            if (value._type === 'in') return value._value.includes(row[key]);
            if (value._type === 'lessThan') return row[key] < value._value;
            throw new Error(`Unsupported operator ${value._type}`);
        }
        return row[key] === value;
    });
}

function sortRows<T extends Record<string, any>>(rows: T[], order: Record<string, 'ASC' | 'DESC'> = {}) {
    const [key, direction] = Object.entries(order)[0] ?? [];
    if (!key) return rows;
    const sign = direction === 'DESC' ? -1 : 1;
    return [...rows].sort((a, b) => (a[key] < b[key] ? -sign : a[key] > b[key] ? sign : 0));
}

function memoryRepository<T extends Record<string, any>>(rows: T[] = []) {
    return {
        rows,
        find: jest.fn(async (options: any = {}) => sortRows(rows.filter((row) => matches(row, options.where)), options.order)),
        findOne: jest.fn(async (options: any = {}) => rows.find((row) => matches(row, options.where)) ?? null),
        count: jest.fn(async (options: any = {}) => rows.filter((row) => matches(row, options.where)).length),
    };
}

const itemRepository = (rows: any[]) => memoryRepository(rows);

const period = (over: Partial<CsiPeriod> = {}) => ({
    id: 'p1', scope: ICT, sites: [{ siteId: 'site-a' }] as CsiPeriod['sites'], title: 'CSI ICT Oktober', intro: 'Mohon diisi', thankYou: 'Terima kasih!',
    startDate: '2026-10-01', endDate: '2026-10-31', respondentMode: CsiRespondentMode.OPEN, createdById: 'admin', ...over,
});

const ratee1 = { id: 'r1', periodId: 'p1', kind: 'PERSON', userId: 'u1', displayName: 'Budi', jobTitle: 'Teknisi', sortOrder: 0 };
const ratee2 = { id: 'r2', periodId: 'p1', kind: 'PERSON', userId: 'u2', displayName: 'Sari', jobTitle: null, sortOrder: 1 };
const dimA = { id: 'rd1a', periodRateeId: 'r1', dimensionId: 'd1', dimensionName: 'Responsif', type: 'STAR', options: [], sortOrder: 0 };
const dimB = { id: 'rd1b', periodRateeId: 'r1', dimensionId: 'd2', dimensionName: 'Ramah', type: 'STAR', options: [], sortOrder: 1 };
const dim2A = { id: 'rd2a', periodRateeId: 'r2', dimensionId: 'd1', dimensionName: 'Responsif', type: 'STAR', options: [], sortOrder: 0 };

describe('CsiReportService', () => {
    let periods: ReturnType<typeof memoryRepository>;
    let responses: ReturnType<typeof memoryRepository>;
    let periodRaters: ReturnType<typeof memoryRepository>;
    let rateeDimensions: ReturnType<typeof memoryRepository>;
    let items: any;
    let comments: ReturnType<typeof memoryRepository>;
    let audit: { log: jest.Mock };
    let manager: any;
    let deleted: Array<{ target: unknown; criteria: any }>;
    let sla: { compute: jest.Mock };
    let subjects: { viewsFor: jest.Mock };
    let paired: Set<string> | null;
    let service: CsiReportService;
    let ratees: ReturnType<typeof memoryRepository>;
    let dataSource: any;
    let dsRepos: Map<unknown, ReturnType<typeof memoryRepository>>;

    beforeEach(() => {
        periods = memoryRepository<any>([period(), period({ id: 'p-hc', scope: HC })]);
        ratees = memoryRepository<any>([ratee2, ratee1]);
        rateeDimensions = memoryRepository<any>([dimB, dimA, dim2A]);
        periodRaters = memoryRepository<any>([]);
        responses = memoryRepository<any>([
            { id: 'resp2', periodId: 'p1', respondentId: 'x2', departmentName: 'Gudang', submittedAt: new Date('2026-10-12T03:00:00Z'), respondentName: 'Wati Nama', respondent: { id: 'x2', fullName: 'Wati', site: { name: 'Sepanjang' } } },
            { id: 'resp1', periodId: 'p1', respondentId: 'x1', departmentName: 'Keuangan', submittedAt: new Date('2026-10-10T03:00:00Z'), respondentName: 'Andi Nama', respondent: { id: 'x1', fullName: 'Andi', site: null } },
        ]);
        // Dimension A: 5 and 3 -> 4; dimension B: only 2 -> 2. Ratee 2 has no scores at all.
        items = itemRepository([
            { id: 'i1', responseId: 'resp1', periodRateeId: 'r1', periodRateeDimensionId: 'rd1a', score: 5, periodRatee: ratee1, periodRateeDimension: dimA },
            { id: 'i2', responseId: 'resp1', periodRateeId: 'r1', periodRateeDimensionId: 'rd1b', score: 2, periodRatee: ratee1, periodRateeDimension: dimB },
            { id: 'i3', responseId: 'resp2', periodRateeId: 'r1', periodRateeDimensionId: 'rd1a', score: 3, periodRatee: ratee1, periodRateeDimension: dimA },
        ]);
        comments = memoryRepository<any>([{ id: 'c1', responseId: 'resp1', periodRateeId: 'r1', comment: 'Cepat tanggap' }]);
        audit = { log: jest.fn(async () => ({})) };
        deleted = [];
        const txRepos = new Map<unknown, any>([[CsiResponse, responses], [CsiResponseItem, items], [CsiResponseComment, comments]]);
        manager = {
            getRepository: jest.fn((target: unknown) => {
                if (target === CsiPeriod) {
                    const builder: any = { params: {} };
                    builder.setLock = jest.fn(() => builder);
                    builder.where = jest.fn((_sql: string, params: any) => { builder.params = params; return builder; });
                    builder.getOne = jest.fn(async () => periods.rows.find((row) => row.id === builder.params.id) ?? null);
                    return { createQueryBuilder: jest.fn(() => builder), builder };
                }
                return txRepos.get(target);
            }),
            delete: jest.fn(async (target: unknown, criteria: any) => {
                deleted.push({ target, criteria });
                const index = responses.rows.findIndex((row) => row.id === criteria.id);
                if (index >= 0) responses.rows.splice(index, 1);
            }),
        };
        dsRepos = new Map<unknown, ReturnType<typeof memoryRepository>>([
            [CsiAssignmentTemplate, memoryRepository<any>([])], [CsiAssignmentTemplatePic, memoryRepository<any>([])],
            [CsiAssignmentTemplateRater, memoryRepository<any>([])], [User, memoryRepository<any>([])],
        ]);
        dataSource = {
            transaction: jest.fn(async (work: (m: any) => unknown) => work(manager)), query: jest.fn(async () => []),
            getRepository: jest.fn((target: unknown) => dsRepos.get(target)),
        };
        sla = { compute: jest.fn(async () => ({ basis: 0, pengisiPct: null })) };
        paired = null;
        const assignments = { ratersWithPairs: jest.fn(async () => paired) };
        subjects = { viewsFor: jest.fn(async (_scope: unknown, rows: any[]) => new Map(rows.map((row) => [row.id, {
            siteId: row.siteId ?? null, siteCode: null, photoUrl: row.id === 'r1' ? '/uploads/csi/budi.jpg' : null, tagline: null, jobTitle: null,
        }]))) };
        service = new CsiReportService(
            periods as any, ratees as any, rateeDimensions as any, periodRaters as any,
            responses as any, items, comments as any, dataSource as any, audit as any, sla as any, subjects as any,
            assignments as any,
        );
    });

    it('report and HC recap payloads carry the survey score bands (legacy rows default to 4.0/4.5)', async () => {
        expect((await service.getReport(ICT, 'p1')).scoreBands).toEqual({ fairMin: 4, goodMin: 4.5 });
        Object.assign(periods.rows[0], { scoreFairMin: 3.5, scoreGoodMin: 4.2 });
        expect((await service.getReport(ICT, 'p1')).scoreBands).toEqual({ fairMin: 3.5, goodMin: 4.2 });
        expect((await service.getHcRecap(ICT, 'p1')).scoreBands).toEqual({ fairMin: 3.5, goodMin: 4.2 });
    });

    it('HC recap includes custom-team ratees with a layanan (answers included); ICT teams and teams without layanan stay out', async () => {
        Object.assign(periods.rows[1], { teamEnabled: true, teamLabel: 'Tim' });
        ratees.rows.push(
            { id: 'h1', periodId: 'p-hc', kind: 'PERSON', picId: 'pic1', serviceCode: 'HCD', bagian: 'TA', displayName: 'Dewi', sortOrder: 0 },
            { id: 'ht', periodId: 'p-hc', kind: 'TEAM', teamId: 'team-a', serviceCode: 'HCS', serviceFunction: 'Reception', displayName: 'TIM RECEPTION', sortOrder: 1 },
            { id: 'hx', periodId: 'p-hc', kind: 'TEAM', teamId: 'team-x', serviceCode: null, displayName: 'TIM LAMA', sortOrder: 2 },
        );
        rateeDimensions.rows.push(
            { id: 'hd1', periodRateeId: 'h1', dimensionName: 'Knowledge', type: 'STAR', options: [], sortOrder: 0 },
            { id: 'hdt', periodRateeId: 'ht', dimensionName: 'Knowledge', type: 'STAR', options: [], sortOrder: 0 },
        );
        responses.rows.push({ id: 'ra', periodId: 'p-hc', respondentId: 'u-a', departmentName: 'PROD', respondentName: 'a', submittedAt: new Date('2026-10-10T03:00:00Z'), respondent: { id: 'u-a', siteId: 'site-a' } });
        items.rows.push(
            { id: 'i1', responseId: 'ra', periodRateeId: 'h1', periodRateeDimensionId: 'hd1', score: 4 },
            { id: 'it', responseId: 'ra', periodRateeId: 'ht', periodRateeDimensionId: 'hdt', score: 2 },
        );
        dataSource.query.mockImplementation(async (sql: string) => (sql.includes('csi_team_members')
            ? [{ teamId: 'team-a', userId: 'u-m1' }, { teamId: 'team-a', userId: 'u-m2' }] : []));
        const input = await service.hcRecapInput(HC, 'p-hc');
        expect(input.pics.map((pic) => [pic.name, pic.team ?? false, pic.serviceCode])).toEqual([['Dewi', false, 'HCD'], ['TIM RECEPTION', true, 'HCS']]);
        expect(input.ratings.map((rating) => rating.periodRateeId).sort()).toEqual(['h1', 'ht']);
        expect(input.ownersOf.get('ht')).toEqual(['u-m1', 'u-m2']);
        expect(input.ownersOf.get('h1')).toEqual([]);
        const recap = await service.getHcRecap(HC, 'p-hc');
        expect(recap.services.find((row) => row.key === 'p:ht')).toMatchObject({ label: 'Tim · TIM RECEPTION', all: { average: 2, ratings: 1 } });
        expect(recap.overall.dimensions.Knowledge).toBe(3);
        (service as any).ratees.rows.push({ id: 'rt', periodId: 'p1', kind: 'TEAM', serviceCode: 'OPS', displayName: 'Tim IT', sortOrder: -1 });
        Object.assign(periods.rows[0], { teamEnabled: true });
        expect((await service.hcRecapInput(ICT, 'p1')).pics.some((pic) => pic.team)).toBe(false);
    });

    it('HC executive model: layanan highlight and recap follow the site filter, recap input loaded once', async () => {
        const sites = [{ siteId: 'site-a', site: { code: 'SMG', name: 'Semarang' } }, { siteId: 'site-b', site: { code: 'SPJ', name: 'Sepanjang' } }];
        Object.assign(periods.rows[1], { sites });
        ratees.rows.push(
            { id: 'h1', periodId: 'p-hc', kind: 'PERSON', picId: 'pic1', siteId: 'site-a', serviceCode: 'HCD', bagian: 'TA', displayName: 'Dewi', sortOrder: 0 },
            { id: 'h2', periodId: 'p-hc', kind: 'PERSON', picId: 'pic2', siteId: 'site-a', serviceCode: 'HCS', bagian: 'GA', displayName: 'Sinta', sortOrder: 1 },
        );
        rateeDimensions.rows.push(
            { id: 'hd1', periodRateeId: 'h1', dimensionName: 'Knowledge', type: 'STAR', options: [], sortOrder: 0 },
            { id: 'hd2', periodRateeId: 'h2', dimensionName: 'Knowledge', type: 'STAR', options: [], sortOrder: 0 },
        );
        const response = (id: string, siteId: string) => ({ id, periodId: 'p-hc', respondentId: `u-${id}`, departmentName: 'PROD', respondentName: id, submittedAt: new Date('2026-10-10T03:00:00Z'), respondent: { id: `u-${id}`, siteId } });
        responses.rows.push(response('ra', 'site-a'), response('rb', 'site-b'));
        const item = (responseId: string, rateeId: string, score: number) => ({ id: `${responseId}${rateeId}`, responseId, periodRateeId: rateeId, periodRateeDimensionId: rateeId === 'h1' ? 'hd1' : 'hd2', score });
        // All sites: HCD (5+3)/2 = 4, HCS (3+4)/2 = 3.5. Site b only: HCD 3, HCS 4.
        items.rows.push(item('ra', 'h1', 5), item('ra', 'h2', 3), item('rb', 'h1', 3), item('rb', 'h2', 4));
        sla.compute.mockResolvedValue({ basis: 0, target: 0, responses: 0, pengisiPct: null, reporters: [] });
        const loads = jest.spyOn(service, 'hcRecapInput');
        const all = await service.getExecutiveModel(HC, 'p-hc', { matrix: {} as any });
        expect(all.serviceHighlight).toMatchObject({ best: { code: 'HCD', average: 4 }, worst: { code: 'HCS', average: 3.5 } });
        expect(loads).toHaveBeenCalledTimes(1);
        const siteB = await service.getExecutiveModel(HC, 'p-hc', { siteId: 'site-b', matrix: {} as any });
        expect(siteB.serviceHighlight).toMatchObject({ best: { code: 'HCS', average: 4 }, worst: { code: 'HCD', average: 3 } });
        expect(siteB.hcRecap?.overall.respondents).toBe(1);
        expect(loads).toHaveBeenLastCalledWith(HC, 'p-hc', 'site-b');
    });

    it('HC overall (report, site stats) uses the per-rating basis of the recap; ICT keeps the mean of response averages', async () => {
        Object.assign(periods.rows[1], { sites: [{ siteId: 'site-a', site: { code: 'SMG', name: 'Semarang' } }] });
        ratees.rows.push(
            { id: 'h1', periodId: 'p-hc', kind: 'PERSON', picId: 'pic1', siteId: 'site-a', serviceCode: 'HCD', bagian: 'TA', displayName: 'Dewi', sortOrder: 0 },
            { id: 'h2', periodId: 'p-hc', kind: 'PERSON', picId: 'pic2', siteId: 'site-a', serviceCode: 'HCS', bagian: 'GA', displayName: 'Sinta', sortOrder: 1 },
        );
        rateeDimensions.rows.push(
            { id: 'hk1', periodRateeId: 'h1', dimensionName: 'Knowledge', type: 'STAR', options: [], sortOrder: 0 },
            { id: 'hc1', periodRateeId: 'h1', dimensionName: 'Courtesy', type: 'STAR', options: [], sortOrder: 1 },
            { id: 'hk2', periodRateeId: 'h2', dimensionName: 'Knowledge', type: 'STAR', options: [], sortOrder: 0 },
        );
        const response = (id: string) => ({ id, periodId: 'p-hc', respondentId: `u-${id}`, departmentName: 'PROD', respondentName: id, submittedAt: new Date('2026-10-10T03:00:00Z'), respondent: { id: `u-${id}`, siteId: 'site-a' } });
        responses.rows.push(response('ra'), response('rb'));
        // ra: Dewi 5,5 + Sinta 1; rb: Dewi 3. Per rating (5 + 1 + 3) / 3 = 3; per response (3.67 + 3) / 2 = 3.33.
        items.rows.push(
            { id: 'x1', responseId: 'ra', periodRateeId: 'h1', periodRateeDimensionId: 'hk1', score: 5 },
            { id: 'x2', responseId: 'ra', periodRateeId: 'h1', periodRateeDimensionId: 'hc1', score: 5 },
            { id: 'x3', responseId: 'ra', periodRateeId: 'h2', periodRateeDimensionId: 'hk2', score: 1 },
            { id: 'x4', responseId: 'rb', periodRateeId: 'h1', periodRateeDimensionId: 'hk1', score: 3 },
        );
        const recap = await service.getHcRecap(HC, 'p-hc');
        expect(recap.overall.all.average).toBe(3);
        expect((await service.getReport(HC, 'p-hc')).overall).toEqual({ average: 3, respondentCount: 2 });
        const period = periods.rows[1] as CsiPeriod;
        // Dashboard rows: same average, weighted by the 3 ratings (not the 2 responses) when sites are combined.
        expect((await service.siteStats(HC, period, ['site-a'])).get('site-a')).toMatchObject({ average: 3, scoreWeight: 3, responses: 2 });
        // Executive model (PDF page 1, Excel Ringkasan / Rekap) reads the same number.
        sla.compute.mockResolvedValue({ basis: 0, target: 0, responses: 0, pengisiPct: null, reporters: [] });
        expect((await service.getExecutiveModel(HC, 'p-hc', { matrix: {} as any })).overall.average).toBe(3);
        // ICT unchanged: resp1 3.5, resp2 3 -> 3.25.
        expect((await service.getReport(ICT, 'p1')).overall.average).toBe(3.25);
    });

    it('HC executive model counts template raters of the survey sites without an iDesk account; ICT is always 0', async () => {
        Object.assign(periods.rows[1], { sites: [{ siteId: 'site-a', site: { code: 'SMG', name: 'Semarang' } }] });
        sla.compute.mockResolvedValue({ basis: 0, target: 0, responses: 0, pengisiPct: null, reporters: [] });
        dsRepos.get(CsiAssignmentTemplate)!.rows.push({ id: 'tpl-smg', scope: HC, locationCode: 'SMG' }, { id: 'tpl-krw', scope: HC, locationCode: 'KRW' });
        dsRepos.get(CsiAssignmentTemplatePic)!.rows.push({ id: 'tp1', templateId: 'tpl-smg' }, { id: 'tp2', templateId: 'tpl-smg' }, { id: 'tp3', templateId: 'tpl-krw' });
        dsRepos.get(User)!.rows.push({ id: 'u-elvi', fullName: 'Elvi', employeeId: null, isActive: true });
        const rater = (id: string, templatePicId: string, raterName: string, userId: string | null = null) =>
            ({ id, templatePicId, raterName, raterNik: null, userId, confirmedAt: userId ? new Date() : null });
        dsRepos.get(CsiAssignmentTemplateRater)!.rows.push(
            rater('a', 'tp1', 'ELVI'), rater('b', 'tp1', 'BUDI'), rater('c', 'tp2', 'BUDI'), rater('d', 'tp2', 'TONO'),
            rater('e', 'tp2', 'LINKED', 'u-elvi'), rater('f', 'tp3', 'ONLY KRW'),
        );
        // SMG only: Budi (two PICs, one person) and Tono have no account; Elvi matches, Linked is linked, KRW is not a survey site.
        expect((await service.getExecutiveModel(HC, 'p-hc', { matrix: {} as any })).templateRatersWithoutAccount).toBe(2);
        expect((await service.getExecutiveModel(ICT, 'p1', { matrix: {} as any })).templateRatersWithoutAccount).toBe(0);
    });

    it('HC executive model carries the previous period average per layanan / PIC for the Selisih column', async () => {
        Object.assign(periods.rows[1], { sites: [{ siteId: 'site-a', site: { code: 'SMG', name: 'Semarang' } }], startDate: '2026-10-01' });
        periods.rows.push({ ...period({ id: 'p-hc-old', scope: HC, startDate: '2026-07-01', endDate: '2026-07-31', sites: [{ siteId: 'site-a' }] as any }), publishStatus: 'PUBLISHED' });
        ratees.rows.push(
            { id: 'h1', periodId: 'p-hc', kind: 'PERSON', picId: 'pic1', serviceCode: 'HCD', bagian: 'TA', displayName: 'Dewi', sortOrder: 0 },
            { id: 'o1', periodId: 'p-hc-old', kind: 'PERSON', picId: 'pic1', serviceCode: 'HCD', bagian: 'TA', displayName: 'Dewi', sortOrder: 0 },
        );
        rateeDimensions.rows.push(
            { id: 'hd1', periodRateeId: 'h1', dimensionName: 'Knowledge', type: 'STAR', options: [], sortOrder: 0 },
            { id: 'od1', periodRateeId: 'o1', dimensionName: 'Knowledge', type: 'STAR', options: [], sortOrder: 0 },
        );
        responses.rows.push(
            { id: 'rn', periodId: 'p-hc', respondentId: 'u-n', departmentName: 'PROD', respondentName: 'n', submittedAt: new Date('2026-10-10T03:00:00Z'), respondent: { id: 'u-n', siteId: 'site-a' } },
            { id: 'ro', periodId: 'p-hc-old', respondentId: 'u-o', departmentName: 'PROD', respondentName: 'o', submittedAt: new Date('2026-07-10T03:00:00Z'), respondent: { id: 'u-o', siteId: 'site-a' } },
        );
        items.rows.push(
            { id: 'in', responseId: 'rn', periodRateeId: 'h1', periodRateeDimensionId: 'hd1', score: 5 },
            { id: 'io', responseId: 'ro', periodRateeId: 'o1', periodRateeDimensionId: 'od1', score: 3 },
        );
        sla.compute.mockResolvedValue({ basis: 0, target: 0, responses: 0, pengisiPct: null, reporters: [] });
        const model = await service.getExecutiveModel(HC, 'p-hc', { matrix: {} as any });
        expect(model.hasPrevious).toBe(true);
        expect(model.hcRecap?.previous).toMatchObject({ 's:HCD': 3, 'p:HCD:dewi': 3 });
        // Page 1 (overall + Selisih) uses the same per-rating basis as the recap.
        expect(model.hcRecap?.previousOverall).toBe(3);
        expect(model.overall).toMatchObject({ average: 5, previous: 3, delta: 2 });
    });

    it('ratee average is mean of response averages', async () => {
        const report = await service.getReport(ICT, 'p1');
        const budi = report.ratees[0];
        expect(budi.displayName).toBe('Budi');
        // resp1 scores 5,2 -> 3.5; resp2 scores 3 -> 3; mean of response averages = 3.25 (not the question-mean 3)
        expect(budi.average).toBe(3.25);
        expect(budi.indexPct).toBe(65);
        expect(budi.respondentCount).toBe(2);
        expect(budi.questions).toEqual([
            { name: 'Responsif', shortLabel: null, description: null, type: 'STAR', average: 4, count: 2, distribution: [
                { label: '1', count: 0 }, { label: '2', count: 0 }, { label: '3', count: 1 }, { label: '4', count: 0 }, { label: '5', count: 1 },
            ] },
            { name: 'Ramah', shortLabel: null, description: null, type: 'STAR', average: 2, count: 1, distribution: [
                { label: '1', count: 0 }, { label: '2', count: 1 }, { label: '3', count: 0 }, { label: '4', count: 0 }, { label: '5', count: 0 },
            ] },
        ]);
    });

    it('ratees of a disabled section are left out of the report', async () => {
        const team = { id: 'rt', periodId: 'p1', kind: 'TEAM', userId: null, displayName: 'Tim IT Support', jobTitle: null, sortOrder: -1 };
        (service as any).ratees.rows.push(team);
        periods.rows[0] = { ...periods.rows[0], teamEnabled: false, individualEnabled: true };
        expect((await service.getReport(ICT, 'p1')).ratees.map((row) => row.displayName)).toEqual(['Budi', 'Sari']);
        periods.rows[0] = { ...periods.rows[0], teamEnabled: true, individualEnabled: false };
        expect((await service.getReport(ICT, 'p1')).ratees.map((row) => row.displayName)).toEqual(['Tim IT Support']);
    });

    it('reset audit log keeps choice and text answers, not only scores', async () => {
        items.rows.push({ id: 'tx', responseId: 'resp1', periodRateeId: 'r1', periodRateeDimensionId: 'rd1b', score: null, answerLabel: null, answerText: 'Ramah sekali', periodRatee: ratee1, periodRateeDimension: dimB });
        await service.resetResponse(ICT, 'p1', 'resp1', 'Salah input', { id: 'admin' });
        const logged = audit.log.mock.calls[0][0].oldValue.scores;
        expect(logged).toContainEqual(expect.objectContaining({ dimension: 'Ramah', score: null, answerText: 'Ramah sekali' }));
    });

    it('report reads legacy STAR answers', async () => {
        // Legacy rows have no type/options on the snapshot and no answerLabel/answerText on items.
        for (const dimension of [dimA, dimB]) { delete (dimension as any).type; delete (dimension as any).options; }
        const report = await service.getReport(ICT, 'p1');
        expect(report.ratees[0].average).toBe(3.25);
        expect(report.ratees[0].questions[0]).toMatchObject({ type: 'STAR', average: 4, count: 2 });
        expect(report.period.sites).toEqual([{ id: 'site-a', code: null, name: null }]);
        dimA.type = 'STAR'; dimA.options = []; dimB.type = 'STAR'; dimB.options = [];
    });

    it('overall average uses all scored items', async () => {
        responses.rows.push({ id: 'resp9', periodId: 'p1', respondentId: 'x9', respondentName: 'titi yusliyanti', departmentName: 'D', submittedAt: new Date(), respondent: { fullName: 'T' } });
        [4, 5, 4, 4, 4, 5, 4, 4].forEach((score, index) => items.rows.push({
            id: `t${index}`, responseId: 'resp9', periodRateeId: 'r2', periodRateeDimensionId: 'rd2a', score,
            periodRatee: ratee2, periodRateeDimension: dim2A,
        }));
        const report = await service.getReport(ICT, 'p1');
        // responses: 3.5, 3, 4.25 -> (3.5 + 3 + 4.25) / 3 = 3.58
        expect(report.overall).toEqual({ average: 3.58, respondentCount: 3 });
        expect(report.sla).toEqual({ basis: 0, pengisiPct: null });
        expect(sla.compute).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }), [{ id: 'site-a', code: null, name: null }], 3);
    });

    it('CHOICE and TEXT questions have null average and keep their answers', async () => {
        const choice = { id: 'rd1c', periodRateeId: 'r1', dimensionId: 'd3', dimensionName: 'Channel', type: 'CHOICE', options: [{ label: 'Telepon', points: null }, { label: 'Email', points: null }], sortOrder: 2 };
        const text = { id: 'rd1t', periodRateeId: 'r1', dimensionId: 'd4', dimensionName: 'Saran', type: 'TEXT', options: [], sortOrder: 3 };
        rateeDimensions.rows.push(choice, text);
        items.rows.push(
            { id: 'c1', responseId: 'resp1', periodRateeId: 'r1', periodRateeDimensionId: 'rd1c', score: null, answerLabel: 'Email', answerText: null, periodRatee: ratee1, periodRateeDimension: choice },
            { id: 'c2', responseId: 'resp1', periodRateeId: 'r1', periodRateeDimensionId: 'rd1t', score: null, answerLabel: null, answerText: 'Mantap', periodRatee: ratee1, periodRateeDimension: text },
        );
        const report = await service.getReport(ICT, 'p1');
        const [, , channel, saran] = report.ratees[0].questions;
        expect(channel).toEqual({ name: 'Channel', shortLabel: null, description: null, type: 'CHOICE', average: null, count: 0, distribution: [{ label: 'Telepon', count: 0 }, { label: 'Email', count: 1 }] });
        expect(saran).toEqual({ name: 'Saran', shortLabel: null, description: null, type: 'TEXT', average: null, count: 0, distribution: [{ label: 'Mantap', count: 1 }] });
        expect(report.ratees[0].average).toBe(3.25);
        const detail = await service.getResponseDetail(ICT, 'p1', 'resp1');
        expect(detail.ratees[0].scores.slice(2)).toEqual([
            { dimension: 'Channel', type: 'CHOICE', score: null, answerLabel: 'Email', answerText: null },
            { dimension: 'Saran', type: 'TEXT', score: null, answerLabel: null, answerText: 'Mantap' },
        ]);
    });

    it('ratee without responses has null average', async () => {
        const report = await service.getReport(ICT, 'p1');
        const sari = report.ratees[1];
        expect(sari).toMatchObject({ displayName: 'Sari', respondentCount: 0, average: null, indexPct: null });
        expect(sari.questions).toEqual([expect.objectContaining({ name: 'Responsif', average: null, count: 0 })]);
    });

    it('report rejects period of other scope (404)', async () => {
        await expect(service.getReport(ICT, 'p-hc')).rejects.toThrow(NotFoundException);
        await expect(service.getReport(ICT, 'missing')).rejects.toThrow(NotFoundException);
    });

    it('pending lists LISTED raters without response', async () => {
        periods.rows[0].respondentMode = CsiRespondentMode.LISTED;
        periodRaters.rows.push(
            { id: 'pr1', periodId: 'p1', userId: 'x1', user: { id: 'x1', fullName: 'Andi', isActive: true, siteId: 'site-a' } },
            { id: 'pr3', periodId: 'p1', userId: 'x3', user: { id: 'x3', fullName: 'Yudi', isActive: true, siteId: 'site-a', department: { name: 'Gudang' } } },
            { id: 'pr4', periodId: 'p1', userId: 'x4', user: { id: 'x4', fullName: 'Citra', isActive: true, siteId: 'site-a' } },
        );
        const result = await service.getRespondents(ICT, 'p1');
        expect(result.mode).toBe(CsiRespondentMode.LISTED);
        expect(result.submitted.map((row) => row.respondentName)).toEqual(['Andi Nama', 'Wati Nama']);
        expect(result.submitted[0]).toEqual({
            responseId: 'resp1', userId: 'x1', respondentName: 'Andi Nama', accountName: 'Andi', departmentName: 'Keuangan', siteId: null,
            submittedAt: new Date('2026-10-10T03:00:00Z'),
        });
        expect(result.pending).toEqual([
            { userId: 'x4', fullName: 'Citra', department: null, siteId: 'site-a' },
            { userId: 'x3', fullName: 'Yudi', department: 'Gudang', siteId: 'site-a' },
        ]);
        expect(result.totals).toEqual({ submitted: 2, pending: 2 });
        // Statistic without names: raters per department (answered ones count in the total).
        expect(result.pendingByDepartment).toEqual([
            { department: 'Gudang', pending: 1, total: 1 },
            { department: 'Tanpa departemen', pending: 1, total: 2 },
        ]);
    });

    it('raters who cannot open the survey (account at another site or inactive) are neither pending nor in the statistic', async () => {
        periods.rows[0].respondentMode = CsiRespondentMode.LISTED;
        periodRaters.rows.push(
            { id: 'pr3', periodId: 'p1', userId: 'x3', user: { id: 'x3', fullName: 'Yudi', isActive: true, siteId: 'site-a' } },
            { id: 'pr5', periodId: 'p1', userId: 'x5', user: { id: 'x5', fullName: 'Lain Site', isActive: true, siteId: 'site-x' } },
            { id: 'pr6', periodId: 'p1', userId: 'x6', user: { id: 'x6', fullName: 'Nonaktif', isActive: false, siteId: 'site-a' } },
        );
        const result = await service.getRespondents(ICT, 'p1');
        expect(result.pending!.map((row) => row.userId)).toEqual(['x3']);
        expect(result.totals.pending).toBe(1);
        expect(result.pendingByDepartment).toEqual([{ department: 'Tanpa departemen', pending: 1, total: 1 }]);
    });

    it('getRespondents normalizes employeeId to 8 digits when matching csi_org_people departments', async () => {
        periods.rows[0].respondentMode = CsiRespondentMode.LISTED;
        periodRaters.rows.push({ id: 'pr3', periodId: 'p1', userId: 'x3', user: { id: 'x3', fullName: 'Yudi', employeeId: '1234', isActive: true, siteId: 'site-a' } });
        dataSource.query.mockResolvedValueOnce([{ nik: '00001234', department: 'QUALITY CONTROL' }]);
        const result = await service.getRespondents(ICT, 'p1');
        expect(dataSource.query).toHaveBeenCalledWith(expect.stringContaining('csi_org_people'), [['00001234']]);
        expect(result.pending).toEqual([{ userId: 'x3', fullName: 'Yudi', department: 'QUALITY CONTROL', siteId: 'site-a' }]);
        expect(result.pendingByDepartment).toEqual([{ department: 'QUALITY CONTROL', pending: 1, total: 1 }]);
    });

    it('HC report site filter keeps only subjects and responses of the filtered site', async () => {
        Object.assign(periods.rows[1], { sites: [{ siteId: 'site-a', site: { code: 'SMG', name: 'Semarang' } }, { siteId: 'site-b', site: { code: 'SKD', name: 'Sukodono' } }] });
        ratees.rows.push(
            { id: 'h1', periodId: 'p-hc', kind: 'PERSON', picId: 'pic1', siteId: 'site-a', serviceCode: 'HCD', bagian: 'TA', displayName: 'Dewi', sortOrder: 0 },
            { id: 'h2', periodId: 'p-hc', kind: 'PERSON', picId: 'pic2', siteId: 'site-b', serviceCode: 'HCS', bagian: 'GA', displayName: 'Sigit', sortOrder: 1 },
        );
        rateeDimensions.rows.push(
            { id: 'hd1', periodRateeId: 'h1', dimensionName: 'Knowledge', type: 'STAR', options: [], sortOrder: 0 },
            { id: 'hd2', periodRateeId: 'h2', dimensionName: 'Knowledge', type: 'STAR', options: [], sortOrder: 0 },
        );
        responses.rows.push(
            { id: 'ra', periodId: 'p-hc', respondentId: 'u-a', departmentName: 'PROD', respondentName: 'a', submittedAt: new Date('2026-10-10T03:00:00Z'), respondent: { id: 'u-a', siteId: 'site-a' } },
            { id: 'rb', periodId: 'p-hc', respondentId: 'u-b', departmentName: 'PROD', respondentName: 'b', submittedAt: new Date('2026-10-10T03:00:00Z'), respondent: { id: 'u-b', siteId: 'site-b' } },
        );
        items.rows.push(
            { id: 'i1', responseId: 'ra', periodRateeId: 'h1', periodRateeDimensionId: 'hd1', score: 5 },
            { id: 'i2', responseId: 'rb', periodRateeId: 'h2', periodRateeDimensionId: 'hd2', score: 4 },
        );
        const siteB = await service.getReport(HC, 'p-hc', 'site-b');
        expect(siteB.ratees.map((row) => row.displayName)).toEqual(['Sigit']);
        expect(siteB.overall).toEqual({ average: 4, respondentCount: 1 });
    });

    describe('pending in a mapped LISTED period', () => {
        beforeEach(() => {
            periods.rows[0].respondentMode = CsiRespondentMode.LISTED;
            periodRaters.rows.push(
                { id: 'pr3', periodId: 'p1', userId: 'x3', user: { id: 'x3', fullName: 'Yudi', isActive: true, siteId: 'site-a' } },
                { id: 'pr4', periodId: 'p1', userId: 'x4', user: { id: 'x4', fullName: 'Citra', isActive: true, siteId: 'site-a' } },
            );
        });

        it('raters without pairs are excluded when the period is mapped', async () => {
            paired = new Set(['pr3']);
            const result = await service.getRespondents(ICT, 'p1');
            expect(result.pending!.map((row) => row.userId)).toEqual(['x3']);
            expect(result.totals.pending).toBe(1);
        });

        it('no filtering when the period has no pairs', async () => {
            paired = null;
            const result = await service.getRespondents(ICT, 'p1');
            expect(result.pending!.map((row) => row.userId)).toEqual(['x4', 'x3']);
        });
    });

    it('pending is null for OPEN', async () => {
        const result = await service.getRespondents(ICT, 'p1');
        expect(result.pending).toBeNull();
        expect(result.totals).toEqual({ submitted: 2, pending: null });
        expect(result.pendingByDepartment).toBeNull();
    });

    it('response detail lists scores and comments per ratee, 404 for other period', async () => {
        const detail = await service.getResponseDetail(ICT, 'p1', 'resp1');
        expect(detail).toMatchObject({ responseId: 'resp1', respondentName: 'Andi Nama', accountName: 'Andi', areaName: null, departmentName: 'Keuangan' });
        expect(detail.ratees).toEqual([{
            periodRateeId: 'r1', kind: 'PERSON', displayName: 'Budi', jobTitle: 'Teknisi', comment: 'Cepat tanggap',
            scores: [{ dimension: 'Responsif', type: 'STAR', score: 5, answerLabel: null, answerText: null }, { dimension: 'Ramah', type: 'STAR', score: 2, answerLabel: null, answerText: null }],
        }]);
        await expect(service.getResponseDetail(ICT, 'p-hc', 'resp1')).rejects.toThrow(NotFoundException);
        await expect(service.getResponseDetail(ICT, 'p1', 'nope')).rejects.toThrow(NotFoundException);
    });

    it('reset requires reason ≥5 chars (400)', async () => {
        await expect(service.resetResponse(ICT, 'p1', 'resp1', '  abc  ', { id: 'admin' }, undefined))
            .rejects.toThrow(new BadRequestException('Alasan reset minimal 5 karakter'));
        expect(deleted).toHaveLength(0);
        expect(audit.log).not.toHaveBeenCalled();
    });

    it('reset writes audit log and allows resubmit', async () => {
        const req = { headers: {} } as any;
        await expect(service.resetResponse(ICT, 'p1', 'resp1', '  Salah isi departemen ', { id: 'admin' }, req))
            .resolves.toEqual({ reset: true });
        expect(manager.getRepository).toHaveBeenCalledWith(CsiPeriod);
        expect(deleted).toEqual([{ target: CsiResponse, criteria: { id: 'resp1' } }]);
        // Response row gone: the (period, respondent) unique slot is free, so the respondent can submit again.
        expect(await responses.count({ where: { periodId: 'p1', respondentId: 'x1' } })).toBe(0);
        expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
            userId: 'admin', action: AuditAction.CSI_RESPONSE_RESET, entityType: 'csi_response', entityId: 'resp1', request: req,
            oldValue: {
                periodId: 'p1', respondentId: 'x1', respondentName: 'Andi Nama', departmentName: 'Keuangan',
                submittedAt: new Date('2026-10-10T03:00:00Z'),
                scores: [
                    { ratee: 'Budi', dimension: 'Responsif', score: 5, answerLabel: null, answerText: null },
                    { ratee: 'Budi', dimension: 'Ramah', score: 2, answerLabel: null, answerText: null },
                ],
            },
        }));
        expect(audit.log.mock.calls[0][0].description).toContain('Salah isi departemen');
    });

    it('reset of a response outside the period is 404 and writes nothing', async () => {
        await expect(service.resetResponse(ICT, 'p1', 'nope', 'alasan valid', { id: 'admin' }, undefined)).rejects.toThrow(NotFoundException);
        await expect(service.resetResponse(ICT, 'p-hc', 'resp1', 'alasan valid', { id: 'admin' }, undefined)).rejects.toThrow(NotFoundException);
        expect(deleted).toHaveLength(0);
        expect(audit.log).not.toHaveBeenCalled();
    });

    it('reset propagates audit failure', async () => {
        audit.log.mockRejectedValueOnce(new Error('audit down'));
        await expect(service.resetResponse(ICT, 'p1', 'resp1', 'alasan valid', { id: 'admin' }, undefined)).rejects.toThrow('audit down');
    });
    describe('site filter and extras', () => {
        const SITE_PERIOD = { sites: [{ siteId: 'site-a' }, { siteId: 'site-b' }] as CsiPeriod['sites'] };
        beforeEach(() => {
            periods.rows[0] = { ...periods.rows[0], ...SITE_PERIOD };
            (service as any).ratees.rows.forEach((row: any) => { row.siteId = row.id === 'r1' ? 'site-a' : 'site-b'; });
            responses.rows.find((row) => row.id === 'resp1')!.respondent.siteId = 'site-a';
            responses.rows.find((row) => row.id === 'resp2')!.respondent.siteId = 'site-b';
        });
        afterEach(() => (service as any).ratees.rows.forEach((row: any) => { delete row.siteId; }));

        it('rater matrix uses the same site rule as the report: only respondents of the filtered site count', async () => {
            const all = await service.getRaterMatrix(ICT, 'p1');
            expect(all.rows.map((row) => row.responseId).sort()).toEqual(['resp1', 'resp2']);
            const siteA = await service.getRaterMatrix(ICT, 'p1', 'site-a');
            expect(siteA.rows.map((row) => row.responseId)).toEqual(['resp1']);
            expect(siteA.totals[0]).toEqual({ raters: 1, average: 3.5 });
        });

        it('report carries photoUrl, siteId and star distribution per ratee', async () => {
            const report = await service.getReport(ICT, 'p1');
            expect(report.ratees[0]).toMatchObject({ siteId: 'site-a', photoUrl: '/uploads/csi/budi.jpg', starDistribution: [0, 1, 1, 0, 1] });
            expect(report.previousAverage).toBeNull();
        });

        it('report lists non-empty comments per ratee (newest first) from the narrowed responses', async () => {
            comments.rows.push(
                { id: 'c2', responseId: 'resp2', periodRateeId: 'r1', comment: '  Ramah  ' },
                { id: 'c3', responseId: 'resp2', periodRateeId: 'r2', comment: '   ' },
            );
            const report = await service.getReport(ICT, 'p1');
            expect(report.ratees[0].comments).toEqual([
                { text: 'Ramah', departmentName: 'Gudang', submittedAt: new Date('2026-10-12T03:00:00Z') },
                { text: 'Cepat tanggap', departmentName: 'Keuangan', submittedAt: new Date('2026-10-10T03:00:00Z') },
            ]);
            expect(report.ratees[1].comments).toEqual([]);
            const siteA = await service.getReport(ICT, 'p1', 'site-a');
            expect(siteA.ratees[0].comments.map((row) => row.text)).toEqual(['Cepat tanggap']);
        });

        it('siteId keeps only that site ratees and answers of respondents from that site', async () => {
            const report = await service.getReport(ICT, 'p1', 'site-a');
            expect(report.ratees.map((row) => row.displayName)).toEqual(['Budi']);
            // Only resp1 (site-a): 5 and 2 -> 3.5
            expect(report.ratees[0]).toMatchObject({ average: 3.5, respondentCount: 1 });
            expect(report.overall).toEqual({ average: 3.5, respondentCount: 1 });
            expect(sla.compute).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'p1' }), [{ id: 'site-a', code: null, name: null }], 1);
        });

        it('previousAverage is the latest earlier published period sharing a site', async () => {
            periods.rows.push(
                { ...period({ id: 'p-old', startDate: '2026-07-01', endDate: '2026-07-31', sites: [{ siteId: 'site-a' }] as any }), publishStatus: 'PUBLISHED' },
                { ...period({ id: 'p-prev', startDate: '2026-08-01', endDate: '2026-09-30', sites: [{ siteId: 'site-b' }] as any }), publishStatus: 'PUBLISHED' },
                { ...period({ id: 'p-draft', startDate: '2026-09-01', endDate: '2026-09-29', sites: [{ siteId: 'site-a' }] as any }), publishStatus: 'DRAFT' },
                { ...period({ id: 'p-other', startDate: '2026-09-01', endDate: '2026-09-29', sites: [{ siteId: 'site-z' }] as any }), publishStatus: 'PUBLISHED' },
            );
            (service as any).ratees.rows.push(
                { id: 'ro', periodId: 'p-old', kind: 'PERSON', userId: 'u1', siteId: 'site-a', displayName: 'Budi', jobTitle: null, sortOrder: 0 },
                { id: 'rp', periodId: 'p-prev', kind: 'PERSON', userId: 'u2', siteId: 'site-b', displayName: 'Sari', jobTitle: null, sortOrder: 0 },
            );
            rateeDimensions.rows.push(
                { id: 'rdo', periodRateeId: 'ro', dimensionName: 'Q', type: 'STAR', options: [], sortOrder: 0 },
                { id: 'rdp', periodRateeId: 'rp', dimensionName: 'Q', type: 'STAR', options: [], sortOrder: 0 },
            );
            responses.rows.push(
                { id: 'ro1', periodId: 'p-old', respondentId: 'x1', respondent: { id: 'x1', siteId: 'site-a' } },
                { id: 'rp1', periodId: 'p-prev', respondentId: 'x2', respondent: { id: 'x2', siteId: 'site-b' } },
            );
            items.rows.push(
                { id: 'io', responseId: 'ro1', periodRateeId: 'ro', periodRateeDimensionId: 'rdo', score: 2 },
                { id: 'ip', responseId: 'rp1', periodRateeId: 'rp', periodRateeDimensionId: 'rdp', score: 4 },
            );
            expect((await service.getReport(ICT, 'p1')).previousAverage).toBe(4);
            // Filtered on site-a: the previous period must cover site-a and is averaged for site-a only.
            expect((await service.getReport(ICT, 'p1', 'site-a')).previousAverage).toBe(2);
            // A later simulation sharing the site is never the previous period of a real survey.
            // Same end date as p-prev and listed first, so without the filter it would win the (stable) sort.
            periods.rows.unshift({ ...period({ id: 'p-sim', title: 'SIMULASI – CSI', startDate: '2026-09-01', endDate: '2026-09-30', sites: [{ siteId: 'site-b' }] as any }), publishStatus: 'PUBLISHED' });
            expect((await service.getReport(ICT, 'p1')).previousAverage).toBe(4);
        });

        it('ICT delegated site (SKD -> SPJ) evaluates SPJ subjects for SKD respondents without double-counting in siteStats', async () => {
            periods.rows[0] = {
                ...periods.rows[0],
                sites: [
                    { siteId: 'site-a', site: { code: 'SPJ', name: 'Sepanjang', handledBySiteId: null } },
                    { siteId: 'site-c', site: { code: 'SKD', name: 'Sukodono', handledBySiteId: 'site-a' } },
                ] as CsiPeriod['sites'],
            };
            // resp3 is from Sukodono (site-c) rating Budi (r1, site-a SPJ) with score 4.
            responses.rows.push({
                id: 'resp3', periodId: 'p1', respondentId: 'x3', departmentName: 'QA',
                submittedAt: new Date('2026-10-13T03:00:00Z'), respondentName: 'Dina Nama',
                respondent: { id: 'x3', fullName: 'Dina', siteId: 'site-c' },
            });
            items.rows.push({ id: 'i-skd', responseId: 'resp3', periodRateeId: 'r1', periodRateeDimensionId: 'd1', score: 4 });

            const skdReport = await service.getReport(ICT, 'p1', 'site-c');
            expect(skdReport.ratees.map((r) => r.displayName)).toEqual(['Budi']);
            expect(skdReport.ratees[0]).toMatchObject({ average: 4, respondentCount: 1 });
            expect(skdReport.overall).toEqual({ average: 4, respondentCount: 1 });

            const spjReport = await service.getReport(ICT, 'p1', 'site-a');
            expect(spjReport.overall).toEqual({ average: 3.75, respondentCount: 2 });

            const stats = await service.siteStats(ICT, periods.rows[0] as CsiPeriod, ['site-a', 'site-c']);
            expect(stats.get('site-a')?.responses).toBe(1);
            expect(stats.get('site-c')?.responses).toBe(1);
            expect(stats.get('site-c')?.average).toBe(4);
            expect(stats.get('site-c')?.people).toEqual([{ userId: 'u1', displayName: 'Budi', photoUrl: '/uploads/csi/budi.jpg', average: 4 }]);
        });
    });
});
