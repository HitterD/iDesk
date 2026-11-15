import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { CsiUnitRulesService } from './csi-unit-rules.service';

describe('CsiUnitRulesService', () => {
    const periods = { findOne: jest.fn() };
    const people = { find: jest.fn() };
    const users = { find: jest.fn() };
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
        expect(list[0]).toMatchObject({ userId: 'u-1', division: 'OPS', department: 'PROD', bagian: 'LINE' });
    });
});
