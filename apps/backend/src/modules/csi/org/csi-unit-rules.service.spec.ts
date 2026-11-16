import { ConflictException } from '@nestjs/common';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { CsiPairMode, CsiPeriodPublishStatus, CsiRespondentMode } from '../csi.constants';
import { CsiPeriod } from '../entities/csi-period.entity';
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

    it('after answers exist on active survey: allows adding/updating unanswered rater PICs, blocks answered rater or removing registered rater', async () => {
        const periodRow = {
            id: 'p-1', scope: ServiceScope.HC, startDate: '2026-11-01', endDate: '2099-12-31',
            publishStatus: CsiPeriodPublishStatus.PUBLISHED, respondentMode: CsiRespondentMode.LISTED,
            pairMode: CsiPairMode.CUSTOM, respondentPicks: false,
        };
        periods.findOne.mockResolvedValue(periodRow);
        users.findOne.mockImplementation(async ({ where }: any) => ({ id: where.id, isActive: true }));
        ratees.find.mockResolvedValue([{ id: 'rt-1', periodId: 'p-1', userId: 'u-pic' }]);

        const ratersData = [{ id: 'pr-answered', periodId: 'p-1', userId: 'u-ans', user: { fullName: 'Sudah', site: null } }, { id: 'pr-wait', periodId: 'p-1', userId: 'u-wait', user: { fullName: 'Belum', site: null } }];
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
                };
            }
            if (entity === CsiPeriodRater) {
                return {
                    find: async () => ratersData,
                    findOne: async ({ where }: any) => ratersData.find((r) => r.userId === where.userId) ?? null,
                };
            }
            if (entity === CsiPeriodRaterRatee) return { find: async () => pairsData };
            return { update: jest.fn(), delete: jest.fn(), save: jest.fn() };
        };
        dataSource.getRepository.mockImplementation(repoOf);
        const manager = {
            getRepository: repoOf,
            delete: jest.fn(),
            save: jest.fn(async (entity: unknown, val: any) => {
                if (entity === CsiPeriodRater) {
                    const row = { id: 'pr-new', ...val, user: { fullName: 'Baru', site: null } };
                    ratersData.push(row);
                    return row;
                }
                if (entity === CsiPeriodRaterRatee) pairsData.push(...(Array.isArray(val) ? val : [val]));
                return val;
            }),
        };
        dataSource.transaction.mockImplementation(async (work: (m: typeof manager) => unknown) => work(manager));
        people.find.mockResolvedValue([]);

        await expect(service.setRater(ServiceScope.HC, 'p-1', 'u-ans', ['rt-1'])).rejects.toBeInstanceOf(ConflictException);
        await expect(service.setRater(ServiceScope.HC, 'p-1', 'u-wait', [])).rejects.toBeInstanceOf(ConflictException);

        const list = await service.setRater(ServiceScope.HC, 'p-1', 'u-new', ['rt-1']);
        expect(list.find((r) => r.userId === 'u-new')?.periodRateeIds).toEqual(['rt-1']);
        expect(list.find((r) => r.userId === 'u-ans')?.answered).toBe(true);
    });
});
