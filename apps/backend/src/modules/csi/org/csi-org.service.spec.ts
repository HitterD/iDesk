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
});
