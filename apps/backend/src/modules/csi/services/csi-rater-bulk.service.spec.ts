import { BadRequestException } from '@nestjs/common';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { CsiRaterBulkService } from './csi-rater-bulk.service';

const ICT = ServiceScope.ICT;
const USERS = [
    { id: 'u1', fullName: 'Andi', email: 'Andi@SJA.co.id', employeeId: '00001', siteId: 's1', departmentId: 'd1', isActive: true },
    { id: 'u2', fullName: 'Budi', email: 'budi@sja.co.id', employeeId: '00002', siteId: 's1', departmentId: 'd2', isActive: true },
    { id: 'u3', fullName: 'Citra', email: 'citra@sja.co.id', employeeId: null, siteId: 's2', departmentId: 'd1', isActive: true },
];

describe('CsiRaterBulkService', () => {
    let users: any;
    let raters: any;
    let master: { addRaters: jest.Mock; listRaters: jest.Mock };
    let service: CsiRaterBulkService;
    let registered: string[];

    beforeEach(() => {
        registered = ['u2'];
        users = {
            find: jest.fn(async (options: any) => {
                if (Array.isArray(options.where)) {
                    const [byEmail, byNik] = options.where;
                    const emails: string[] = byEmail.email.getQuery ? [] : byEmail.email._objectLiteralParameters?.keys ?? [];
                    const niks: string[] = byNik.employeeId._value;
                    return USERS.filter((user) => emails.includes(user.email.toLowerCase()) || niks.includes(user.employeeId as string));
                }
                const { siteId, departmentId } = options.where;
                return USERS.filter((user) => (!siteId || user.siteId === siteId) && (!departmentId || user.departmentId === departmentId));
            }),
        };
        raters = {
            find: jest.fn(async (options: any) => registered.filter((id) => options.where.userId._value.includes(id)).map((userId) => ({ userId }))),
            delete: jest.fn(async () => ({ affected: 1 })),
        };
        master = { addRaters: jest.fn(async () => []), listRaters: jest.fn(async () => []) };
        service = new CsiRaterBulkService(users, raters, master as any);
    });

    it('group preview counts the site, skips already registered users and samples the rest (nothing written)', async () => {
        expect(await service.previewGroup(ICT, { siteId: 's1' })).toEqual({ total: 2, alreadyRegistered: 1, toAdd: 1, sample: ['Andi'] });
        expect(master.addRaters).not.toHaveBeenCalled();
    });

    it('adds a site + department group', async () => {
        expect(await service.addGroup(ICT, { siteId: 's2', departmentId: 'd1' })).toMatchObject({ added: 1 });
        expect(master.addRaters).toHaveBeenCalledWith(ICT, ['u3']);
    });

    it('a group needs a site or a department', async () => {
        await expect(service.previewGroup(ICT, {})).rejects.toBeInstanceOf(BadRequestException);
    });

    it('import matches emails case-insensitively and NIKs, lists what was not found, and only writes on commit', async () => {
        const keys = [' andi@sja.co.id ', '00002', 'tidak@ada.id', 'citra@sja.co.id', ''];
        const dry = await service.importKeys(ICT, keys, false);
        expect(dry).toMatchObject({ matched: 3, alreadyRegistered: 1, toAdd: 2, added: 0, notFound: ['tidak@ada.id'] });
        expect(master.addRaters).not.toHaveBeenCalled();
        const done = await service.importKeys(ICT, keys, true);
        expect(done.added).toBe(2);
        expect(master.addRaters).toHaveBeenCalledWith(ICT, ['u1', 'u3']);
    });

    it('removes several raters of the scope at once', async () => {
        await service.removeMany(ICT, ['r1', 'r2', 'r1']);
        expect(raters.delete).toHaveBeenCalledWith({ scope: ICT, id: expect.objectContaining({ _value: ['r1', 'r2'] }) });
    });
});
