import { BadRequestException } from '@nestjs/common';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { CsiOrgService } from './csi-org.service';

describe('CsiOrgService.updatePic', () => {
    const base = { id: 'pic-1', scope: ServiceScope.HC, nik: '1', fullName: 'RARA', jobTitle: null, serviceCode: 'HCD', serviceFunction: null, bagian: null, workLocation: null, siteId: null, userId: null, photoUrl: null, isActive: true, user: null };
    const make = () => {
        const pics = { findOne: jest.fn(async () => ({ ...base })), save: jest.fn(async (value: any) => value) };
        return { pics, service: new CsiOrgService({} as any, pics as any, {} as any, {} as any) };
    };

    it('trims the service function and clears it when empty', async () => {
        const { service } = make();
        expect((await service.updatePic(ServiceScope.HC, 'pic-1', { serviceFunction: '  People & Organization Development  ' })).serviceFunction)
            .toBe('People & Organization Development');
        expect((await service.updatePic(ServiceScope.HC, 'pic-1', { serviceFunction: '   ' })).serviceFunction).toBeNull();
    });

    it('rejects a service function longer than 150 characters', async () => {
        const { service } = make();
        await expect(service.updatePic(ServiceScope.HC, 'pic-1', { serviceFunction: 'x'.repeat(151) })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('changes only the given fields', async () => {
        const { service, pics } = make();
        await service.updatePic(ServiceScope.HC, 'pic-1', { isActive: false });
        expect(pics.save).toHaveBeenCalledWith(expect.objectContaining({ isActive: false, serviceFunction: null }));
    });

    it('links and unlinks an iDesk account and rejects inactive or duplicate accounts', async () => {
        const picRow = { ...base };
        const pics = {
            findOne: jest.fn(async ({ where }: any) => (where?.userId === 'u-taken' ? { ...base, id: 'pic-2', fullName: 'LAIN' } : where?.userId ? null : { ...picRow })),
            save: jest.fn(async (value: any) => value),
        };
        const account = { id: 'u-1', fullName: 'Rara Akun', email: 'rara@santos.co.id', isActive: true };
        const users = {
            findOne: jest.fn(async ({ where }: any) => (where?.id === 'u-1' || where?.id === 'u-taken' ? { ...account, id: where.id } : null)),
        };
        const service = new CsiOrgService({} as any, pics as any, users as any, {} as any);

        const linked = await service.updatePic(ServiceScope.HC, 'pic-1', { userId: 'u-1' });
        expect(linked.userId).toBe('u-1');
        expect(linked.user).toEqual({ id: 'u-1', fullName: 'Rara Akun', email: 'rara@santos.co.id' });

        await expect(service.updatePic(ServiceScope.HC, 'pic-1', { userId: 'u-missing' })).rejects.toBeInstanceOf(BadRequestException);
        await expect(service.updatePic(ServiceScope.HC, 'pic-1', { userId: 'u-taken' })).rejects.toThrow('LAIN');

        const unlinked = await service.updatePic(ServiceScope.HC, 'pic-1', { userId: null });
        expect(unlinked.userId).toBeNull();
        expect(unlinked.user).toBeNull();
    });
});

describe('CsiOrgService.accountSuggestions', () => {
    it('matches active iDesk users by name, email, or NIK', async () => {
        const users = {
            find: jest.fn(async () => [
                { id: 'u-1', fullName: 'Wahyu Purwo Anom', email: 'wahyu.anom@santos.co.id', employeeId: '00001234', siteId: 's1', site: { code: 'SPJ' }, department: { name: 'HC' } },
                { id: 'u-2', fullName: 'Agus Sulistyono', email: 'agus@santos.co.id', employeeId: '00009999', siteId: 's1', site: { code: 'SPJ' }, department: { name: 'GA' } },
            ]),
        };
        const service = new CsiOrgService({} as any, {} as any, users as any, {} as any);
        expect((await service.accountSuggestions('00001234')).map((u) => u.id)).toEqual(['u-1']);
        expect((await service.accountSuggestions('agus@')).map((u) => u.id)).toEqual(['u-2']);
        expect((await service.accountSuggestions('Wahyu')).map((u) => u.id)).toEqual(['u-1']);
    });
});

describe('CsiOrgService.syncPicsFromDirectory', () => {
    it('keeps PICs used by an assignment template active even when they are not in an HC department', async () => {
        const existing = [
            { id: 'pic-tpl', scope: ServiceScope.HC, nik: '2001', fullName: 'PRISCILLA', isActive: true },
            { id: 'pic-gone', scope: ServiceScope.HC, nik: '9999', fullName: 'LEFT', isActive: true },
        ];
        const people = { find: jest.fn(async () => []) };
        const pics = { find: jest.fn(async () => existing), save: jest.fn(), update: jest.fn(), query: jest.fn(async () => [{ picId: 'pic-tpl' }]) };
        const service = new CsiOrgService(people as any, pics as any, { find: jest.fn(async () => []) } as any, { find: jest.fn(async () => []) } as any);
        await service.syncPicsFromDirectory(ServiceScope.HC);
        expect(pics.update).toHaveBeenCalledWith({ id: expect.objectContaining({ _value: ['pic-gone'] }) }, { isActive: false });
    });

    it('matches accounts whose employeeId lacks leading zeros to the normalized directory NIK', async () => {
        const people = { find: jest.fn(async () => [{ nik: '00001234', fullName: 'DEWI', department: 'HC DEVELOPMENT', bagian: 'TA', jobTitle: 'Staff', workLocation: 'SJA-3' }]) };
        const pics = { find: jest.fn(async () => []), save: jest.fn(async (rows: any) => rows), update: jest.fn(), query: jest.fn(async () => []) };
        const users = { find: jest.fn(async () => [{ id: 'u-dewi', employeeId: '1234' }]) };
        const sites = { find: jest.fn(async () => [{ id: 'site-skd', code: 'SKD' }]) };
        const service = new CsiOrgService(people as any, pics as any, users as any, sites as any);
        await service.syncPicsFromDirectory(ServiceScope.HC);
        expect(pics.save).toHaveBeenCalledWith([expect.objectContaining({ nik: '00001234', siteId: 'site-skd', userId: 'u-dewi' })]);
    });
});

describe('CsiOrgService.syncUsersSiteFromDirectory', () => {
    it('moves active users with matching normalized NIK to the site of their directory workLocation', async () => {
        const sites = { find: jest.fn(async () => [{ id: 's-spj', code: 'SPJ' }, { id: 's-skd', code: 'SKD' }]) };
        const users = {
            find: jest.fn(async () => [
                { id: 'u-1', employeeId: '1001', siteId: 's-spj' },
                { id: 'u-2', employeeId: '00001002', siteId: 's-skd' },
                { id: 'u-3', employeeId: '1003', siteId: 's-spj' },
            ]),
            update: jest.fn(async () => ({})),
        };
        const service = new CsiOrgService({} as any, {} as any, users as any, sites as any);
        const updated = await service.syncUsersSiteFromDirectory([
            { nik: '00001001', workLocation: 'SJA-3' },
            { nik: '00001002', workLocation: 'SJA 3' },
            { nik: '00001003', workLocation: 'UNKNOWN' },
        ]);
        expect(updated).toBe(1);
        expect(users.update).toHaveBeenCalledTimes(1);
        expect(users.update).toHaveBeenCalledWith({ id: expect.objectContaining({ _value: ['u-1'] }) }, { siteId: 's-skd' });
    });
});
