import { BadRequestException, ConflictException, GoneException, NotFoundException } from '@nestjs/common';
import { LessThanOrEqual, MoreThanOrEqual, QueryFailedError } from 'typeorm';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { CsiPeriodPublishStatus, CsiRespondentMode } from '../csi.constants';
import { CsiDepartment } from '../entities/csi-department.entity';
import { CsiPeriodRateeDimension } from '../entities/csi-period-ratee-dimension.entity';
import { CsiPeriodRatee } from '../entities/csi-period-ratee.entity';
import { CsiPeriodRater } from '../entities/csi-period-rater.entity';
import { CsiPeriodSite } from '../entities/csi-period-site.entity';
import { CsiPeriod } from '../entities/csi-period.entity';
import { CsiResponseComment } from '../entities/csi-response-comment.entity';
import { CsiResponseItem } from '../entities/csi-response-item.entity';
import { CsiResponse } from '../entities/csi-response.entity';
import { CsiRespondentService } from './csi-respondent.service';

const ICT = ServiceScope.ICT;
const HC = ServiceScope.HC;
const NOW = new Date('2026-10-15T10:00:00+07:00');
const AFTER_END = new Date('2026-11-01T00:00:01+07:00');
const NOT_FOUND = new NotFoundException('Survei tidak ditemukan');

/** Equality filter good enough for the plain where clauses the service uses (plus In()). */
function matches(row: Record<string, any>, where: Record<string, any> = {}): boolean {
    return Object.entries(where).every(([key, value]): boolean => {
        if (value && typeof value === 'object' && '_type' in value) {
            if (value._type === 'in') return value._value.includes(row[key]);
            if (value._type === 'lessThanOrEqual') return row[key] <= value._value;
            if (value._type === 'moreThanOrEqual') return row[key] >= value._value;
            throw new Error(`Unsupported operator ${value._type}`);
        }
        if (Array.isArray(row[key])) return row[key].some((child: Record<string, any>) => matches(child, value));
        return row[key] === value;
    });
}

function memoryRepository<T extends Record<string, any>>(rows: T[] = []) {
    return {
        rows,
        find: jest.fn(async (options: any = {}) => rows.filter((row) => matches(row, options.where))),
        findOne: jest.fn(async (options: any = {}) => rows.find((row) => matches(row, options.where)) ?? null),
        count: jest.fn(async (options: any = {}) => rows.filter((row) => matches(row, options.where)).length),
        createQueryBuilder: jest.fn(() => {
            const builder: any = { params: {} };
            builder.setLock = jest.fn(() => builder);
            builder.where = jest.fn((_sql: string, params: any = {}) => { builder.params = params; return builder; });
            builder.getOne = jest.fn(async () => rows.find((row) => row.id === builder.params.id) ?? null);
            return builder;
        }),
    };
}

const period = (over: Partial<CsiPeriod> = {}) => ({
    id: 'p1', scope: ICT, sites: [{ siteId: 'site-a' }] as CsiPeriod['sites'], title: 'CSI ICT Oktober', intro: 'Mohon diisi', thankYou: 'Terima kasih!',
    startDate: '2026-10-01', endDate: '2026-10-31', respondentMode: CsiRespondentMode.OPEN, publishStatus: CsiPeriodPublishStatus.PUBLISHED, createdById: 'admin', ...over,
});

describe('CsiRespondentService', () => {
    let periods: ReturnType<typeof memoryRepository>;
    let ratees: ReturnType<typeof memoryRepository>;
    let rateeDimensions: ReturnType<typeof memoryRepository>;
    let periodRaters: ReturnType<typeof memoryRepository>;
    let responses: ReturnType<typeof memoryRepository>;
    let departments: ReturnType<typeof memoryRepository>;
    let users: ReturnType<typeof memoryRepository>;
    let dimensions: ReturnType<typeof memoryRepository>;
    let txResponses: ReturnType<typeof memoryRepository>;
    let txRepos: Map<unknown, ReturnType<typeof memoryRepository>>;
    let periodSiteRows: Array<{ id: string; periodId: string; siteId: string }>;
    let injectedCallsInTxn: number;
    let manager: any;
    let saved: Array<{ target: unknown; value: any }>;
    let service: CsiRespondentService;

    beforeEach(() => {
        periods = memoryRepository<any>([period()]);
        ratees = memoryRepository<any>([
            { id: 'r-me', periodId: 'p1', userId: 'me', displayName: 'Saya', jobTitle: 'Staf', sortOrder: 0 },
            { id: 'r1', periodId: 'p1', userId: 'u1', displayName: 'Budi', jobTitle: 'Teknisi', sortOrder: 1 },
            { id: 'r2', periodId: 'p1', userId: 'u2', displayName: 'Sari', jobTitle: null, sortOrder: 2 },
        ]);
        rateeDimensions = memoryRepository<any>([
            { id: 'rd-me', periodRateeId: 'r-me', dimensionId: 'd1', dimensionName: 'Responsif', sortOrder: 0 },
            { id: 'rd1a', periodRateeId: 'r1', dimensionId: 'd1', dimensionName: 'Responsif', sortOrder: 0 },
            { id: 'rd1b', periodRateeId: 'r1', dimensionId: 'd2', dimensionName: 'Ramah', sortOrder: 1 },
            { id: 'rd2a', periodRateeId: 'r2', dimensionId: 'd1', dimensionName: 'Responsif', sortOrder: 0 },
            { id: 'rd-other', periodRateeId: 'r-other', dimensionId: 'd1', dimensionName: 'Responsif', sortOrder: 0 },
        ]);
        periodRaters = memoryRepository<any>([]);
        responses = memoryRepository<any>([]);
        departments = memoryRepository<any>([
            { id: 'dep1', scope: ICT, name: 'Produksi', isActive: true, sortOrder: 0 },
            { id: 'dep-off', scope: ICT, name: 'Lama', isActive: false, sortOrder: 1 },
            { id: 'dep-hc', scope: HC, name: 'HC Dept', isActive: true, sortOrder: 0 },
        ]);
        users = memoryRepository<any>([
            { id: 'me', fullName: 'Andi Responden', siteId: 'site-a', isActive: true },
            { id: 'other-site', fullName: 'Lain', siteId: 'site-b', isActive: true },
            { id: 'no-site', fullName: 'Tanpa Site', siteId: null, isActive: true },
            { id: 'inactive', fullName: 'Nonaktif', siteId: 'site-a', isActive: false },
            { id: 'u1', fullName: 'Budi', siteId: 'site-a', isActive: true, avatarUrl: '/uploads/budi.png' },
            { id: 'u2', fullName: 'Sari', siteId: 'site-a', isActive: true, avatarUrl: null },
        ]);
        dimensions = memoryRepository<any>([
            { id: 'd1', scope: ICT, name: 'Responsif', description: 'Cepat menanggapi', isActive: true },
            { id: 'd2', scope: ICT, name: 'Ramah', description: null, isActive: true },
        ]);
        txResponses = memoryRepository<any>(responses.rows);
        saved = [];
        // Transaction-scoped repositories share rows with the injected ones but are distinct mocks,
        // so tests can tell which connection a read went through.
        periodSiteRows = [{ id: 'ps1', periodId: 'p1', siteId: 'site-a' }];
        txRepos = new Map<unknown, ReturnType<typeof memoryRepository>>([
            [CsiPeriodSite, memoryRepository<any>(periodSiteRows)],
            [CsiPeriodRatee, memoryRepository<any>(ratees.rows)],
            [CsiPeriodRateeDimension, memoryRepository<any>(rateeDimensions.rows)],
            [CsiPeriodRater, memoryRepository<any>(periodRaters.rows)],
            [CsiDepartment, memoryRepository<any>(departments.rows)],
        ]);
        manager = {
            getRepository: jest.fn((target: unknown) => {
                if (target === CsiPeriod) return periods;
                if (target === CsiResponse) return txResponses;
                if (txRepos.has(target)) return txRepos.get(target);
                throw new Error('unexpected repository');
            }),
            save: jest.fn(async (target: unknown, value: any) => {
                const withIds = Array.isArray(value)
                    ? value.map((row, index) => ({ id: `${saved.length}-${index}`, ...row }))
                    : { id: 'resp-new', ...value };
                saved.push({ target, value: withIds });
                return withIds;
            }),
        };
        const injected = [ratees, rateeDimensions, periodRaters, departments, responses, users];
        const injectedCalls = () => injected.reduce((sum, repo) => sum + repo.find.mock.calls.length
            + repo.findOne.mock.calls.length + repo.count.mock.calls.length, 0);
        injectedCallsInTxn = 0;
        const dataSource = { transaction: jest.fn(async (work: any) => {
            const before = injectedCalls();
            try {
                return await work(manager);
            } finally {
                injectedCallsInTxn += injectedCalls() - before;
            }
        }) };
        service = new CsiRespondentService(
            periods as any, ratees as any, rateeDimensions as any, periodRaters as any, responses as any,
            departments as any, users as any, dimensions as any, dataSource as any,
        );
    });

    const me = { id: 'me' };
    const fullItems = (score = 4) => ['rd1a', 'rd1b', 'rd2a'].map((periodRateeDimensionId) => ({ periodRateeDimensionId, score }));
    const dto = (over: Record<string, any> = {}) => ({ departmentId: 'dep1', items: fullItems(), comments: [], ...over });
    const savedOf = (target: unknown) => saved.find((entry) => entry.target === target)?.value;

    describe('visibility', () => {
        it('hides period of other site', async () => {
            await expect(service.getForm({ id: 'other-site' }, 'p1', NOW)).rejects.toThrow(NOT_FOUND);
            expect(await service.listActive({ id: 'other-site' }, NOW)).toEqual([]);
        });

        it('re-reads the user from DB: other site, null site, inactive or missing is never eligible', async () => {
            await expect(service.getForm({ id: 'other-site' }, 'p1', NOW)).rejects.toThrow(NOT_FOUND);
            await expect(service.getForm({ id: 'no-site' }, 'p1', NOW)).rejects.toThrow(NOT_FOUND);
            await expect(service.getForm({ id: 'inactive' }, 'p1', NOW)).rejects.toThrow(NOT_FOUND);
            await expect(service.getForm({ id: 'ghost' }, 'p1', NOW)).rejects.toThrow(NOT_FOUND);
            expect(await service.listActive({ id: 'inactive' }, NOW)).toEqual([]);
        });

        it('hides LISTED period from non-rater', async () => {
            periods.rows[0] = period({ respondentMode: CsiRespondentMode.LISTED });
            await expect(service.getForm(me, 'p1', NOW)).rejects.toThrow(NOT_FOUND);
            expect(await service.listActive(me, NOW)).toEqual([]);
            periodRaters.rows.push({ id: 'pr1', periodId: 'p1', userId: 'me' });
            await expect(service.getForm(me, 'p1', NOW)).resolves.toMatchObject({ submitted: false, id: 'p1' });
        });

        it('hides ended period', async () => {
            await expect(service.getForm(me, 'p1', AFTER_END)).rejects.toThrow(NOT_FOUND);
            await expect(service.getForm(me, 'p1', new Date('2026-09-30T23:00:00+07:00'))).rejects.toThrow(NOT_FOUND);
            expect(await service.listActive(me, AFTER_END)).toEqual([]);
        });

        it('hides period where the only ratee is the user', async () => {
            ratees.rows.splice(1);
            await expect(service.getForm(me, 'p1', NOW)).rejects.toThrow(NOT_FOUND);
            expect(await service.listActive(me, NOW)).toEqual([]);
        });

        it('draft period is not listed and getForm 404', async () => {
            periods.rows[0] = period({ publishStatus: CsiPeriodPublishStatus.DRAFT });
            expect(await service.listActive(me, NOW)).toEqual([]);
            await expect(service.getForm(me, 'p1', NOW)).rejects.toThrow(NOT_FOUND);
        });

        it('published period with no ratees is not listed', async () => {
            ratees.rows.splice(0);
            expect(await service.listActive(me, NOW)).toEqual([]);
            await expect(service.getForm(me, 'p1', NOW)).rejects.toThrow(NOT_FOUND);
        });

        it('listActive returns eligible periods with submitted flag', async () => {
            periods.rows.push(period({ id: 'p-b', sites: [{ siteId: 'site-b' }] as CsiPeriod['sites'] }));
            expect(await service.listActive(me, NOW)).toEqual([{ id: 'p1', scope: ICT, title: 'CSI ICT Oktober', submitted: false }]);
            responses.rows.push({ id: 'resp', periodId: 'p1', respondentId: 'me' });
            expect(await service.listActive(me, NOW)).toEqual([{ id: 'p1', scope: ICT, title: 'CSI ICT Oktober', submitted: true }]);
        });

        it('listActive only loads periods whose date range covers the WIB date of today', async () => {
            periods.rows.push(period({ id: 'p-old', startDate: '2025-01-01', endDate: '2025-01-31' }));
            await service.listActive(me, NOW);
            expect(periods.find).toHaveBeenCalledWith(expect.objectContaining({
                where: {
                    sites: { siteId: 'site-a' }, publishStatus: CsiPeriodPublishStatus.PUBLISHED,
                    startDate: LessThanOrEqual('2026-10-15'), endDate: MoreThanOrEqual('2026-10-15'),
                },
            }));
        });

        it('listActive loads every site of a matching multi-site period (site filter must not truncate the relation)', async () => {
            const twoSites = [{ siteId: 'site-a' }, { siteId: 'site-b' }] as CsiPeriod['sites'];
            periods.rows[0] = period({ sites: twoSites });
            // Mimic TypeORM: a where on the joined relation also truncates the relation that is loaded with it.
            periods.find.mockImplementation(async (options: any = {}) => periods.rows
                .filter((row) => matches(row, options.where))
                .map((row) => options.relations && options.where?.sites
                    ? { ...row, sites: row.sites.filter((child: any) => matches(child, options.where.sites)) } : row));
            expect(await service.listActive(me, NOW)).toEqual([expect.objectContaining({ id: 'p1' })]);
            const loaded = periods.find.mock.results.map((entry) => entry.value);
            const withRelations = periods.find.mock.calls.findIndex(([options]: any) => options.relations);
            expect((await loaded[withRelations])[0].sites).toHaveLength(2);
        });

        it('listActive uses the WIB calendar date, not the UTC one, at day boundaries', async () => {
            // 00:30 WIB on 1 Oct is still 30 Sep in UTC.
            const firstMinutesWib = new Date('2026-10-01T00:30:00+07:00');
            expect(await service.listActive(me, firstMinutesWib)).toEqual([{ id: 'p1', scope: ICT, title: 'CSI ICT Oktober', submitted: false }]);
            // 23:30 WIB on 31 Oct is still inside the period.
            expect(await service.listActive(me, new Date('2026-10-31T23:30:00+07:00'))).toHaveLength(1);
        });
    });

    describe('getForm', () => {
        it('excludes self from ratees', async () => {
            const form: any = await service.getForm(me, 'p1', NOW);
            expect(form).toEqual({
                submitted: false, id: 'p1', scope: ICT, title: 'CSI ICT Oktober', intro: 'Mohon diisi', endDate: '2026-10-31',
                respondent: { fullName: 'Andi Responden' },
                departments: [{ id: 'dep1', name: 'Produksi' }],
                ratees: [
                    { periodRateeId: 'r1', displayName: 'Budi', jobTitle: 'Teknisi', avatarUrl: '/uploads/budi.png', dimensions: [
                        { periodRateeDimensionId: 'rd1a', name: 'Responsif', description: 'Cepat menanggapi' },
                        { periodRateeDimensionId: 'rd1b', name: 'Ramah', description: null },
                    ] },
                    { periodRateeId: 'r2', displayName: 'Sari', jobTitle: null, avatarUrl: null, dimensions: [
                        { periodRateeDimensionId: 'rd2a', name: 'Responsif', description: 'Cepat menanggapi' },
                    ] },
                ],
            });
        });

        it('getForm includes endDate, avatarUrl and dimension description', async () => {
            // Deleted master dimension or missing user degrade to null instead of failing the form.
            dimensions.rows.splice(0, 1);
            users.rows.splice(users.rows.findIndex((row) => row.id === 'u1'), 1);
            const form: any = await service.getForm(me, 'p1', NOW);
            expect(form.endDate).toBe('2026-10-31');
            expect(form.ratees[0]).toMatchObject({ periodRateeId: 'r1', avatarUrl: null });
            expect(form.ratees[0].dimensions).toEqual([
                { periodRateeDimensionId: 'rd1a', name: 'Responsif', description: null },
                { periodRateeDimensionId: 'rd1b', name: 'Ramah', description: null },
            ]);
            // One batched lookup each, not one query per ratee or dimension.
            expect(dimensions.find).toHaveBeenCalledTimes(1);
            expect(users.find).toHaveBeenCalledTimes(1);
        });

        it('returns thank-you state when already submitted', async () => {
            responses.rows.push({ id: 'resp', periodId: 'p1', respondentId: 'me' });
            expect(await service.getForm(me, 'p1', NOW)).toEqual({ submitted: true, title: 'CSI ICT Oktober', thankYou: 'Terima kasih!' });
        });
    });

    describe('submit', () => {
        it('submit requires a score for every dimension of every visible ratee (400)', async () => {
            await expect(service.submit(me, 'p1', dto({ items: fullItems().slice(1) }), NOW)).rejects.toBeInstanceOf(BadRequestException);
            await expect(service.submit(me, 'p1', dto({ items: [...fullItems(), { periodRateeDimensionId: 'rd-me', score: 5 }] }), NOW))
                .rejects.toBeInstanceOf(BadRequestException);
            await expect(service.submit(me, 'p1', dto({ items: [...fullItems(), fullItems()[0]] }), NOW)).rejects.toBeInstanceOf(BadRequestException);
            expect(manager.save).not.toHaveBeenCalled();
        });

        it('submit rejects score 0 or 6 (400)', async () => {
            await expect(service.submit(me, 'p1', dto({ items: fullItems(0) }), NOW)).rejects.toBeInstanceOf(BadRequestException);
            await expect(service.submit(me, 'p1', dto({ items: fullItems(6) }), NOW)).rejects.toBeInstanceOf(BadRequestException);
            await expect(service.submit(me, 'p1', dto({ items: fullItems(3.5) }), NOW)).rejects.toBeInstanceOf(BadRequestException);
            expect(manager.save).not.toHaveBeenCalled();
        });

        it('submit rejects item of other period (400)', async () => {
            const items = [...fullItems().slice(1), { periodRateeDimensionId: 'rd-other', score: 4 }];
            await expect(service.submit(me, 'p1', dto({ items }), NOW)).rejects.toBeInstanceOf(BadRequestException);
            expect(manager.save).not.toHaveBeenCalled();
        });

        it('validates against ratees read after taking the period lock', async () => {
            const builder = memoryRepository<any>(periods.rows).createQueryBuilder();
            builder.getOne.mockImplementation(async () => {
                ratees.rows.splice(2); // a concurrent admin edit committed before our lock was granted
                return periods.rows[0];
            });
            periods.createQueryBuilder.mockReturnValueOnce(builder);
            await expect(service.submit(me, 'p1', dto(), NOW)).rejects.toBeInstanceOf(BadRequestException);
            expect(builder.setLock).toHaveBeenCalledWith('pessimistic_read');
            expect(manager.save).not.toHaveBeenCalled();
        });

        it('re-reads the period sites through the transaction after taking the lock (sites edited concurrently)', async () => {
            const builder = memoryRepository<any>(periods.rows).createQueryBuilder();
            builder.getOne.mockImplementation(async () => {
                // An admin edit that moved the survey to site-b committed before our FOR SHARE lock was granted.
                periodSiteRows.splice(0, periodSiteRows.length, { id: 'ps2', periodId: 'p1', siteId: 'site-b' });
                return periods.rows[0];
            });
            periods.createQueryBuilder.mockReturnValueOnce(builder);
            await expect(service.submit(me, 'p1', dto(), NOW)).rejects.toThrow(NOT_FOUND);
            expect(txRepos.get(CsiPeriodSite)!.find).toHaveBeenCalledWith({ where: { periodId: 'p1' } });
            expect(manager.save).not.toHaveBeenCalled();
        });

        it('submit rejects inactive department (400)', async () => {
            await expect(service.submit(me, 'p1', dto({ departmentId: 'dep-off' }), NOW)).rejects.toBeInstanceOf(BadRequestException);
            await expect(service.submit(me, 'p1', dto({ departmentId: 'dep-hc' }), NOW)).rejects.toBeInstanceOf(BadRequestException);
            expect(manager.save).not.toHaveBeenCalled();
        });

        it('submit rejects comments for invisible or duplicate ratees (400)', async () => {
            await expect(service.submit(me, 'p1', dto({ comments: [{ periodRateeId: 'r-me', comment: 'Hai' }] }), NOW))
                .rejects.toBeInstanceOf(BadRequestException);
            await expect(service.submit(me, 'p1', dto({ comments: [{ periodRateeId: 'r1', comment: 'A' }, { periodRateeId: 'r1', comment: 'B' }] }), NOW))
                .rejects.toBeInstanceOf(BadRequestException);
            await expect(service.submit(me, 'p1', dto({ comments: [{ periodRateeId: 'r1', comment: 'x'.repeat(1001) }] }), NOW))
                .rejects.toBeInstanceOf(BadRequestException);
        });

        it('submit rejects second submission (409)', async () => {
            txResponses = memoryRepository<any>([{ id: 'resp', periodId: 'p1', respondentId: 'me' }]);
            await expect(service.submit(me, 'p1', dto(), NOW)).rejects.toThrow(new ConflictException('Anda sudah mengisi survei ini'));
            const builder = periods.createQueryBuilder.mock.results.at(-1)!.value;
            expect(builder.setLock).toHaveBeenCalledWith('pessimistic_read');
            expect(manager.save).not.toHaveBeenCalled();
        });

        it('rejects concurrent duplicate via unique violation', async () => {
            manager.save.mockRejectedValueOnce(new QueryFailedError('INSERT', [], Object.assign(new Error('duplicate key'), { code: '23505' })));
            await expect(service.submit(me, 'p1', dto(), NOW)).rejects.toThrow(new ConflictException('Anda sudah mengisi survei ini'));
        });

        it('rethrows other database errors', async () => {
            manager.save.mockRejectedValueOnce(new QueryFailedError('INSERT', [], Object.assign(new Error('boom'), { code: '23503' })));
            await expect(service.submit(me, 'p1', dto(), NOW)).rejects.toBeInstanceOf(QueryFailedError);
        });

        it('submit to draft period 404', async () => {
            periods.rows[0] = period({ publishStatus: CsiPeriodPublishStatus.DRAFT });
            await expect(service.submit(me, 'p1', dto(), NOW)).rejects.toThrow(NOT_FOUND);
            expect(manager.save).not.toHaveBeenCalled();
        });

        it('submit re-checks publishStatus on the locked row (unpublished concurrently)', async () => {
            const builder = memoryRepository<any>(periods.rows).createQueryBuilder();
            builder.getOne.mockImplementation(async () => ({ ...periods.rows[0], publishStatus: CsiPeriodPublishStatus.DRAFT }));
            periods.createQueryBuilder.mockReturnValueOnce(builder);
            await expect(service.submit(me, 'p1', dto(), NOW)).rejects.toThrow(NOT_FOUND);
            expect(manager.save).not.toHaveBeenCalled();
        });

        it('rejects submit after endDate', async () => {
            await expect(service.submit(me, 'p1', dto(), AFTER_END)).rejects.toThrow(new GoneException('Periode penilaian sudah berakhir'));
            await expect(service.submit(me, 'p1', dto(), new Date('2026-09-30T23:00:00+07:00'))).rejects.toThrow(NOT_FOUND);
            await expect(service.submit({ id: 'other-site' }, 'p1', dto(), AFTER_END)).rejects.toThrow(NOT_FOUND);
            expect(manager.save).not.toHaveBeenCalled();
        });

        it('submit snapshots departmentName and stores items + non-empty trimmed comments only', async () => {
            const result = await service.submit(me, 'p1', dto({
                items: [{ periodRateeDimensionId: 'rd2a', score: 5 }, { periodRateeDimensionId: 'rd1a', score: 1 }, { periodRateeDimensionId: 'rd1b', score: 3 }],
                comments: [{ periodRateeId: 'r1', comment: '  Mantap  ' }, { periodRateeId: 'r2', comment: '   ' }],
            }), NOW);
            expect(result).toEqual({ submitted: true, thankYou: 'Terima kasih!' });
            expect(savedOf(CsiResponse)).toEqual(expect.objectContaining({
                periodId: 'p1', respondentId: 'me', departmentId: 'dep1', departmentName: 'Produksi', submittedAt: expect.any(Date),
            }));
            expect(savedOf(CsiResponseItem)).toEqual([
                expect.objectContaining({ responseId: 'resp-new', periodRateeId: 'r2', periodRateeDimensionId: 'rd2a', score: 5 }),
                expect.objectContaining({ responseId: 'resp-new', periodRateeId: 'r1', periodRateeDimensionId: 'rd1a', score: 1 }),
                expect.objectContaining({ responseId: 'resp-new', periodRateeId: 'r1', periodRateeDimensionId: 'rd1b', score: 3 }),
            ]);
            expect(savedOf(CsiResponseComment)).toEqual([expect.objectContaining({ responseId: 'resp-new', periodRateeId: 'r1', comment: 'Mantap' })]);
            expect(saved.map((entry) => entry.target)).toEqual([CsiResponse, CsiResponseItem, CsiResponseComment]);
        });

        it('submit locks the period row FOR SHARE (pessimistic_read), not FOR UPDATE', async () => {
            await service.submit(me, 'p1', dto(), NOW);
            const builder = periods.createQueryBuilder.mock.results.at(-1)!.value;
            expect(builder.setLock).toHaveBeenCalledTimes(1);
            expect(builder.setLock).toHaveBeenCalledWith('pessimistic_read');
            expect(builder.where).toHaveBeenCalledWith('p.id = :id', { id: 'p1' });
        });

        it('submit reads only through the transaction manager inside the callback', async () => {
            periods.rows[0] = period({ respondentMode: CsiRespondentMode.LISTED });
            periodRaters.rows.push({ id: 'pr1', periodId: 'p1', userId: 'me' });
            await service.submit(me, 'p1', dto(), NOW);
            expect(injectedCallsInTxn).toBe(0);
            expect(txRepos.get(CsiPeriodRater)!.findOne).toHaveBeenCalledWith({ where: { periodId: 'p1', userId: 'me' } });
            expect(txRepos.get(CsiPeriodRatee)!.find).toHaveBeenCalled();
            expect(txRepos.get(CsiPeriodRateeDimension)!.find).toHaveBeenCalled();
            expect(txRepos.get(CsiDepartment)!.findOne).toHaveBeenCalledWith({ where: { id: 'dep1', scope: ICT, isActive: true } });
            expect(manager.getRepository).toHaveBeenCalledWith(CsiResponse);
        });
    });
});
