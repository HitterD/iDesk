import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { In, Not, QueryFailedError } from 'typeorm';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { CsiPeriodPublishStatus, CsiQuestionType, CsiRateeKind, CsiRespondentMode } from '../csi.constants';
import { CsiPeriodRatee } from '../entities/csi-period-ratee.entity';
import { CsiPeriodRateeDimension } from '../entities/csi-period-ratee-dimension.entity';
import { CsiPeriodRater } from '../entities/csi-period-rater.entity';
import { CsiPeriodSite } from '../entities/csi-period-site.entity';
import { CsiPeriod } from '../entities/csi-period.entity';
import { CsiResponse } from '../entities/csi-response.entity';
import { CsiPeriodService, computeReadiness, computeStatus } from './csi-period.service';

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
        if (Array.isArray(row[key])) return row[key].some((child: Record<string, any>) => matches(child, value));
        if (value && typeof value === 'object') return matches(row[key] ?? {}, value);
        return row[key] === value;
    });
}

/** Mimics TypeORM: filtering on a to-many relation that is also loaded truncates the loaded relation. */
function truncateRelations(row: Record<string, any>, options: any) {
    if (!options.relations) return row;
    const copy = { ...row };
    Object.entries(options.where ?? {}).forEach(([key, value]) => {
        if (Array.isArray(row[key]) && value && typeof value === 'object' && !('_type' in value)) {
            copy[key] = row[key].filter((child: Record<string, any>) => matches(child, value as Record<string, any>));
        }
    });
    return copy;
}

function memoryRepository<T extends Record<string, any>>(rows: T[] = []) {
    return {
        rows,
        find: jest.fn(async (options: any = {}) => rows.filter((row) => matches(row, options.where)).map((row) => truncateRelations(row, options))),
        findOne: jest.fn(async (options: any = {}) => rows.find((row) => matches(row, options.where)) ?? null),
        count: jest.fn(async (options: any = {}) => rows.filter((row) => matches(row, options.where)).length),
        save: jest.fn(async (value: any) => ({ id: value.id ?? 'saved-id', ...value })),
        update: jest.fn(async (where: any, patch: any) => {
            rows.forEach((row, index) => { if (matches(row, where)) rows[index] = { ...row, ...patch }; });
            return { affected: 1 };
        }),
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
const siteB = { id: 'site-b', code: 'SMG', name: 'Semarang' };
const STAR_SNAPSHOT = { type: CsiQuestionType.STAR, required: true, options: [] };
const SCALE_OPTIONS = [{ label: 'Puas', points: 5 }, { label: 'Tidak puas', points: 1 }];
const basePeriod = (over: Partial<CsiPeriod> = {}): CsiPeriod => ({
    id: 'p1', scope: ICT, sites: [{ siteId: 'site-a', site } as any], title: 'Q3', intro: 'Halo', thankYou: 'Terima kasih',
    startDate: '2026-07-01', endDate: '2026-09-30', respondentMode: CsiRespondentMode.OPEN, publishStatus: CsiPeriodPublishStatus.PUBLISHED, createdById: 'admin',
    teamEnabled: false, teamLabel: 'Tim IT Support', individualEnabled: true, slaTargetPct: 80,
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

describe('computeReadiness', () => {
    const complete = {
        ratees: [{ dimensions: [{}] }], raterCount: 1, respondentMode: CsiRespondentMode.LISTED, activeDepartmentCount: 1,
        teamEnabled: false, individualEnabled: true, teamQuestionCount: 0,
    };
    const failing = (input: Parameters<typeof computeReadiness>[0]) =>
        computeReadiness(input).checks.filter((check) => !check.ok).map((check) => check.key);

    it('is ready when every check passes and uses the exact labels', () => {
        expect(computeReadiness(complete)).toEqual({ ready: true, checks: [
            { key: 'ratees', ok: true, label: 'Minimal 1 orang dinilai' },
            { key: 'dimensions', ok: true, label: 'Setiap orang punya minimal 1 dimensi' },
            { key: 'departments', ok: true, label: 'Minimal 1 departemen aktif' },
            { key: 'raters', ok: true, label: 'Minimal 1 penilai (mode terdaftar)' },
        ] });
    });

    it('flags missing ratees, empty dimensions, no departments, no raters for LISTED only', () => {
        // No ratees is not "every ratee has a dimension" (no vacuous truth).
        expect(failing({ ...complete, ratees: [] })).toEqual(['ratees', 'dimensions']);
        expect(failing({ ...complete, ratees: [{ dimensions: [{}] }, { dimensions: [] }] })).toEqual(['dimensions']);
        expect(failing({ ...complete, activeDepartmentCount: 0 })).toEqual(['departments']);
        expect(failing({ ...complete, raterCount: 0 })).toEqual(['raters']);
        expect(computeReadiness({ ...complete, raterCount: 0 }).ready).toBe(false);
        const open = computeReadiness({ ...complete, raterCount: 0, respondentMode: CsiRespondentMode.OPEN });
        expect(open.ready).toBe(true);
        expect(open.checks.map((check) => check.key)).toEqual(['ratees', 'dimensions', 'departments']);
    });

    it('readiness includes team check only when enabled and skips ratees when individual disabled', () => {
        const teamOnly = { ...complete, ratees: [], teamEnabled: true, individualEnabled: false };
        expect(computeReadiness({ ...teamOnly, teamQuestionCount: 0 }).checks).toEqual([
            { key: 'team', ok: false, label: 'Penilaian tim punya minimal 1 pertanyaan' },
            { key: 'departments', ok: true, label: 'Minimal 1 departemen aktif' },
            { key: 'raters', ok: true, label: 'Minimal 1 penilai (mode terdaftar)' },
        ]);
        expect(computeReadiness({ ...teamOnly, teamQuestionCount: 2 }).ready).toBe(true);
        const both = computeReadiness({ ...complete, teamEnabled: true, teamQuestionCount: 1 });
        expect(both.checks.map((check) => check.key)).toEqual(['team', 'ratees', 'dimensions', 'departments', 'raters']);
        expect(both.ready).toBe(true);
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
    let departments: ReturnType<typeof memoryRepository>;
    let manager: ReturnType<typeof transactionManager>;
    let assignments: { applyTemplate: jest.Mock; copyPairs: jest.Mock; hasPairs: jest.Mock };
    let subjects: { createTeam: jest.Mock };
    let service: CsiPeriodService;

    beforeEach(() => {
        periods = memoryRepository<any>([]);
        ratees = memoryRepository<any>([]);
        rateeDimensions = memoryRepository<any>([]);
        periodRaters = memoryRepository<any>([]);
        responses = memoryRepository<any>([]);
        dimensions = memoryRepository<any>([
            { id: 'd1', scope: ICT, name: 'Responsif', isActive: true, ...STAR_SNAPSHOT },
            { id: 'd2', scope: ICT, name: 'Ramah', shortLabel: 'Keramahan', isActive: true, type: CsiQuestionType.SCALE, required: false, options: SCALE_OPTIONS },
            { id: 'd-off', scope: ICT, name: 'Lama', isActive: false, ...STAR_SNAPSHOT },
            { id: 'd-hc', scope: HC, name: 'HC', isActive: true, ...STAR_SNAPSHOT },
        ]);
        users = memoryRepository<any>([
            { id: 'u1', fullName: 'Budi Baru', jobTitle: 'Staf IT', siteId: 'site-a', isActive: true },
            { id: 'u2', fullName: 'Sari', jobTitle: null, siteId: 'site-b', isActive: true },
            { id: 'u-off', fullName: 'Nonaktif', jobTitle: 'X', isActive: false },
        ]);
        sites = memoryRepository<any>([site, siteB]);
        departments = memoryRepository<any>([
            { id: 'dep1', scope: ICT, name: 'Produksi', isActive: true },
            { id: 'dep-off', scope: ICT, name: 'Lama', isActive: false },
        ]);
        manager = transactionManager((target, value) => { if (target === CsiPeriod) periods.rows.push(value); });
        manager.repositories.set(CsiPeriod, periods);
        manager.repositories.set(CsiResponse, responses);
        manager.repositories.set(CsiPeriodRatee, ratees);
        manager.repositories.set(CsiPeriodRater, periodRaters);
        const dataSource = { transaction: jest.fn(async (work: any) => work(manager)) };
        assignments = {
            applyTemplate: jest.fn().mockResolvedValue(undefined), copyPairs: jest.fn().mockResolvedValue(undefined),
            hasPairs: jest.fn().mockResolvedValue(false),
        };
        const teamNames: Record<string, string> = { 'site-a': 'Tim Sepanjang', 'site-b': 'Tim Semarang' };
        subjects = { createTeam: jest.fn(async (_scope: string, siteId: string) => ({ teamId: `team-${siteId}`, name: teamNames[siteId], siteId })) };
        service = new CsiPeriodService(
            periods as any, ratees as any, rateeDimensions as any, periodRaters as any, responses as any,
            dimensions as any, users as any, sites as any, departments as any, dataSource as any,
            assignments as any, subjects as any,
        );
    });

    const createDto = (over: Record<string, any> = {}) => ({
        siteIds: ['site-a'], title: 'Q4', startDate: '2026-09-15', endDate: '2026-10-15', ...over,
    });
    const savedPeriod = () => manager.saved.find((entry) => entry.target === CsiPeriod)!.value;

    describe('create', () => {
        beforeEach(() => periods.rows.push(basePeriod()));

        it('a new draft may overlap a published period (the clash is enforced at publish)', async () => {
            await service.create(ICT, createDto(), 'admin');
            expect(savedPeriod()).toMatchObject({ publishStatus: CsiPeriodPublishStatus.DRAFT });
        });

        it('overlaps() names the published survey sharing a site and dates; drafts and other scopes never count', async () => {
            periods.rows.push(basePeriod({ id: 'draft', publishStatus: CsiPeriodPublishStatus.DRAFT }));
            const clashes = await service.overlaps(ICT, ['site-a'], '2026-09-15', '2026-10-15');
            expect(clashes.map((row) => row.id)).toEqual(['p1']);
            expect(clashes[0]).toMatchObject({ title: 'Q3', startDate: '2026-07-01', endDate: '2026-09-30' });
            expect(await service.overlaps(HC, ['site-a'], '2026-09-15', '2026-10-15')).toEqual([]);
            expect(await service.overlaps(ICT, ['site-a'], '2026-09-15', '2026-10-15', 'p1')).toEqual([]);
            expect(await service.overlaps(ICT, ['site-a'], '2026-10-15', '2026-09-15')).toEqual([]);
        });

        it('allows same range on other site', async () => {
            await service.create(ICT, createDto({ siteIds: ['site-b'], startDate: '2026-07-01', endDate: '2026-09-30' }), 'admin');
            expect(savedPeriod()).toMatchObject({ scope: ICT, sites: [{ siteId: 'site-b' }], createdById: 'admin' });
        });

        it('allows same range for other scope', async () => {
            await service.create(HC, createDto({ startDate: '2026-07-01', endDate: '2026-09-30' }), 'admin');
            expect(savedPeriod()).toMatchObject({ scope: HC, sites: [{ siteId: 'site-a' }] });
        });

        it('create stores DRAFT', async () => {
            await service.create(ICT, createDto({ startDate: '2026-11-01', endDate: '2026-11-30' }), 'admin');
            expect(savedPeriod()).toMatchObject({ publishStatus: CsiPeriodPublishStatus.DRAFT });
        });

        it('rejects unknown site (400)', async () => {
            await expect(service.create(ICT, createDto({ siteIds: ['site-a', 'nowhere'], startDate: '2026-11-01', endDate: '2026-11-30' }), 'admin'))
                .rejects.toBeInstanceOf(BadRequestException);
        });

        it('requires a title when not copying (400) and defaults texts to empty', async () => {
            const dates = { startDate: '2026-11-01', endDate: '2026-11-30' };
            await expect(service.create(ICT, createDto({ ...dates, title: undefined }), 'admin')).rejects.toBeInstanceOf(BadRequestException);
            await service.create(ICT, createDto(dates), 'admin');
            expect(savedPeriod()).toMatchObject({ title: 'Q4', intro: '', thankYou: '' });
        });

        it('new ICT period defaults to LISTED (HC too) when omitted', async () => {
            const dates = { startDate: '2026-11-01', endDate: '2026-11-30' };
            await service.create(ICT, createDto(dates), 'admin');
            await service.create(HC, createDto(dates), 'admin');
            const modes = manager.saved.filter((entry) => entry.target === CsiPeriod).map((entry) => entry.value.respondentMode);
            expect(modes).toEqual([CsiRespondentMode.LISTED, CsiRespondentMode.LISTED]);
        });

        it('a copied period takes the source pairs at create; the template waits for members (see assignment spec)', async () => {
            await service.create(ICT, createDto({ startDate: '2026-11-01', endDate: '2026-11-30' }), 'admin');
            expect(assignments.copyPairs).not.toHaveBeenCalled();
            expect(assignments.applyTemplate).not.toHaveBeenCalled();
            manager.saved.length = 0;
            await service.create(ICT, { startDate: '2026-12-01', endDate: '2026-12-31', copyFromPeriodId: 'p1' }, 'admin');
            expect(assignments.copyPairs).toHaveBeenCalledWith(ICT, 'p1', savedPeriod().id);
            expect(assignments.applyTemplate).not.toHaveBeenCalled();
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

            await service.create(ICT, { siteIds: ['site-b'], startDate: '2026-10-01', endDate: '2026-12-31', copyFromPeriodId: 'p1', intro: 'Baru' }, 'admin');

            expect(savedPeriod()).toMatchObject({ title: 'Q3', intro: 'Baru', thankYou: 'Terima kasih', sites: [{ siteId: 'site-b' }] });
            const periodId = savedPeriod().id;
            const savedRatees = manager.saved.find((entry) => entry.target === CsiPeriodRatee)!.value;
            expect(savedRatees).toEqual([expect.objectContaining({
                periodId, userId: 'u1', displayName: 'Budi Baru', jobTitle: 'Staf IT', sortOrder: 0, siteId: 'site-a', teamId: null, photoUrl: null, tagline: null,
            })]);
            const savedDims = manager.saved.find((entry) => entry.target === CsiPeriodRateeDimension)!.value;
            expect(savedDims).toEqual([expect.objectContaining({ periodRateeId: savedRatees[0].id, dimensionId: 'd2', dimensionName: 'Ramah', sortOrder: 0 })]);
            expect(manager.saved.find((entry) => entry.target === CsiPeriodRater)!.value)
                .toEqual([expect.objectContaining({ periodId, userId: 'u2' })]);
            expect(manager.saved.map((entry) => entry.target)).toEqual([CsiPeriod, CsiPeriodRatee, CsiPeriodRateeDimension, CsiPeriodRater]);
        });

        it('create with multiple sites stores csi_period_sites', async () => {
            await service.create(ICT, createDto({ siteIds: ['site-a', 'site-b'], startDate: '2026-11-01', endDate: '2026-11-30' }), 'admin');
            expect(savedPeriod().sites).toEqual([{ siteId: 'site-a' }, { siteId: 'site-b' }]);
            expect(savedPeriod()).toMatchObject({ teamEnabled: false, teamLabel: 'Tim IT Support', individualEnabled: true, slaTargetPct: 80 });
        });

        it('overlap is checked per site', async () => {
            expect(await service.overlaps(ICT, ['site-b', 'site-a'], '2026-09-15', '2026-10-15')).toHaveLength(1);
            expect(await service.overlaps(ICT, ['site-b'], '2026-09-15', '2026-10-15')).toEqual([]);
        });

        it('both sections disabled → 400', async () => {
            const dates = { startDate: '2026-11-01', endDate: '2026-11-30' };
            await expect(service.create(ICT, createDto({ ...dates, individualEnabled: false }), 'admin'))
                .rejects.toThrow(new BadRequestException('Aktifkan minimal satu bagian penilaian'));
            await service.create(ICT, createDto({ ...dates, individualEnabled: false, teamEnabled: true, teamLabel: 'Tim Helpdesk', slaTargetPct: 70 }), 'admin');
            expect(savedPeriod()).toMatchObject({ teamEnabled: true, individualEnabled: false, teamLabel: 'Tim Helpdesk', slaTargetPct: 70 });
        });

        it('copy-from copies sites and team', async () => {
            periods.rows[0] = basePeriod({
                sites: [{ siteId: 'site-a', site } as any, { siteId: 'site-b', site: siteB } as any],
                teamEnabled: true, teamLabel: 'Tim Lama', slaTargetPct: 90,
            });
            ratees.rows.push(
                { id: 'r-team', periodId: 'p1', kind: CsiRateeKind.TEAM, userId: null, siteId: 'site-a', teamId: 'team-site-a',
                    displayName: 'Tim Lama', jobTitle: null, sortOrder: -1, photoUrl: '/uploads/csi/override.jpg', tagline: 'Override lama' },
                { id: 'r1', periodId: 'p1', kind: CsiRateeKind.PERSON, userId: 'u1', displayName: 'Budi', jobTitle: null, sortOrder: 0 },
            );
            rateeDimensions.rows.push(
                { id: 'rt1', periodRateeId: 'r-team', dimensionId: 'd-off', dimensionName: 'Lama', sortOrder: 0 },
                { id: 'rt2', periodRateeId: 'r-team', dimensionId: 'd2', dimensionName: 'Old', sortOrder: 1 },
                { id: 'rd1', periodRateeId: 'r1', dimensionId: 'd1', dimensionName: 'Responsif', sortOrder: 0 },
            );
            await service.create(ICT, { startDate: '2026-10-01', endDate: '2026-12-31', copyFromPeriodId: 'p1' }, 'admin');
            expect(savedPeriod()).toMatchObject({ sites: [{ siteId: 'site-a' }, { siteId: 'site-b' }], teamEnabled: true, teamLabel: 'Tim Lama', slaTargetPct: 90 });
            const savedRatees = manager.saved.filter((entry) => entry.target === CsiPeriodRatee).flatMap((entry) => entry.value);
            expect(savedRatees).toEqual([
                expect.objectContaining({
                    kind: CsiRateeKind.TEAM, userId: null, displayName: 'Tim Sepanjang', sortOrder: -1, siteId: 'site-a', teamId: 'team-site-a', photoUrl: null, tagline: null,
                }),
                expect.objectContaining({ kind: CsiRateeKind.PERSON, userId: 'u1', displayName: 'Budi Baru', sortOrder: 0 }),
            ]);
            const teamId = savedRatees[0].id;
            const savedDims = manager.saved.filter((entry) => entry.target === CsiPeriodRateeDimension).flatMap((entry) => entry.value);
            expect(savedDims.filter((row: any) => row.periodRateeId === teamId)).toEqual([
                expect.objectContaining({ dimensionId: 'd2', dimensionName: 'Ramah', type: CsiQuestionType.SCALE, required: false, options: SCALE_OPTIONS, sortOrder: 0 }),
            ]);
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

        it('rejects changing respondentMode once the period has answers (409), keeping same-mode edits', async () => {
            responses.rows.push({ id: 'resp', periodId: 'p1' });
            await expect(service.update(ICT, 'p1', { respondentMode: CsiRespondentMode.LISTED }))
                .rejects.toThrow(new ConflictException('Periode sudah memiliki jawaban'));
            expect(periods.save).not.toHaveBeenCalled();
            await service.update(ICT, 'p1', { respondentMode: CsiRespondentMode.OPEN, title: 'Baru' });
            expect(periods.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1', title: 'Baru', respondentMode: CsiRespondentMode.OPEN }));
        });

        it('allows changing respondentMode before any answer', async () => {
            await service.update(ICT, 'p1', { respondentMode: CsiRespondentMode.LISTED });
            expect(periods.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1', respondentMode: CsiRespondentMode.LISTED }));
        });

        it('rejects period of other scope (404)', async () => {
            await expect(service.update(HC, 'p1', { title: 'X' })).rejects.toBeInstanceOf(NotFoundException);
        });

        it('update siteIds rejected when locked', async () => {
            responses.rows.push({ id: 'resp', periodId: 'p1' });
            await expect(service.update(ICT, 'p1', { siteIds: ['site-a', 'site-b'] })).rejects.toThrow(new ConflictException('Periode sudah memiliki jawaban'));
            expect(manager.delete).not.toHaveBeenCalled();
            await service.update(ICT, 'p1', { siteIds: ['site-a'], title: 'Baru' });
            expect(periods.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1', title: 'Baru' }));
        });

        it('update siteIds replaces the period sites under the lock and checks overlap per site', async () => {
            await expect(service.update(ICT, 'p2', { siteIds: ['site-b', 'nowhere'] })).rejects.toBeInstanceOf(BadRequestException);
            periods.rows.push(basePeriod({ id: 'p3', sites: [{ siteId: 'site-b', site: siteB } as any] }));
            await expect(service.update(ICT, 'p1', { siteIds: ['site-b'] })).rejects.toBeInstanceOf(ConflictException);
            await service.update(ICT, 'p2', { siteIds: ['site-b'], endDate: '2026-12-31' });
            expect(manager.delete).toHaveBeenCalledWith(CsiPeriodSite, { periodId: 'p2' });
            expect(manager.save).toHaveBeenCalledWith(CsiPeriodSite, [{ periodId: 'p2', siteId: 'site-b' }]);
            const builder = periods.createQueryBuilder.mock.results.at(-1)!.value;
            expect(builder.setLock).toHaveBeenCalledWith('pessimistic_write');
        });

        it("removing a site from a period removes that site's team", async () => {
            periods.rows.push(basePeriod({
                id: 'p4', startDate: '2027-01-01', endDate: '2027-03-31',
                sites: [{ siteId: 'site-a', site } as any, { siteId: 'site-b', site: siteB } as any],
            }));
            await service.update(ICT, 'p4', { siteIds: ['site-a'] });
            expect(manager.delete).toHaveBeenCalledWith(CsiPeriodRatee, { periodId: 'p4', kind: CsiRateeKind.TEAM, siteId: Not(In(['site-a'])) });
        });

        it('both sections disabled → 400 on update', async () => {
            await expect(service.update(ICT, 'p1', { individualEnabled: false }))
                .rejects.toThrow(new BadRequestException('Aktifkan minimal satu bagian penilaian'));
            await service.update(ICT, 'p1', { individualEnabled: false, teamEnabled: true });
            expect(periods.save).toHaveBeenCalledWith(expect.objectContaining({ teamEnabled: true, individualEnabled: false }));
        });

        it('teamLabel update is saved under the lock but no longer renames the per-site TEAM ratees', async () => {
            const txRatees = memoryRepository<any>(ratees.rows);
            const txPeriods = memoryRepository<any>(periods.rows);
            manager.repositories.set(CsiPeriodRatee, txRatees);
            manager.repositories.set(CsiPeriod, txPeriods);
            await service.update(ICT, 'p1', { teamLabel: 'Tim Helpdesk' });
            expect(txPeriods.createQueryBuilder.mock.results.at(-1)!.value.setLock).toHaveBeenCalledWith('pessimistic_write');
            expect(txPeriods.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1', teamLabel: 'Tim Helpdesk' }));
            expect(txRatees.update).not.toHaveBeenCalled();
            expect(ratees.update).not.toHaveBeenCalled();
        });

        describe('immutable once the period has answers', () => {
            beforeEach(() => responses.rows.push({ id: 'resp', periodId: 'p1' }));
            const changes: Array<[string, Record<string, unknown>]> = [
                ['siteIds', { siteIds: ['site-b'] }],
                ['respondentMode', { respondentMode: CsiRespondentMode.LISTED }],
                ['teamEnabled', { teamEnabled: true }],
                ['individualEnabled', { individualEnabled: false, teamEnabled: true }],
                ['teamLabel', { teamLabel: 'Tim Lain' }],
            ];

            it.each(changes)('rejects changing %s (409) without writing', async (_field, patch) => {
                await expect(service.update(ICT, 'p1', patch)).rejects.toThrow(new ConflictException('Periode sudah memiliki jawaban'));
                expect(periods.save).not.toHaveBeenCalled();
                expect(manager.save).not.toHaveBeenCalled();
                expect(ratees.update).not.toHaveBeenCalled();
            });

            it('accepts unchanged values for the immutable fields', async () => {
                await service.update(ICT, 'p1', {
                    siteIds: ['site-a'], respondentMode: CsiRespondentMode.OPEN, teamEnabled: false,
                    individualEnabled: true, teamLabel: 'Tim IT Support', title: 'Baru',
                });
                expect(periods.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1', title: 'Baru' }));
                expect(ratees.update).not.toHaveBeenCalled();
            });

            it('keeps slaTargetPct, texts and dates editable', async () => {
                await service.update(ICT, 'p1', { slaTargetPct: 90, title: 'T', intro: 'I', thankYou: 'K', endDate: '2026-09-20' });
                expect(periods.save).toHaveBeenCalledWith(expect.objectContaining({
                    id: 'p1', slaTargetPct: 90, title: 'T', intro: 'I', thankYou: 'K', endDate: '2026-09-20',
                }));
            });
        });
    });

    describe('assignment', () => {
        beforeEach(() => periods.rows.push(basePeriod()));

        it('setRatees snapshots displayName/jobTitle/dimensionName', async () => {
            await service.setRatees(ICT, 'p1', [{ userId: 'u1', dimensionIds: ['d2', 'd1'] }, { userId: 'u2', dimensionIds: ['d1'] }]);
            // Nothing to remove on an empty period: people are diffed by userId, not wiped.
            expect(manager.delete).not.toHaveBeenCalledWith(CsiPeriodRatee, expect.anything());
            const savedRatees = manager.saved.find((entry) => entry.target === CsiPeriodRatee)!.value;
            expect(savedRatees).toEqual([
                expect.objectContaining({
                    periodId: 'p1', kind: CsiRateeKind.PERSON, userId: 'u1', displayName: 'Budi Baru', jobTitle: 'Staf IT', sortOrder: 0,
                    siteId: 'site-a', teamId: null, photoUrl: null, tagline: null,
                }),
                expect.objectContaining({ periodId: 'p1', kind: CsiRateeKind.PERSON, userId: 'u2', displayName: 'Sari', jobTitle: null, sortOrder: 1, siteId: 'site-b' }),
            ]);
            const savedDims = manager.saved.find((entry) => entry.target === CsiPeriodRateeDimension)!.value;
            expect(savedDims).toEqual([
                expect.objectContaining({ periodRateeId: savedRatees[0].id, dimensionId: 'd2', dimensionName: 'Ramah', shortLabel: 'Keramahan', type: CsiQuestionType.SCALE, required: false, options: SCALE_OPTIONS, sortOrder: 0 }),
                expect.objectContaining({ periodRateeId: savedRatees[0].id, dimensionId: 'd1', dimensionName: 'Responsif', shortLabel: null, ...STAR_SNAPSHOT, sortOrder: 1 }),
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

        it('setRaters diffs by userId (keeps, removes, adds) and rejects inactive users', async () => {
            periodRaters.rows.push({ id: 'pr-u2', periodId: 'p1', userId: 'u2' }, { id: 'pr-gone', periodId: 'p1', userId: 'u-gone' });
            await expect(service.setRaters(ICT, 'p1', ['u-off'])).rejects.toBeInstanceOf(BadRequestException);
            await service.setRaters(ICT, 'p1', ['u1', 'u2', 'u1']);
            expect(manager.delete).toHaveBeenCalledTimes(1);
            expect(manager.delete).toHaveBeenCalledWith(CsiPeriodRater, { id: In(['pr-gone']) });
            expect(manager.saved.find((entry) => entry.target === CsiPeriodRater)!.value).toEqual([expect.objectContaining({ periodId: 'p1', userId: 'u1' })]);
        });

        it('setRatees keeps TEAM ratee and removes only people who are no longer listed', async () => {
            ratees.rows.push(
                { id: 'r-team', periodId: 'p1', kind: CsiRateeKind.TEAM, userId: null, siteId: 'site-a', displayName: 'Tim', jobTitle: null, sortOrder: -1 },
                { id: 'r-u1', periodId: 'p1', kind: CsiRateeKind.PERSON, userId: 'u1', siteId: 'site-a', displayName: 'Budi', jobTitle: null, sortOrder: 0 },
                { id: 'r-u2', periodId: 'p1', kind: CsiRateeKind.PERSON, userId: 'u2', siteId: 'site-b', displayName: 'Sari', jobTitle: null, sortOrder: 1 },
            );
            await service.setRatees(ICT, 'p1', [{ userId: 'u1', dimensionIds: ['d1'] }]);
            expect(manager.delete).toHaveBeenCalledWith(CsiPeriodRatee, { id: In(['r-u2']) });
            expect(manager.delete).toHaveBeenCalledWith(CsiPeriodRateeDimension, { periodRateeId: In(['r-u1']) });
            expect(manager.delete).not.toHaveBeenCalledWith(CsiPeriodRatee, expect.objectContaining({ kind: expect.anything() }));
            expect(manager.saved.find((entry) => entry.target === CsiPeriodRatee)!.value).toEqual([expect.objectContaining({ id: 'r-u1', userId: 'u1' })]);
        });

        it('setTeamQuestions creates the TEAM ratee of a site from its csi_teams master, with snapshots', async () => {
            periods.rows[0] = basePeriod({ teamEnabled: true, teamLabel: 'Tim Helpdesk' });
            await service.setTeamQuestions(ICT, 'p1', 'site-a', ['d2', 'd1']);
            expect(subjects.createTeam).toHaveBeenCalledWith(ICT, 'site-a');
            const savedRatees = manager.saved.filter((entry) => entry.target === CsiPeriodRatee).map((entry) => entry.value);
            expect(savedRatees).toEqual([expect.objectContaining({
                periodId: 'p1', kind: CsiRateeKind.TEAM, userId: null, displayName: 'Tim Sepanjang', jobTitle: null, sortOrder: -1,
                siteId: 'site-a', teamId: 'team-site-a', photoUrl: null, tagline: null,
            })]);
            expect(manager.saved.find((entry) => entry.target === CsiPeriodRateeDimension)!.value).toEqual([
                expect.objectContaining({ periodRateeId: savedRatees[0].id, dimensionId: 'd2', dimensionName: 'Ramah', shortLabel: 'Keramahan', type: CsiQuestionType.SCALE, required: false, options: SCALE_OPTIONS, sortOrder: 0 }),
                expect.objectContaining({ periodRateeId: savedRatees[0].id, dimensionId: 'd1', dimensionName: 'Responsif', shortLabel: null, ...STAR_SNAPSHOT, sortOrder: 1 }),
            ]);
            const builder = periods.createQueryBuilder.mock.results.at(-1)!.value;
            expect(builder.setLock).toHaveBeenCalledWith('pessimistic_write');
        });

        it('setTeamQuestions replaces the snapshots of an existing TEAM ratee', async () => {
            ratees.rows.push({
                id: 'r-team', periodId: 'p1', kind: CsiRateeKind.TEAM, userId: null, siteId: 'site-a', teamId: 'team-site-a',
                displayName: 'Lama', jobTitle: null, sortOrder: -1, tagline: 'Override', photoUrl: null,
            });
            await service.setTeamQuestions(ICT, 'p1', 'site-a', ['d1']);
            expect(manager.delete).toHaveBeenCalledWith(CsiPeriodRateeDimension, { periodRateeId: 'r-team' });
            expect(manager.saved.find((entry) => entry.target === CsiPeriodRatee)!.value)
                .toMatchObject({ id: 'r-team', kind: CsiRateeKind.TEAM, displayName: 'Tim Sepanjang', sortOrder: -1, siteId: 'site-a', tagline: 'Override' });
            expect(manager.saved.find((entry) => entry.target === CsiPeriodRateeDimension)!.value)
                .toEqual([expect.objectContaining({ periodRateeId: 'r-team', dimensionId: 'd1', sortOrder: 0 })]);
        });

        it('setTeamQuestions [] removes only the TEAM ratee of that site', async () => {
            await service.setTeamQuestions(ICT, 'p1', 'site-a', []);
            expect(manager.delete).toHaveBeenCalledWith(CsiPeriodRatee, { periodId: 'p1', kind: CsiRateeKind.TEAM, siteId: 'site-a' });
            expect(manager.save).not.toHaveBeenCalled();
        });

        it("setTeamQuestions creates one team ratee per site and keeps the other site's team", async () => {
            periods.rows[0] = basePeriod({ teamEnabled: true, sites: [{ siteId: 'site-a', site } as any, { siteId: 'site-b', site: siteB } as any] });
            ratees.rows.push({ id: 'r-team-a', periodId: 'p1', kind: CsiRateeKind.TEAM, userId: null, siteId: 'site-a', teamId: 'team-site-a', displayName: 'Tim Sepanjang', jobTitle: null, sortOrder: -1 });
            await service.setTeamQuestions(ICT, 'p1', 'site-b', ['d1']);
            const savedRatees = manager.saved.filter((entry) => entry.target === CsiPeriodRatee).map((entry) => entry.value);
            expect(savedRatees).toEqual([expect.objectContaining({ kind: CsiRateeKind.TEAM, siteId: 'site-b', teamId: 'team-site-b', displayName: 'Tim Semarang' })]);
            expect(savedRatees[0].id).not.toBe('r-team-a');
            expect(manager.delete).not.toHaveBeenCalledWith(CsiPeriodRatee, expect.anything());
            expect(manager.delete).not.toHaveBeenCalledWith(CsiPeriodRateeDimension, { periodRateeId: 'r-team-a' });
        });

        it('setTeamQuestions rejects a site outside the period (400)', async () => {
            await expect(service.setTeamQuestions(ICT, 'p1', 'site-b', ['d1'])).rejects.toBeInstanceOf(BadRequestException);
            expect(manager.save).not.toHaveBeenCalled();
        });

        it('two teams of the same site are rejected', async () => {
            // A concurrent request created the site team first: the partial unique index answers with 23505.
            const violation = new QueryFailedError('INSERT', [], Object.assign(new Error('duplicate'), { code: '23505' }));
            manager.save.mockRejectedValueOnce(violation);
            await expect(service.setTeamQuestions(ICT, 'p1', 'site-a', ['d1'])).rejects.toBeInstanceOf(ConflictException);
            // Moving another TEAM ratee onto a site that already has a team is rejected up front.
            periods.rows[0] = basePeriod({ sites: [{ siteId: 'site-a', site } as any, { siteId: 'site-b', site: siteB } as any] });
            ratees.rows.push(
                { id: 'r-team-a', periodId: 'p1', kind: CsiRateeKind.TEAM, userId: null, siteId: 'site-a', teamId: 'ta', displayName: 'A', jobTitle: null, sortOrder: -1 },
                { id: 'r-team-b', periodId: 'p1', kind: CsiRateeKind.TEAM, userId: null, siteId: 'site-b', teamId: 'tb', displayName: 'B', jobTitle: null, sortOrder: -1 },
            );
            await expect(service.updateRatee(ICT, 'p1', 'r-team-b', { siteId: 'site-a' })).rejects.toBeInstanceOf(ConflictException);
        });

        it('ratee override stores tagline only for the period', async () => {
            ratees.rows.push({ id: 'r1', periodId: 'p1', kind: CsiRateeKind.PERSON, userId: 'u1', siteId: 'site-a', displayName: 'Budi', jobTitle: null, sortOrder: 0, photoUrl: null, tagline: null });
            await service.updateRatee(ICT, 'p1', 'r1', { tagline: '  Khusus Q4  ' });
            expect(ratees.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'r1', tagline: 'Khusus Q4' }));
            expect(subjects.createTeam).not.toHaveBeenCalled();
            await service.updateRatee(ICT, 'p1', 'r1', { tagline: '', photoUrl: null });
            expect(ratees.save).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'r1', tagline: null, photoUrl: null }));
            await expect(service.updateRatee(ICT, 'p1', 'r1', { tagline: 'x'.repeat(91) })).rejects.toBeInstanceOf(BadRequestException);
            await expect(service.updateRatee(ICT, 'p1', 'r1', { siteId: 'site-b' })).rejects.toBeInstanceOf(BadRequestException);
            await expect(service.updateRatee(ICT, 'p1', 'nope', { tagline: 'a' })).rejects.toBeInstanceOf(NotFoundException);
            await expect(service.updateRatee(HC, 'p1', 'r1', { tagline: 'a' })).rejects.toBeInstanceOf(NotFoundException);
        });

        it('setTeamQuestions rejects inactive, other-scope or duplicate questions (400) and locked periods (409)', async () => {
            await expect(service.setTeamQuestions(ICT, 'p1', 'site-a', ['d-off'])).rejects.toBeInstanceOf(BadRequestException);
            await expect(service.setTeamQuestions(ICT, 'p1', 'site-a', ['d-hc'])).rejects.toBeInstanceOf(BadRequestException);
            await expect(service.setTeamQuestions(ICT, 'p1', 'site-a', ['d1', 'd1'])).rejects.toBeInstanceOf(BadRequestException);
            expect(manager.save).not.toHaveBeenCalled();
            responses.rows.push({ id: 'resp', periodId: 'p1' });
            await expect(service.setTeamQuestions(ICT, 'p1', 'site-a', ['d1'])).rejects.toThrow(new ConflictException('Periode sudah memiliki jawaban'));
            await expect(service.setTeamQuestions(HC, 'p1', 'site-a', ['d-hc'])).rejects.toBeInstanceOf(NotFoundException);
        });

        it('get lists the TEAM ratee first, then people by sortOrder', async () => {
            ratees.rows.push(
                { id: 'r2', periodId: 'p1', kind: CsiRateeKind.PERSON, userId: 'u2', displayName: 'Sari', jobTitle: null, sortOrder: 1 },
                { id: 'r1', periodId: 'p1', kind: CsiRateeKind.PERSON, userId: 'u1', displayName: 'Budi', jobTitle: null, sortOrder: 0 },
                { id: 'r-team', periodId: 'p1', kind: CsiRateeKind.TEAM, userId: null, displayName: 'Tim IT Support', jobTitle: null, sortOrder: -1 },
            );
            const detail = await service.get(ICT, 'p1');
            expect(detail.ratees.map((ratee) => [ratee.id, ratee.kind])).toEqual([
                ['r-team', CsiRateeKind.TEAM], ['r1', CsiRateeKind.PERSON], ['r2', CsiRateeKind.PERSON],
            ]);
        });

        it('readiness ignores the TEAM ratee when the team section is disabled', async () => {
            ratees.rows.push({ id: 'r-team', periodId: 'p1', kind: CsiRateeKind.TEAM, userId: null, displayName: 'Tim', jobTitle: null, sortOrder: -1 });
            const detail = await service.get(ICT, 'p1');
            expect(detail.readiness.checks.map((check) => check.key)).toEqual(['ratees', 'dimensions', 'departments']);
            expect(detail.readiness.checks.find((check) => check.key === 'ratees')).toMatchObject({ ok: false });
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

            it('update of respondentMode', async () => {
                await expect(service.update(ICT, 'p1', { respondentMode: CsiRespondentMode.LISTED }))
                    .rejects.toThrow(new ConflictException('Periode sudah memiliki jawaban'));
                expectLockedInTransaction();
                expect(periods.save).not.toHaveBeenCalled();
            });
        });

        it('update of respondentMode saves through the transaction after taking the period row lock', async () => {
            const txPeriods = memoryRepository<any>(periods.rows);
            manager.repositories.set(CsiPeriod, txPeriods);
            await service.update(ICT, 'p1', { respondentMode: CsiRespondentMode.LISTED });
            const builder = txPeriods.createQueryBuilder.mock.results.at(-1)!.value;
            expect(builder.setLock).toHaveBeenCalledWith('pessimistic_write');
            expect(responses.count).toHaveBeenCalledWith({ where: { periodId: 'p1' } });
            expect(txPeriods.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1', respondentMode: CsiRespondentMode.LISTED }));
            expect(builder.setLock.mock.invocationCallOrder[0]).toBeLessThan(txPeriods.save.mock.invocationCallOrder[0]);
            expect(periods.save).not.toHaveBeenCalled();
        });

        it('update without a mode change keeps saving outside a transaction', async () => {
            await service.update(ICT, 'p1', { title: 'Baru', respondentMode: CsiRespondentMode.OPEN });
            expect(periods.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1', title: 'Baru' }));
            expect(periods.createQueryBuilder).not.toHaveBeenCalled();
        });

        it('remove deletes an unlocked period within scope only', async () => {
            await expect(service.remove(HC, 'p1')).rejects.toBeInstanceOf(NotFoundException);
            await service.remove(ICT, 'p1');
            expect(periods.delete).toHaveBeenCalledWith({ id: 'p1', scope: ICT });
        });
    });
    describe('publish', () => {
        const draft = () => basePeriod({ publishStatus: CsiPeriodPublishStatus.DRAFT });
        const withAssignment = () => {
            ratees.rows.push({ id: 'r1', periodId: 'p1', userId: 'u1', displayName: 'Budi', jobTitle: null, sortOrder: 0 });
            rateeDimensions.rows.push({ id: 'rd1', periodRateeId: 'r1', dimensionId: 'd1', dimensionName: 'Responsif', sortOrder: 0 });
        };

        it('get and list expose publishStatus next to the time status, and get exposes readiness', async () => {
            periods.rows.push(draft());
            const at = new Date('2026-08-01T10:00:00+07:00');
            const detail = await service.get(ICT, 'p1', at);
            expect(detail).toMatchObject({ status: 'ACTIVE', publishStatus: CsiPeriodPublishStatus.DRAFT, readiness: { ready: false } });
            const [row] = await service.list(ICT, undefined, at);
            expect(row).toMatchObject({ status: 'ACTIVE', publishStatus: CsiPeriodPublishStatus.DRAFT });
        });

        it('readiness counts only active departments of the period scope', async () => {
            periods.rows.push(draft());
            withAssignment();
            departments.rows.splice(0, 1);
            expect((await service.get(ICT, 'p1')).readiness.checks).toContainEqual(expect.objectContaining({ key: 'departments', ok: false }));
            departments.rows.push({ id: 'dep-hc', scope: HC, name: 'HC', isActive: true });
            expect((await service.get(ICT, 'p1')).readiness.ready).toBe(false);
            departments.rows.push({ id: 'dep2', scope: ICT, name: 'Gudang', isActive: true });
            expect((await service.get(ICT, 'p1')).readiness.ready).toBe(true);
        });

        it('readiness counts only raters who are active and belong to the period site (LISTED)', async () => {
            periods.rows.push(basePeriod({ publishStatus: CsiPeriodPublishStatus.DRAFT, respondentMode: CsiRespondentMode.LISTED }));
            withAssignment();
            const rater = (id: string, user: Record<string, unknown>) => ({ id, periodId: 'p1', userId: user.id, user });
            periodRaters.rows.push(
                rater('pr-off', { id: 'u-off', fullName: 'Nonaktif', isActive: false, siteId: 'site-a' }),
                rater('pr-other', { id: 'u2', fullName: 'Sari', isActive: true, siteId: 'site-b' }),
            );
            const ratersCheck = async () => (await service.get(ICT, 'p1')).readiness.checks.find((check) => check.key === 'raters');
            expect(await ratersCheck()).toMatchObject({ ok: false });
            await expect(service.publish(ICT, 'p1')).rejects.toThrow(new BadRequestException('Survei belum lengkap'));
            periodRaters.rows.push(rater('pr-ok', { id: 'u1', fullName: 'Budi Baru', isActive: true, siteId: 'site-a' }));
            expect(await ratersCheck()).toMatchObject({ ok: true });
            expect((await service.publish(ICT, 'p1')).publishStatus).toBe(CsiPeriodPublishStatus.PUBLISHED);
        });

        it('raters readiness counts raters of any survey site', async () => {
            periods.rows.push(basePeriod({
                publishStatus: CsiPeriodPublishStatus.DRAFT, respondentMode: CsiRespondentMode.LISTED,
                sites: [{ siteId: 'site-a', site } as any, { siteId: 'site-b', site: siteB } as any],
            }));
            withAssignment();
            periodRaters.rows.push({ id: 'pr-b', periodId: 'p1', userId: 'u2', user: { id: 'u2', isActive: true, siteId: 'site-b' } });
            const ratersCheck = async () => (await service.get(ICT, 'p1')).readiness.checks.find((check) => check.key === 'raters');
            expect(await ratersCheck()).toMatchObject({ ok: true });
            periodRaters.rows[0].user.siteId = 'site-c';
            expect(await ratersCheck()).toMatchObject({ ok: false });
        });

        it('list filtered by site still returns every site of a multi-site period, ordered by code, without legacy fields', async () => {
            periods.rows.push(
                basePeriod({ sites: [{ siteId: 'site-a', site } as any, { siteId: 'site-b', site: siteB } as any] }),
                basePeriod({ id: 'p-b', sites: [{ siteId: 'site-b', site: siteB } as any] }),
            );
            const rows = await service.list(ICT, 'site-a');
            expect(rows.map((row) => row.id)).toEqual(['p1']);
            expect(rows[0].sites).toEqual([
                { id: 'site-b', code: 'SMG', name: 'Semarang' }, { id: 'site-a', code: 'SPJ', name: 'Sepanjang' },
            ]);
            expect(rows[0]).not.toHaveProperty('siteId');
            expect(rows[0]).not.toHaveProperty('site');
            expect(await service.list(ICT, 'site-c')).toEqual([]);
            const detail = await service.get(ICT, 'p1');
            expect(detail.sites.map((row) => row.code)).toEqual(['SMG', 'SPJ']);
            expect(detail).not.toHaveProperty('siteId');
        });

        it('publish rejects incomplete with 400', async () => {
            periods.rows.push(draft());
            await expect(service.publish(ICT, 'p1')).rejects.toThrow(new BadRequestException('Survei belum lengkap'));
            expect(periods.update).not.toHaveBeenCalled();
            expect(periods.rows[0].publishStatus).toBe(CsiPeriodPublishStatus.DRAFT);
        });

        it('publish sets PUBLISHED', async () => {
            periods.rows.push(draft());
            withAssignment();
            const detail = await service.publish(ICT, 'p1');
            expect(periods.update).toHaveBeenCalledWith({ id: 'p1', scope: ICT }, { publishStatus: CsiPeriodPublishStatus.PUBLISHED });
            expect(detail.publishStatus).toBe(CsiPeriodPublishStatus.PUBLISHED);
        });

        it('publish refuses a draft whose dates clash with a published survey of the same site (409 naming it)', async () => {
            periods.rows.push(draft());
            withAssignment();
            periods.rows.push(basePeriod({ id: 'live', title: 'CSI ICT', startDate: '2026-09-01', endDate: '2026-09-10' }));
            const error = await service.publish(ICT, 'p1').catch((caught) => caught);
            expect(error).toBeInstanceOf(ConflictException);
            expect(error.getResponse()).toMatchObject({ code: 'CSI_PERIOD_OVERLAP', overlap: { id: 'live', title: 'CSI ICT' } });
            expect(error.message).toMatch(/"CSI ICT"/);
            expect(periods.update).not.toHaveBeenCalled();
        });

        it('publishing an already published period is a no-op', async () => {
            periods.rows.push(basePeriod());
            const detail = await service.publish(ICT, 'p1');
            expect(detail.publishStatus).toBe(CsiPeriodPublishStatus.PUBLISHED);
            expect(periods.update).not.toHaveBeenCalled();
        });

        it('publish rejects period of other scope (404)', async () => {
            periods.rows.push(draft());
            withAssignment();
            await expect(service.publish(HC, 'p1')).rejects.toBeInstanceOf(NotFoundException);
            await expect(service.unpublish(HC, 'p1')).rejects.toBeInstanceOf(NotFoundException);
            expect(periods.update).not.toHaveBeenCalled();
        });

        it('unpublish rejects when answers exist (409)', async () => {
            periods.rows.push(basePeriod());
            responses.rows.push({ id: 'resp', periodId: 'p1' });
            await expect(service.unpublish(ICT, 'p1')).rejects.toThrow(new ConflictException('Periode sudah memiliki jawaban'));
            const builder = periods.createQueryBuilder.mock.results.at(-1)!.value;
            expect(builder.setLock).toHaveBeenCalledWith('pessimistic_write');
            expect(periods.update).not.toHaveBeenCalled();
        });

        it('unpublish sets DRAFT', async () => {
            periods.rows.push(basePeriod());
            const detail = await service.unpublish(ICT, 'p1');
            expect(periods.update).toHaveBeenCalledWith({ id: 'p1', scope: ICT }, { publishStatus: CsiPeriodPublishStatus.DRAFT });
            expect(detail.publishStatus).toBe(CsiPeriodPublishStatus.DRAFT);
        });
    });
});
