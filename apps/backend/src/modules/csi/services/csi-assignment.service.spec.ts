import { BadRequestException } from '@nestjs/common';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { User } from '../../users/entities/user.entity';
import { CsiPeriodPublishStatus, CsiRateeKind, CsiRespondentMode } from '../csi.constants';
import { CsiDimension } from '../entities/csi-dimension.entity';
import { CsiPeriodRateeDimension } from '../entities/csi-period-ratee-dimension.entity';
import { CsiPeriodRatee } from '../entities/csi-period-ratee.entity';
import { CsiPeriodRaterRatee } from '../entities/csi-period-rater-ratee.entity';
import { CsiPeriodRater } from '../entities/csi-period-rater.entity';
import { CsiPeriod } from '../entities/csi-period.entity';
import { CsiRaterAssignment } from '../entities/csi-rater-assignment.entity';
import { CsiResponse } from '../entities/csi-response.entity';
import { CsiSubjectProfile } from '../entities/csi-subject-profile.entity';
import { Site } from '../../sites/entities/site.entity';
import { CsiAssignmentService } from './csi-assignment.service';
import { CsiPeriodService } from './csi-period.service';

const ICT = ServiceScope.ICT;
const SPJ = 'site-spj';
const KRW = 'site-krw';

/** Equality filter for the plain where clauses (plus In()) the services use. */
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

/**
 * Tiny in-memory database shared by the repositories and the transaction manager.
 * Deleting raters/ratees cascades to their pairs, like the FKs of csi_period_rater_ratees (ON DELETE CASCADE).
 */
function memoryDb() {
    const tables = new Map<unknown, any[]>();
    let sequence = 0;
    const table = (entity: unknown) => {
        if (!tables.has(entity)) tables.set(entity, []);
        return tables.get(entity)!;
    };
    const remove = (entity: unknown, where: Record<string, any>) => {
        const rows = table(entity);
        const removed = rows.filter((row) => matches(row, where));
        tables.set(entity, rows.filter((row) => !removed.includes(row)));
        const ids = removed.map((row) => row.id);
        if (entity === CsiPeriodRatee) tables.set(CsiPeriodRaterRatee, table(CsiPeriodRaterRatee).filter((pair) => !ids.includes(pair.periodRateeId)));
        if (entity === CsiPeriodRater) tables.set(CsiPeriodRaterRatee, table(CsiPeriodRaterRatee).filter((pair) => !ids.includes(pair.periodRaterId)));
        return { affected: removed.length };
    };
    const save = (entity: unknown, value: any) => {
        const many = Array.isArray(value) ? value : [value];
        const withIds = many.map((row) => ({ ...row, id: row.id ?? `gen-${++sequence}` }));
        withIds.forEach((row) => {
            const rows = table(entity);
            const index = rows.findIndex((existing) => existing.id === row.id);
            if (index >= 0) rows[index] = { ...rows[index], ...row }; else rows.push(row);
        });
        return Array.isArray(value) ? withIds : withIds[0];
    };
    const repository = (entity: unknown) => ({
        find: jest.fn(async (options: any = {}) => table(entity).filter((row) => matches(row, options.where))),
        findOne: jest.fn(async (options: any = {}) => table(entity).find((row) => matches(row, options.where)) ?? null),
        count: jest.fn(async (options: any = {}) => table(entity).filter((row) => matches(row, options.where)).length),
        save: jest.fn(async (value: any) => save(entity, value)),
        delete: jest.fn(async (where: any) => remove(entity, where)),
        createQueryBuilder: jest.fn(() => {
            const builder: any = { params: {} };
            builder.setLock = jest.fn(() => builder);
            builder.where = jest.fn((_sql: string, params: any = {}) => { builder.params = params; return builder; });
            builder.getOne = jest.fn(async () => table(entity).find((row) => row.id === builder.params.id) ?? null);
            return builder;
        }),
    });
    const repositories = new Map<unknown, ReturnType<typeof repository>>();
    const repo = (entity: unknown) => {
        if (!repositories.has(entity)) repositories.set(entity, repository(entity));
        return repositories.get(entity)!;
    };
    const manager = {
        getRepository: (entity: unknown) => repo(entity),
        delete: jest.fn(async (entity: unknown, where: any) => remove(entity, where)),
        save: jest.fn(async (entity: unknown, value: any) => save(entity, value)),
    };
    const dataSource = { transaction: jest.fn(async (work: (m: typeof manager) => unknown) => work(manager)) };
    return { table, repo, manager, dataSource };
}

const period = (over: Partial<CsiPeriod> = {}) => ({
    id: 'p1', scope: ICT, title: 'CSI', intro: '', thankYou: '', startDate: '2026-10-01', endDate: '2026-10-31',
    teamEnabled: true, individualEnabled: true, teamLabel: 'Tim', respondentMode: CsiRespondentMode.LISTED,
    publishStatus: CsiPeriodPublishStatus.DRAFT, createdById: 'admin', ...over,
});
const user = (id: string, siteId: string | null, over: Record<string, unknown> = {}) =>
    ({ id, fullName: `User ${id}`, siteId, avatarUrl: null, isActive: true, jobTitle: null, department: null, ...over });
const rater = (id: string, periodId: string, userId: string, siteId: string | null) => ({ id, periodId, userId, user: user(userId, siteId) });
const person = (id: string, periodId: string, userId: string, siteId: string | null, sortOrder = 0) => ({
    id, periodId, kind: CsiRateeKind.PERSON, userId, user: user(userId, siteId), siteId, teamId: null, team: null,
    photoUrl: null, tagline: null, displayName: `User ${userId}`, jobTitle: null, sortOrder,
});
const team = (id: string, periodId: string, teamId: string, siteId: string) => ({
    id, periodId, kind: CsiRateeKind.TEAM, userId: null, user: null, siteId, teamId, team: { id: teamId, photoUrl: null },
    photoUrl: null, tagline: null, displayName: `Tim ${siteId}`, jobTitle: null, sortOrder: -1,
});

describe('CsiAssignmentService', () => {
    let db: ReturnType<typeof memoryDb>;
    let service: CsiAssignmentService;

    const seed = () => {
        db.table(CsiPeriod).push(period(), period({ id: 'p2' }));
        // Raters: two SPJ (u-spj1, u-spj2) and one KRW (u-krw).
        db.table(CsiPeriodRater).push(
            rater('pr-spj1', 'p1', 'u-spj1', SPJ), rater('pr-spj2', 'p1', 'u-spj2', SPJ), rater('pr-krw', 'p1', 'u-krw', KRW),
            rater('pr-other', 'p2', 'u-x', SPJ),
        );
        // Ratees: SPJ team + two SPJ people (both of them also raters) + KRW team + one person without a site.
        db.table(CsiPeriodRatee).push(
            team('re-team-spj', 'p1', 'team-spj', SPJ),
            person('re-spj1', 'p1', 'u-spj1', SPJ, 0),
            person('re-spj2', 'p1', 'u-spj2', SPJ, 1),
            team('re-team-krw', 'p1', 'team-krw', KRW),
            person('re-nosite', 'p1', 'u-nosite', null, 2),
            person('re-other', 'p2', 'u-y', SPJ),
        );
    };

    beforeEach(() => {
        db = memoryDb();
        seed();
        service = new CsiAssignmentService(
            db.repo(CsiPeriod) as any, db.repo(CsiPeriodRater) as any, db.repo(CsiPeriodRatee) as any,
            db.repo(CsiPeriodRaterRatee) as any, db.repo(CsiRaterAssignment) as any, db.repo(CsiSubjectProfile) as any,
            db.dataSource as any,
        );
    });

    const pairKeys = () => db.table(CsiPeriodRaterRatee).map((pair) => `${pair.periodRaterId}>${pair.periodRateeId}`).sort();

    it('rejects a pair where the rater is the ratee', async () => {
        const attempt = service.setPairs(ICT, 'p1', [{ periodRaterId: 'pr-spj1', periodRateeId: 're-spj1' }]);
        await expect(attempt).rejects.toThrow(new BadRequestException('Penilai tidak bisa menilai dirinya sendiri'));
        expect(db.table(CsiPeriodRaterRatee)).toHaveLength(0);
    });

    it('rejects a pair whose rater or ratee belongs to another period', async () => {
        await expect(service.setPairs(ICT, 'p1', [{ periodRaterId: 'pr-other', periodRateeId: 're-spj1' }]))
            .rejects.toBeInstanceOf(BadRequestException);
        await expect(service.setPairs(ICT, 'p1', [{ periodRaterId: 'pr-spj1', periodRateeId: 're-other' }]))
            .rejects.toBeInstanceOf(BadRequestException);
        expect(db.table(CsiPeriodRaterRatee)).toHaveLength(0);
    });

    it('setPairs replaces every pair of the period and returns the matrix view', async () => {
        await service.setPairs(ICT, 'p1', [{ periodRaterId: 'pr-spj1', periodRateeId: 're-team-krw' }]);
        const view = await service.setPairs(ICT, 'p1', [
            { periodRaterId: 'pr-spj1', periodRateeId: 're-spj2' },
            { periodRaterId: 'pr-spj1', periodRateeId: 're-spj2' },
        ]);
        expect(pairKeys()).toEqual(['pr-spj1>re-spj2']);
        expect(view.pairs).toEqual([{ periodRaterId: 'pr-spj1', periodRateeId: 're-spj2' }]);
        expect(view.raters.map((row) => row.periodRaterId).sort()).toEqual(['pr-krw', 'pr-spj1', 'pr-spj2']);
        expect(view.ratees[0]).toMatchObject({ periodRateeId: expect.any(String), kind: CsiRateeKind.TEAM });
    });

    it('autoSameSite pairs only same-site raters and ratees and skips self', async () => {
        const view = await service.autoSameSite(ICT, 'p1');
        // SPJ1 → team SPJ + SPJ2 (2), SPJ2 → team SPJ + SPJ1 (2), KRW → team KRW (1); the site-less person is never paired.
        expect(view.pairs).toHaveLength(5);
        expect(pairKeys()).toEqual([
            'pr-krw>re-team-krw',
            'pr-spj1>re-spj2', 'pr-spj1>re-team-spj',
            'pr-spj2>re-spj1', 'pr-spj2>re-team-spj',
        ]);
    });

    it('pairsFor returns null when the period has no pairs', async () => {
        await expect(service.pairsFor('p1', 'u-spj1')).resolves.toBeNull();
    });

    it('pairsFor returns the ratee ids for the rater', async () => {
        await service.setPairs(ICT, 'p1', [
            { periodRaterId: 'pr-spj1', periodRateeId: 're-team-spj' },
            { periodRaterId: 'pr-spj1', periodRateeId: 're-spj2' },
            { periodRaterId: 'pr-krw', periodRateeId: 're-team-krw' },
        ]);
        await expect(service.pairsFor('p1', 'u-spj1')).resolves.toEqual(new Set(['re-team-spj', 're-spj2']));
        await expect(service.pairsFor('p1', 'u-spj2')).resolves.toEqual(new Set());
    });

    it('saveTemplate rewrites the scope template from the period pairs', async () => {
        db.table(CsiRaterAssignment).push({ id: 'old', scope: ICT, raterUserId: 'u-gone', subjectKey: 'user:u-gone2' });
        await service.setPairs(ICT, 'p1', [
            { periodRaterId: 'pr-spj1', periodRateeId: 're-team-spj' },
            { periodRaterId: 'pr-spj1', periodRateeId: 're-spj2' },
        ]);
        await service.saveTemplate(ICT, 'p1');
        expect(db.table(CsiRaterAssignment).map((row) => `${row.scope}|${row.raterUserId}|${row.subjectKey}`).sort())
            .toEqual(['ICT|u-spj1|team:team-spj', 'ICT|u-spj1|user:u-spj2']);
    });

    it('applyTemplate skips template rows whose subject is not in the period', async () => {
        db.table(CsiRaterAssignment).push(
            { id: 't1', scope: ICT, raterUserId: 'u-spj1', subjectKey: 'team:team-spj' },
            { id: 't2', scope: ICT, raterUserId: 'u-spj1', subjectKey: 'user:u-not-in-period' },
            { id: 't3', scope: ICT, raterUserId: 'u-not-rater', subjectKey: 'user:u-spj2' },
            { id: 't4', scope: ICT, raterUserId: 'u-krw', subjectKey: 'team:team-krw' },
            { id: 't5', scope: ServiceScope.HC, raterUserId: 'u-spj2', subjectKey: 'team:team-spj' },
        );
        const view = await service.applyTemplate(ICT, 'p1');
        expect(pairKeys()).toEqual(['pr-krw>re-team-krw', 'pr-spj1>re-team-spj']);
        expect(view.pairs).toHaveLength(2);
    });

    it('copyPairs maps the source pairs onto the new period by rater user and subject', async () => {
        await service.setPairs(ICT, 'p1', [
            { periodRaterId: 'pr-spj1', periodRateeId: 're-team-spj' },
            { periodRaterId: 'pr-spj1', periodRateeId: 're-spj2' },
            { periodRaterId: 'pr-krw', periodRateeId: 're-team-krw' },
        ]);
        db.table(CsiPeriod).push(period({ id: 'p3' }));
        // The new period kept u-spj1 (rater) and the SPJ team, but not u-spj2 nor the KRW team/rater.
        db.table(CsiPeriodRater).push(rater('pr3-spj1', 'p3', 'u-spj1', SPJ));
        db.table(CsiPeriodRatee).push(team('re3-team-spj', 'p3', 'team-spj', SPJ), person('re3-other', 'p3', 'u-y', SPJ));
        await service.copyPairs(ICT, 'p1', 'p3');
        expect(db.table(CsiPeriodRaterRatee).filter((pair) => pair.periodId === 'p3').map((pair) => `${pair.periodRaterId}>${pair.periodRateeId}`))
            .toEqual(['pr3-spj1>re3-team-spj']);
        expect(db.table(CsiPeriodRaterRatee).filter((pair) => pair.periodId === 'p1')).toHaveLength(3);
    });

    describe('template applied to a new, still unmapped period', () => {
        let periods: CsiPeriodService;
        let newId: string;

        beforeEach(async () => {
            db.table(Site).push({ id: SPJ, code: 'SPJ', name: 'Sepanjang' });
            db.table(User).push(user('u-r', SPJ), user('u-s', SPJ), user('u-t', SPJ));
            db.table(CsiDimension).push({ id: 'd1', scope: ICT, isActive: true, name: 'Ramah', type: 'STAR', required: true, options: [] });
            db.table(CsiRaterAssignment).push({ id: 'tpl', scope: ICT, raterUserId: 'u-r', subjectKey: 'user:u-s' });
            periods = new CsiPeriodService(
                db.repo(CsiPeriod) as any, db.repo(CsiPeriodRatee) as any, db.repo(CsiPeriodRateeDimension) as any,
                db.repo(CsiPeriodRater) as any, db.repo(CsiResponse) as any, db.repo(CsiDimension) as any, db.repo(User) as any,
                db.repo(Site) as any, {} as any, db.dataSource as any, service, {} as any,
            );
            jest.spyOn(periods, 'get').mockResolvedValue({} as any);
            await periods.create(ICT, { siteIds: [SPJ], title: 'Baru', startDate: '2026-12-01', endDate: '2026-12-31' }, 'admin');
            newId = db.table(CsiPeriod).find((row) => row.title === 'Baru')!.id;
        });
        const rateeIdOf = (userId: string) => db.table(CsiPeriodRatee).find((row) => row.periodId === newId && row.userId === userId)!.id;

        it('create → setRatees → setRaters fills the pairs from the scope template', async () => {
            expect(db.table(CsiPeriodRaterRatee).filter((pair) => pair.periodId === newId)).toHaveLength(0);
            await periods.setRatees(ICT, newId, [{ userId: 'u-s', dimensionIds: ['d1'] }]);
            await periods.setRaters(ICT, newId, ['u-r']);
            await expect(service.pairsFor(newId, 'u-r')).resolves.toEqual(new Set([rateeIdOf('u-s')]));
        });

        it('once pairs exist a later setRatees does not re-apply the template (admin edits are kept)', async () => {
            await periods.setRatees(ICT, newId, [{ userId: 'u-s', dimensionIds: ['d1'] }, { userId: 'u-t', dimensionIds: ['d1'] }]);
            await periods.setRaters(ICT, newId, ['u-r']);
            const raterId = db.table(CsiPeriodRater).find((row) => row.periodId === newId && row.userId === 'u-r')!.id;
            // The admin re-maps the rater from u-s to u-t only.
            await service.setPairs(ICT, newId, [{ periodRaterId: raterId, periodRateeId: rateeIdOf('u-t') }]);
            await periods.setRatees(ICT, newId, [{ userId: 'u-t', dimensionIds: ['d1'] }, { userId: 'u-s', dimensionIds: ['d1'] }]);
            // setRatees re-creates the people, so the FK cascade drops the old pairs; the template must not come back.
            const pairsOfNew = db.table(CsiPeriodRaterRatee).filter((pair) => pair.periodId === newId);
            expect(pairsOfNew.some((pair) => pair.periodRateeId === rateeIdOf('u-s'))).toBe(false);
            expect(pairsOfNew).toHaveLength(0);
        });
    });

    it('deleting a period ratee removes its pairs', async () => {
        await service.setPairs(ICT, 'p1', [
            { periodRaterId: 'pr-spj1', periodRateeId: 're-spj2' },
            { periodRaterId: 'pr-spj1', periodRateeId: 're-team-spj' },
        ]);
        db.table(User).push(user('u-nosite', null));
        db.table(CsiDimension).push({ id: 'd1', scope: ICT, isActive: true, name: 'Ramah', type: 'STAR', required: true, options: [] });
        const periods = new CsiPeriodService(
            db.repo(CsiPeriod) as any, db.repo(CsiPeriodRatee) as any, db.repo(CsiPeriodRateeDimension) as any,
            db.repo(CsiPeriodRater) as any, db.repo(CsiResponse) as any, db.repo(CsiDimension) as any, db.repo(User) as any,
            {} as any, {} as any, db.dataSource as any, service, {} as any,
        );
        jest.spyOn(periods, 'get').mockResolvedValue({} as any);

        // re-spj2 (u-spj2) is dropped from the period's people.
        await periods.setRatees(ICT, 'p1', [{ userId: 'u-nosite', dimensionIds: ['d1'] }]);

        const ratees = await service.pairsFor('p1', 'u-spj1');
        expect(ratees?.has('re-spj2') ?? false).toBe(false);
        expect(db.table(CsiPeriodRatee).some((row) => row.id === 're-spj2')).toBe(false);
    });
});
