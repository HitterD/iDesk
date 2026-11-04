import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { CsiQuestionSetService } from './csi-question-set.service';

const ICT = ServiceScope.ICT;
const Q1 = '11111111-1111-4111-8111-111111111111';
const Q2 = '22222222-2222-4222-8222-222222222222';

function repository() {
    return {
        find: jest.fn().mockResolvedValue([]), findOne: jest.fn().mockResolvedValue(null), count: jest.fn().mockResolvedValue(0),
        create: jest.fn((value) => value), save: jest.fn(async (value) => ({ id: 'new', ...value })), delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
}

describe('CsiQuestionSetService', () => {
    let sets: ReturnType<typeof repository>;
    let dimensions: ReturnType<typeof repository>;
    let service: CsiQuestionSetService;

    beforeEach(() => {
        sets = repository();
        dimensions = repository();
        service = new CsiQuestionSetService(sets as any, dimensions as any);
    });

    it('lists the scope sets and drops questions that are no longer active', async () => {
        sets.find.mockResolvedValue([{ id: 's1', scope: ICT, name: 'Individu', dimensionIds: [Q1, Q2] }]);
        dimensions.find.mockResolvedValue([{ id: Q2 }]);
        expect(await service.list(ICT)).toEqual([{ id: 's1', scope: ICT, name: 'Individu', dimensionIds: [Q2] }]);
        expect(sets.find).toHaveBeenCalledWith({ where: { scope: ICT }, order: { name: 'ASC' } });
        expect(dimensions.find.mock.calls[0][0].where).toEqual({ scope: ICT, isActive: true });
    });

    it('creates a set with distinct, active, in-scope questions', async () => {
        dimensions.count.mockResolvedValue(2);
        await service.create(ICT, { name: 'Tim', dimensionIds: [Q1, Q2, Q1] });
        expect(sets.save).toHaveBeenCalledWith({ scope: ICT, name: 'Tim', dimensionIds: [Q1, Q2] });
    });

    it('rejects questions that are inactive or from another scope (400)', async () => {
        dimensions.count.mockResolvedValue(1);
        await expect(service.create(ICT, { name: 'Tim', dimensionIds: [Q1, Q2] })).rejects.toBeInstanceOf(BadRequestException);
        expect(sets.save).not.toHaveBeenCalled();
    });

    it('rejects a duplicate name in the scope (409), also from a unique violation', async () => {
        dimensions.count.mockResolvedValue(1);
        sets.findOne.mockResolvedValueOnce({ id: 'other', name: 'tim' });
        await expect(service.create(ICT, { name: 'Tim', dimensionIds: [Q1] })).rejects.toBeInstanceOf(ConflictException);
        sets.save.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: '23505' }));
        await expect(service.create(ICT, { name: 'Tim', dimensionIds: [Q1] })).rejects.toBeInstanceOf(ConflictException);
    });

    it('updates and deletes only within the scope', async () => {
        await expect(service.update(ICT, 's-hc', { name: 'X', dimensionIds: [Q1] })).rejects.toBeInstanceOf(NotFoundException);
        await expect(service.remove(ICT, 's-hc')).rejects.toBeInstanceOf(NotFoundException);
        expect(sets.findOne).toHaveBeenCalledWith({ where: { id: 's-hc', scope: ICT } });
        sets.findOne.mockResolvedValueOnce({ id: 's1', scope: ICT, name: 'Lama', dimensionIds: [] });
        expect(await service.remove(ICT, 's1')).toEqual({ deleted: true });
        expect(sets.delete).toHaveBeenCalledWith({ id: 's1', scope: ICT });
    });
});
