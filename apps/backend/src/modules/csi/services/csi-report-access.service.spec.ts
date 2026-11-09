import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { UserRole } from '../../users/enums/user-role.enum';
import { CsiReportAccessService } from './csi-report-access.service';

describe('CsiReportAccessService', () => {
    const owners: Array<{ id: string; scope: string; serviceCode: string; userId: string }> = [];
    const repo = {
        find: jest.fn(async ({ where }: any) => owners.filter((row) => Object.entries(where).every(([key, value]) => (row as any)[key] === value))),
        delete: jest.fn(async (where: any) => {
            for (let index = owners.length - 1; index >= 0; index -= 1) {
                if (owners[index].scope === where.scope && owners[index].serviceCode === where.serviceCode) owners.splice(index, 1);
            }
        }),
        save: jest.fn(async (rows: any[]) => { rows.forEach((row) => owners.push({ id: `o${owners.length}`, ...row })); return rows; }),
    };
    const roles: Record<string, string> = { admin: UserRole.HC_ADMIN, rara: UserRole.USER, budi: UserRole.USER };
    const access = { load: jest.fn(async (userId: string) => ({ role: roles[userId], pageAccess: {} })) };
    const users = { find: jest.fn(async ({ where }: any) => (where.id._value as string[]).filter((id) => roles[id]).map((id) => ({ id, fullName: id }))) };
    const service = new CsiReportAccessService(repo as any, users as any, access as any);

    beforeEach(() => { owners.splice(0); owners.push({ id: 'o1', scope: 'HC', serviceCode: 'HCD', userId: 'rara' }); });

    it('admins see every HC service; owners only their own; anyone else nothing', async () => {
        expect(await service.servicesFor('admin', ServiceScope.HC)).toEqual({ admin: true, services: ['HCC', 'HCD', 'HCS'] });
        expect(await service.servicesFor('rara', ServiceScope.HC)).toEqual({ admin: false, services: ['HCD'] });
        expect(await service.servicesFor('budi', ServiceScope.HC)).toEqual({ admin: false, services: [] });
    });

    it('assertService rejects a user who does not own that service', async () => {
        await expect(service.assertService('rara', ServiceScope.HC, 'HCD')).resolves.toEqual({ admin: false });
        await expect(service.assertService('rara', ServiceScope.HC, 'HCC')).rejects.toBeInstanceOf(ForbiddenException);
        await expect(service.assertService('budi', ServiceScope.HC, 'HCD')).rejects.toBeInstanceOf(ForbiddenException);
        await expect(service.assertService('admin', ServiceScope.HC, 'HCS')).resolves.toEqual({ admin: true });
    });

    it('setOwners replaces the owners of one service only and is idempotent', async () => {
        await service.setOwners(ServiceScope.HC, 'HCC', ['budi', 'budi']);
        await service.setOwners(ServiceScope.HC, 'HCC', ['budi']);
        expect(owners.filter((row) => row.serviceCode === 'HCC').map((row) => row.userId)).toEqual(['budi']);
        expect(owners.filter((row) => row.serviceCode === 'HCD').map((row) => row.userId)).toEqual(['rara']);
    });

    it('setOwners rejects an unknown service code and unknown users', async () => {
        await expect(service.setOwners(ServiceScope.HC, 'XYZ', [])).rejects.toBeInstanceOf(BadRequestException);
        await expect(service.setOwners(ServiceScope.HC, 'HCC', ['ghost'])).rejects.toBeInstanceOf(BadRequestException);
    });

    it('ICT has its own services (the handling teams); an HC owner owns nothing in ICT', async () => {
        owners.push({ id: 'o9', scope: 'ICT', serviceCode: 'ORACLE', userId: 'budi' });
        expect(await service.servicesFor('budi', ServiceScope.ICT)).toEqual({ admin: false, services: ['ORACLE'] });
        expect(await service.servicesFor('rara', ServiceScope.ICT)).toEqual({ admin: false, services: [] });
        await expect(service.setOwners(ServiceScope.ICT, 'HCD', [])).rejects.toBeInstanceOf(BadRequestException);
        expect((await service.listOwners(ServiceScope.ICT)).map((row) => row.serviceCode)).toEqual(['OPS', 'ORACLE', 'WEB', 'MOBILE', 'MGR']);
    });
});
