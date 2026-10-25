import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { CsiRespondentMode } from '../csi.constants';
import { CsiPeriodRatee } from '../entities/csi-period-ratee.entity';
import { CsiPeriodRateeDimension } from '../entities/csi-period-ratee-dimension.entity';
import { CsiPeriodRater } from '../entities/csi-period-rater.entity';
import { CsiPeriod } from '../entities/csi-period.entity';
import { CsiResponse } from '../entities/csi-response.entity';
import { CsiPeriodService, computeStatus } from './csi-period.service';

const ICT = ServiceScope.ICT;
const HC = ServiceScope.HC;

/** Equality filter good enough for the plain (non-operator) where clauses the service uses. */
function matches(row: Record<string, any>, where: Record<string, any> = {}): boolean {
    return Object.entries(where).every(([key, value]): boolean => {
        if (value && typeof value === 'object' && '_type' in value) {
            if (value._type === 'in') return value._value.includes(row[key]);
            if (value._type === 'not') return row[key] !== value._value;
            if (value._type === 'lessThanOrEqual') return row[key] <= value._value;
            if (value._type === 'moreThanOrEqual') return row[key] >= value._value;
            throw new Error(`Unsupported operator ${value._type}`);
        }
        if (value && typeof value === 'object') return matches(row[key] ?? {}, value);
        return row[key] === value;
    });
}

function memoryRepository<T extends Record<string, any>>(rows: T[] = []) {
    return {
        rows,
        find: jest.fn(async (options: any = {}) => rows.filter((row) => matches(row, options.where))),
        findOne: jest.fn(async (options: any = {}) => rows.find((row) => matches(row, options.where)) ?? null),
        count: jest.fn(async (options: any = {}) => rows.filter((row) => matches(row, options.where)).length),
        save: jest.fn(async (value: any) => ({ id: value.id ?? 'saved-id', ...value })),
        delete: jest.fn().mockResolvedValue({ affected: 1 }),
        createQueryBuilder: jest.fn(() => {
            const builder: any = { params: {} };
            ['select', 'addSelect', 'groupBy', 'setLock'].forEach((name) => { builder[name] = jest.fn(() => builder); });
            builder.where = jest.fn((_sql: string, params: any = {}) => { builder.params = params; return builder; });
            builder.getRawMany = jest.fn(async () => []);
            builder.getOne = jest.fn(async () => rows.find((row) => row.id === builder.params.id) ?? null);
            return builder;
        }),
    };
}

function transactionManager(persist: (target: unknown, value: any) => void = () => undefined) {
    let sequence = 0;
    const saved: Array<{ target: unknown; value: any }> = [];
    const repositories = new Map<unknown, unknown>();
    const manager = {
        saved,
        repositories,
        getRepository: jest.fn((target: unknown) => repositories.get(target)),
        delete: jest.fn().mockResolvedValue({ affected: 1 }),
        save: jest.fn(async (target: unknown, value: any) => {
            const withIds = Array.isArray(value)
                ? value.map((row) => ({ id: row.id ?? `gen-${++sequence}`, ...row }))
                : { id: value.id ?? `gen-${++sequence}`, ...value };
            saved.push({ target, value: withIds });
            persist(target, withIds);
            return withIds;
        }),
    };
    return manager;
}

const site = { id: 'site-a', code: 'SPJ', name: 'Sepanjang' };
const basePeriod = (over: Partial<CsiPeriod> = {}): CsiPeriod => ({
    id: 'p1', scope: ICT, siteId: 'site-a', site: site as any, title: 'Q3', intro: 'Halo', thankYou: 'Terima kasih',
    startDate: '2026-07-01', endDate: '2026-09-30', respondentMode: CsiRespondentMode.OPEN, createdById: 'admin',
    createdAt: new Date(), updatedAt: new Date(), ...over,
});

describe('computeStatus', () => {
    const period = { startDate: '2026-10-01', endDate: '2026-10-31' };
    it('is ACTIVE at 23:59 WIB on endDate and ENDED at 00:00 WIB the next day', () => {
        expect(computeStatus(period, new Date('2026-10-31T23:59:00+07:00'))).toBe('ACTIVE');
        expect(computeStatus(period, new Date('2026-11-01T00:00:00+07:00'))).toBe('ENDED');
    });
    it('is UPCOMING before 00:00 WIB on startDate', () => {
        expect(computeStatus(period, new Date('2026-09-30T23:59:59+07:00'))).toBe('UPCOMING');
        expect(computeStatus(period, new Date('2026-10-01T00:00:00+07:00'))).toBe('ACTIVE');
    });
});

describe('CsiPeriodService', () => {
    let periods: ReturnType<typeof memoryRepository>;
    let ratees: ReturnType<typeof memoryRepository>;
    let rateeDimensions: ReturnType<typeof memoryRepository>;
    let periodRaters: ReturnType<typeof memoryRepository>;
    let responses: ReturnType<typeof memoryRepository>;
    let dimensions: ReturnType<typeof memoryRepository>;
    let users: ReturnType<typeof memoryRepository>;
    let sites: ReturnType<typeof memoryRepository>;
    let manager: ReturnType<typeof transactionManager>;
    let service: CsiPeriodService;

    beforeEach(() => {
        periods = memoryRepository<any>([]);
        ratees = memoryRepository<any>([]);
        rateeDimensions = memoryRepository<any>([]);
        periodRaters = memoryRepository<any>([]);
        responses = memoryRepository<any>([]);
        dimensions = memoryRepository<any>([
            { id: 'd1', scope: ICT, name: 'Responsif', isActive: true },
            { id: 'd2', scope: ICT, name: 'Ramah', isActive: true },
            { id: 'd-off', scope: ICT, name: 'Lama', isActive: false },
            { id: 'd-hc', scope: HC, name: 'HC', isActive: true },
        ]);
        users = memoryRepository<any>([
            { id: 'u1', fullName: 'Budi Baru', jobTitle: 'Staf IT', isActive: true },
            { id: 'u2', fullName: 'Sari', jobTitle: null, isActive: true },
            { id: 'u-off', fullName: 'Nonaktif', jobTitle: 'X', isActive: false },
        ]);
        sites = memoryRepository<any>([site, { id: 'site-b', code: 'SMG', name: 'Semarang' }]);
        manager = transactionManager((target, value) => { if (target === CsiPeriod) periods.rows.push(value); });
        manager.repositories.set(CsiPeriod, periods);
        manager.repositories.set(CsiResponse, responses);
        const dataSource = { transaction: jest.fn(async (work: any) => work(manager)) };
        service = new CsiPeriodService(
            periods as any, ratees as any, rateeDimensions as any, periodRaters as any, responses as any,
            dimensions as any, users as any, sites as any, dataSource as any,
        );
    });

    const createDto = (over: Record<string, any> = {}) => ({
        siteId: 'site-a', title: 'Q4', startDate: '2026-09-15', endDate: '2026-10-15', ...over,
    });
    const savedPeriod = () => manager.saved.find((entry) => entry.target === CsiPeriod)!.value;

    describe('create', () => {
        beforeEach(() => periods.rows.push(basePeriod()));

        it('rejects overlapping range for same scope+site (409)', async () => {
            await expect(service.create(ICT, createDto(), 'admin')).rejects.toBeInstanceOf(ConflictException);
            expect(manager.save).not.toHaveBeenCalled();
        });

        it('allows same range on other site', async () => {
            await service.create(ICT, createDto({ siteId: 'site-b', startDate: '2026-07-01', endDate: '2026-09-30' }), 'admin');
            expect(savedPeriod()).toMatchObject({ scope: ICT, siteId: 'site-b', createdById: 'admin' });
        });

        it('allows same range for other scope', async () => {
            await service.create(HC, createDto({ startDate: '2026-07-01', endDate: '2026-09-30' }), 'admin');
            expect(savedPeriod()).toMatchObject({ scope: HC, siteId: 'site-a' });
        });

        it('rejects unknown site (400)', async () => {
            await expect(service.create(ICT, createDto({ siteId: 'nowhere', startDate: '2026-11-01', endDate: '2026-11-30' }), 'admin'))
                .rejects.toBeInstanceOf(BadRequestException);
        });

        it('requires a title when not copying (400) and defaults texts to empty', async () => {
            const dates = { startDate: '2026-11-01', endDate: '2026-11-30' };
            await expect(service.create(ICT, createDto({ ...dates, title: undefined }), 'admin')).rejects.toBeInstanceOf(BadRequestException);
            await service.create(ICT, createDto(dates), 'admin');
            expect(savedPeriod()).toMatchObject({ title: 'Q4', intro: '', thankYou: '' });
        });

        it('default respondentMode is OPEN for ICT and LISTED for HC when omitted', async () => {
            const dates = { startDate: '2026-11-01', endDate: '2026-11-30' };
            await service.create(ICT, createDto(dates), 'admin');
            await service.create(HC, createDto(dates), 'admin');
            const modes = manager.saved.filter((entry) => entry.target === CsiPeriod).map((entry) => entry.value.respondentMode);
            expect(modes).toEqual([CsiRespondentMode.OPEN, CsiRespondentMode.LISTED]);
        });

        it('with copyFromPeriodId copies texts, ratees+dimensions, raters but not responses', async () => {
            ratees.rows.push(
                { id: 'r1', periodId: 'p1', userId: 'u1', displayName: 'Budi Lama', jobTitle: 'Lama', sortOrder: 0 },
                { id: 'r-off', periodId: 'p1', userId: 'u-off', displayName: 'Nonaktif', jobTitle: null, sortOrder: 1 },
            );
            rateeDimensions.rows.push(
                { id: 'rd1', periodRateeId: 'r1', dimensionId: 'd2', dimensionName: 'Old', sortOrder: 0 },
                { id: 'rd2', periodRateeId: 'r1', dimensionId: 'd-off', dimensionName: 'Lama', sortOrder: 1 },
                { id: 'rd3', periodRateeId: 'r-off', dimensionId: 'd1', dimensionName: 'Responsif', sortOrder: 0 },
            );
            periodRaters.rows.push({ id: 'pr1', periodId: 'p1', userId: 'u2' }, { id: 'pr2', periodId: 'p1', userId: 'u-off' });
            responses.rows.push({ id: 'resp', periodId: 'p1', respondentId: 'u2' });

            await service.create(ICT, { siteId: 'site-b', startDate: '2026-10-01', endDate: '2026-12-31', copyFromPeriodId: 'p1', intro: 'Baru' }, 'admin');

            expect(savedPeriod()).toMatchObject({ title: 'Q3', intro: 'Baru', thankYou: 'Terima kasih', siteId: 'site-b' });
            const periodId = savedPeriod().id;
            const savedRatees = manager.saved.find((entry) => entry.target === CsiPeriodRatee)!.value;
            expect(savedRatees).toEqual([expect.objectContaining({ periodId, userId: 'u1', displayName: 'Budi Baru', jobTitle: 'Staf IT', sortOrder: 0 })]);
            const savedDims = manager.saved.find((entry) => entry.target === CsiPeriodRateeDimension)!.value;
            expect(savedDims).toEqual([expect.objectContaining({ periodRateeId: savedRatees[0].id, dimensionId: 'd2', dimensionName: 'Ramah', sortOrder: 0 })]);
            expect(manager.saved.find((entry) => entry.target === CsiPeriodRater)!.value)
                .toEqual([expect.objectContaining({ periodId, userId: 'u2' })]);
            expect(manager.saved.map((entry) => entry.target)).toEqual([CsiPeriod, CsiPeriodRatee, CsiPeriodRateeDimension, CsiPeriodRater]);
        });

        it('with copyFromPeriodId from another scope throws 404', async () => {
            periods.rows.push(basePeriod({ id: 'p-hc', scope: HC }));
            await expect(service.create(ICT, createDto({ startDate: '2026-11-01', endDate: '2026-11-30', copyFromPeriodId: 'p-hc' }), 'admin'))
                .rejects.toBeInstanceOf(NotFoundException);
        });
    });

    describe('update', () => {
        beforeEach(() => {
            periods.rows.push(basePeriod(), basePeriod({ id: 'p2', startDate: '2026-10-01', endDate: '2026-12-31' }));
        });

        it('rejects endDate < startDate (400)', async () => {
            await expect(service.update(ICT, 'p1', { endDate: '2026-06-30' })).rejects.toBeInstanceOf(BadRequestException);
        });

        it('rejects extension that overlaps next period (409)', async () => {
            await expect(service.update(ICT, 'p1', { endDate: '2026-10-01' })).rejects.toBeInstanceOf(ConflictException);
        });

        it('allows text and date edits when locked, excluding itself from overlap', async () => {
            responses.rows.push({ id: 'resp', periodId: 'p1' });
            await service.update(ICT, 'p1', { title: 'Baru', endDate: '2026-09-20' });
            expect(periods.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1', title: 'Baru', endDate: '2026-09-20' }));
        });

        it('rejects period of other scope (404)', async () => {
            await expect(service.update(HC, 'p1', { title: 'X' })).rejects.toBeInstanceOf(NotFoundException);
        });
    });

    describe('assignment', () => {
        beforeEach(() => periods.rows.push(basePeriod()));

        it('setRatees snapshots displayName/jobTitle/dimensionName', async () => {
            await service.setRatees(ICT, 'p1', [{ userId: 'u1', dimensionIds: ['d2', 'd1'] }, { userId: 'u2', dimensionIds: ['d1'] }]);
            expect(manager.delete).toHaveBeenCalledWith(CsiPeriodRatee, { periodId: 'p1' });
            const savedRatees = manager.saved.find((entry) => entry.target === CsiPeriodRatee)!.value;
            expect(savedRatees).toEqual([
                expect.objectContaining({ periodId: 'p1', userId: 'u1', displayName: 'Budi Baru', jobTitle: 'Staf IT', sortOrder: 0 }),
                expect.objectContaining({ periodId: 'p1', userId: 'u2', displayName: 'Sari', jobTitle: null, sortOrder: 1 }),
            ]);
            const savedDims = manager.saved.find((entry) => entry.target === CsiPeriodRateeDimension)!.value;
            expect(savedDims).toEqual([
                expect.objectContaining({ periodRateeId: savedRatees[0].id, dimensionId: 'd2', dimensionName: 'Ramah', sortOrder: 0 }),
                expect.objectContaining({ periodRateeId: savedRatees[0].id, dimensionId: 'd1', dimensionName: 'Responsif', sortOrder: 1 }),
                expect.objectContaining({ periodRateeId: savedRatees[1].id, dimensionId: 'd1', dimensionName: 'Responsif', sortOrder: 0 }),
            ]);
        });

        it('setRatees rejects inactive dimension (400)', async () => {
            await expect(service.setRatees(ICT, 'p1', [{ userId: 'u1', dimensionIds: ['d-off'] }])).rejects.toBeInstanceOf(BadRequestException);
            await expect(service.setRatees(ICT, 'p1', [{ userId: 'u1', dimensionIds: ['d-hc'] }])).rejects.toBeInstanceOf(BadRequestException);
            expect(manager.save).not.toHaveBeenCalled();
        });

        it('setRatees rejects inactive users, duplicates and empty dimension lists (400)', async () => {
            await expect(service.setRatees(ICT, 'p1', [{ userId: 'u-off', dimensionIds: ['d1'] }])).rejects.toBeInstanceOf(BadRequestException);
            await expect(service.setRatees(ICT, 'p1', [{ userId: 'u1', dimensionIds: ['d1'] }, { userId: 'u1', dimensionIds: ['d2'] }]))
                .rejects.toBeInstanceOf(BadRequestException);
            await expect(service.setRatees(ICT, 'p1', [{ userId: 'u1', dimensionIds: [] }])).rejects.toBeInstanceOf(BadRequestException);
        });

        it('setRatees throws 409 when locked', async () => {
            responses.rows.push({ id: 'resp', periodId: 'p1' });
            await expect(service.setRatees(ICT, 'p1', [{ userId: 'u1', dimensionIds: ['d1'] }])).rejects.toThrow(new ConflictException('Periode sudah memiliki jawaban'));
            await expect(service.setRaters(ICT, 'p1', ['u2'])).rejects.toBeInstanceOf(ConflictException);
            await expect(service.remove(ICT, 'p1')).rejects.toBeInstanceOf(ConflictException);
            expect(periods.delete).not.toHaveBeenCalled();
        });

        it('setRaters replaces all and rejects inactive users', async () => {
            await expect(service.setRaters(ICT, 'p1', ['u-off'])).rejects.toBeInstanceOf(BadRequestException);
            await service.setRaters(ICT, 'p1', ['u1', 'u2', 'u1']);
            expect(manager.delete).toHaveBeenCalledWith(CsiPeriodRater, { periodId: 'p1' });
            expect(manager.saved.find((entry) => entry.target === CsiPeriodRater)!.value).toEqual([
                expect.objectContaining({ periodId: 'p1', userId: 'u1' }), expect.objectContaining({ periodId: 'p1', userId: 'u2' }),
            ]);
        });

        it('keeps inactive ratee in active period', async () => {
            ratees.rows.push({ id: 'r1', periodId: 'p1', userId: 'u-off', displayName: 'Nonaktif', jobTitle: 'X', sortOrder: 0 });
            rateeDimensions.rows.push({ id: 'rd1', periodRateeId: 'r1', dimensionId: 'd1', dimensionName: 'Responsif', sortOrder: 0 });
            const detail = await service.get(ICT, 'p1', new Date('2026-08-01T10:00:00+07:00'));
            expect(detail.status).toBe('ACTIVE');
            expect(detail.locked).toBe(false);
            expect(detail.ratees).toEqual([expect.objectContaining({ id: 'r1', userId: 'u-off',
                dimensions: [expect.objectContaining({ id: 'rd1', dimensionName: 'Responsif' })] })]);
            expect(JSON.stringify(ratees.find.mock.calls)).not.toContain('isActive');
        });

        describe('re-checks lock on the locked period row inside the transaction', () => {
            let txResponses: ReturnType<typeof memoryRepository>;
            beforeEach(() => {
                // Outside the transaction no response is visible yet; a concurrent submit commits before our lock.
                txResponses = memoryRepository<any>([{ id: 'resp', periodId: 'p1' }]);
                manager.repositories.set(CsiResponse, txResponses);
            });
            const expectLockedInTransaction = () => {
                const builder = periods.createQueryBuilder.mock.results.at(-1)!.value;
                expect(builder.setLock).toHaveBeenCalledWith('pessimistic_write');
                expect(builder.where).toHaveBeenCalledWith('p.id = :id', { id: 'p1' });
                expect(txResponses.count).toHaveBeenCalledWith({ where: { periodId: 'p1' } });
                expect(manager.delete).not.toHaveBeenCalled();
                expect(manager.save).not.toHaveBeenCalled();
            };

            it('setRatees', async () => {
                await expect(service.setRatees(ICT, 'p1', [{ userId: 'u1', dimensionIds: ['d1'] }])).rejects.toThrow(new ConflictException('Periode sudah memiliki jawaban'));
                expectLockedInTransaction();
            });

            it('setRaters', async () => {
                await expect(service.setRaters(ICT, 'p1', ['u2'])).rejects.toThrow(new ConflictException('Periode sudah memiliki jawaban'));
                expectLockedInTransaction();
            });

            it('remove', async () => {
                await expect(service.remove(ICT, 'p1')).rejects.toThrow(new ConflictException('Periode sudah memiliki jawaban'));
                expectLockedInTransaction();
                expect(periods.delete).not.toHaveBeenCalled();
            });
        });

        it('remove deletes an unlocked period within scope only', async () => {
            await expect(service.remove(HC, 'p1')).rejects.toBeInstanceOf(NotFoundException);
            await service.remove(ICT, 'p1');
            expect(periods.delete).toHaveBeenCalledWith({ id: 'p1', scope: ICT });
        });
    });
});
