import { ConflictException } from '@nestjs/common';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { CsiPairMode, CsiPeriodPublishStatus, CsiRespondentMode } from '../csi.constants';
import { CsiPeriod } from '../entities/csi-period.entity';
import { CsiPeriodRatee } from '../entities/csi-period-ratee.entity';
import { CsiPeriodRater } from '../entities/csi-period-rater.entity';
import { CsiPeriodRaterRatee } from '../entities/csi-period-rater-ratee.entity';
import { CsiResponse } from '../entities/csi-response.entity';
import { CsiUnitRulesService } from './csi-unit-rules.service';

describe('CsiUnitRulesService', () => {
    const periods = { findOne: jest.fn() };
    const people = { find: jest.fn() };
    const users = { find: jest.fn(), findOne: jest.fn() };
    const ratees = { find: jest.fn() };
    const dataSource = { query: jest.fn(), getRepository: jest.fn(), transaction: jest.fn() };
    const service = new CsiUnitRulesService(periods as any, people as any, users as any, ratees as any, dataSource as any);

    beforeEach(() => jest.clearAllMocks());

    it('matches unpadded user employeeIds to padded directory NIKs during rule preview', async () => {
        periods.findOne.mockResolvedValue({ id: 'p-1', scope: ServiceScope.HC });
        ratees.find.mockResolvedValue([{ id: 'rt-1', picId: 'pic-1', serviceCode: 'HCD', bagian: null, userId: null }]);
        people.find.mockResolvedValue([
            { nik: '00001234', division: 'OPS', department: 'PROD', bagian: 'LINE' },
            { nik: '00009999', division: 'OPS', department: 'PROD', bagian: 'LINE' },
        ]);
        users.find.mockResolvedValue([{ id: 'u-1', employeeId: '1234' }]);

        const result = await service.preview(ServiceScope.HC, 'p-1', [{ division: 'OPS', serviceCode: 'HCD' }]);
        expect(result).toEqual({ raters: 1, pairs: 1 });
    });

    it('normalizes user employeeId when enriching raterList with org units', async () => {
        periods.findOne.mockResolvedValue({ id: 'p-1', scope: ServiceScope.HC });
        dataSource.getRepository
            .mockReturnValueOnce({ find: jest.fn().mockResolvedValue([{ id: 'pr-1', userId: 'u-1', user: { employeeId: '1234', fullName: 'Andi', site: { code: 'SPJ' } } }]) })
            .mockReturnValueOnce({ find: jest.fn().mockResolvedValue([{ periodRaterId: 'pr-1', periodRateeId: 'rt-1' }]) });
        people.find.mockResolvedValue([{ nik: '00001234', division: 'OPS', department: 'PROD', bagian: 'LINE' }]);

        const list = await service.raterList(ServiceScope.HC, 'p-1');
        expect(list[0]).toMatchObject({ userId: 'u-1', division: 'OPS', department: 'PROD', bagian: 'LINE', answered: false });
    });

    it('after answers exist on active survey: allows adding new PICs to answered rater while blocking removal of scored PICs', async () => {
        const periodRow = {
            id: 'p-1', scope: ServiceScope.HC, startDate: '2026-11-01', endDate: '2099-12-31',
            publishStatus: CsiPeriodPublishStatus.PUBLISHED, respondentMode: CsiRespondentMode.LISTED,
            pairMode: CsiPairMode.CUSTOM, respondentPicks: false,
        };
        periods.findOne.mockResolvedValue(periodRow);
        users.findOne.mockImplementation(async ({ where }: any) => ({ id: where.id, isActive: true }));
        users.find.mockImplementation(async ({ where }: any) => {
            const ids = where?.id?._value ?? [];
            return ids.map((id: string) => ({ id, isActive: true }));
        });
        ratees.find.mockImplementation(async ({ where }: any) => {
            const all = [
                { id: 'rt-1', periodId: 'p-1', userId: 'u-pic' },
                { id: 'rt-2', periodId: 'p-1', userId: 'u-pic-2' },
            ];
            const ids = where?.id?._value;
            return ids ? all.filter((r) => ids.includes(r.id)) : all;
        });

        const ratersData = [
            { id: 'pr-answered', periodId: 'p-1', userId: 'u-ans', user: { fullName: 'Sudah', site: null } },
            { id: 'pr-wait', periodId: 'p-1', userId: 'u-wait', user: { fullName: 'Belum', site: null } },
        ];
        const pairsData = [{ periodId: 'p-1', periodRaterId: 'pr-answered', periodRateeId: 'rt-1' }];
        const responsesData = [{ id: 'resp-1', periodId: 'p-1', respondentId: 'u-ans' }];

        const repoOf = (entity: unknown): any => {
            if (entity === CsiPeriod) {
                return {
                    createQueryBuilder: () => {
                        const b: any = { setLock: () => b, where: () => b, getOne: async () => periodRow };
                        return b;
                    },
                };
            }
            if (entity === CsiResponse) {
                return {
                    count: async ({ where }: any = {}) => responsesData.filter((r) => !where?.respondentId || r.respondentId === where.respondentId).length,
                    find: async () => responsesData,
                    findOne: async ({ where }: any = {}) => responsesData.find((r) => r.respondentId === where?.respondentId) ?? null,
                };
            }
            if (entity === CsiPeriodRater) {
                return {
                    find: async () => ratersData,
                    findOne: async ({ where }: any) => ratersData.find((r) => r.userId === where.userId) ?? null,
                };
            }
            if (entity === CsiPeriodRatee) {
                return {
                    findOne: async ({ where }: any) => (where.id === 'rt-1' || where.id === 'rt-2' ? { id: where.id } : null),
                };
            }
            if (entity === CsiPeriodRaterRatee) {
                return {
                    find: async ({ where }: any = {}) => pairsData.filter((p) =>
                        (!where?.periodRaterId || p.periodRaterId === where.periodRaterId)
                        && (!where?.periodRateeId || p.periodRateeId === where.periodRateeId)),
                };
            }
            return { update: jest.fn(), delete: jest.fn(), save: jest.fn(), find: jest.fn(async () => []) };
        };
        dataSource.getRepository.mockImplementation(repoOf);
        const manager = {
            getRepository: repoOf,
            delete: jest.fn(),
            save: jest.fn(async (entity: unknown, val: any) => {
                if (entity === CsiPeriodRater) {
                    const list = Array.isArray(val) ? val : [val];
                    const saved = list.map((row, idx) => ({ id: `pr-new-${ratersData.length + idx}`, ...row, user: { fullName: 'Baru', site: null } }));
                    ratersData.push(...saved);
                    return Array.isArray(val) ? saved : saved[0];
                }
                if (entity === CsiPeriodRaterRatee) pairsData.push(...(Array.isArray(val) ? val : [val]));
                return val;
            }),
        };
        dataSource.transaction.mockImplementation(async (work: (m: typeof manager) => unknown) => work(manager));
        people.find.mockResolvedValue([]);

        // Dropping an already-scored PIC from an answered rater is blocked; removing an unanswered rater is blocked.
        await expect(service.setRater(ServiceScope.HC, 'p-1', 'u-ans', ['rt-2'])).rejects.toBeInstanceOf(ConflictException);
        await expect(service.setRater(ServiceScope.HC, 'p-1', 'u-wait', [])).rejects.toBeInstanceOf(ConflictException);

        // Adding a new unrated PIC while keeping scored ones succeeds for answered raters.
        const updated = await service.setRater(ServiceScope.HC, 'p-1', 'u-ans', ['rt-1', 'rt-2']);
        expect(updated.find((r) => r.userId === 'u-ans')?.periodRateeIds).toEqual(['rt-1', 'rt-2']);

        const list = await service.setRater(ServiceScope.HC, 'p-1', 'u-new', ['rt-1']);
        expect(list.find((r) => r.userId === 'u-new')?.periodRateeIds).toEqual(['rt-1']);
        expect(list.find((r) => r.userId === 'u-ans')?.answered).toBe(true);
    });

    it('assignRatersToPics copies raters from source PIC with optional includeAnswered toggle', async () => {
        const periodRow = {
            id: 'p-1', scope: ServiceScope.HC, startDate: '2026-11-01', endDate: '2099-12-31',
            publishStatus: CsiPeriodPublishStatus.PUBLISHED, respondentMode: CsiRespondentMode.LISTED,
            pairMode: CsiPairMode.CUSTOM, respondentPicks: false,
        };
        periods.findOne.mockResolvedValue(periodRow);
        ratees.find.mockResolvedValue([{ id: 'rt-2', periodId: 'p-1', userId: 'u-pic-2' }]);
        const ratersData = [
            { id: 'pr-ans', periodId: 'p-1', userId: 'u-ans' },
            { id: 'pr-wait', periodId: 'p-1', userId: 'u-wait' },
        ];
        const pairsData = [
            { periodId: 'p-1', periodRaterId: 'pr-ans', periodRateeId: 'rt-1' },
            { periodId: 'p-1', periodRaterId: 'pr-wait', periodRateeId: 'rt-1' },
        ];
        const responsesData = [{ id: 'resp-1', periodId: 'p-1', respondentId: 'u-ans' }];

        const repoOf = (entity: unknown): any => {
            if (entity === CsiPeriod) {
                return { createQueryBuilder: () => ({ setLock() { return this; }, where() { return this; }, getOne: async () => periodRow }) };
            }
            if (entity === CsiResponse) {
                return { count: async () => responsesData.length, find: async () => responsesData };
            }
            if (entity === CsiPeriodRatee) {
                return { findOne: async () => ({ id: 'rt-1', periodId: 'p-1' }) };
            }
            if (entity === CsiPeriodRaterRatee) {
                return {
                    find: async ({ where }: any = {}) => pairsData.filter((p) => !where?.periodRateeId || p.periodRateeId === where.periodRateeId),
                };
            }
            if (entity === CsiPeriodRater) return { find: async () => ratersData };
            return { find: async () => [] };
        };
        const manager = {
            getRepository: repoOf,
            save: jest.fn(async (entity: unknown, val: any) => {
                if (entity === CsiPeriodRaterRatee) pairsData.push(...(Array.isArray(val) ? val : [val]));
                return val;
            }),
        };
        dataSource.transaction.mockImplementation(async (work: (m: typeof manager) => unknown) => work(manager));

        const skipAnsResult = await service.assignRatersToPics(ServiceScope.HC, 'p-1', {
            targetRateeIds: ['rt-2'], sourceRateeId: 'rt-1', includeAnswered: false,
        });
        expect(skipAnsResult).toEqual({ addedPairs: 1, addedRaters: 0, reopenedRaters: 0, skippedAnswered: 1, skippedSelf: 0 });

        const reopenResult = await service.assignRatersToPics(ServiceScope.HC, 'p-1', {
            targetRateeIds: ['rt-2'], sourceRateeId: 'rt-1', includeAnswered: true,
        });
        expect(reopenResult).toEqual({ addedPairs: 1, addedRaters: 0, reopenedRaters: 1, skippedAnswered: 0, skippedSelf: 0 });
    });
});
