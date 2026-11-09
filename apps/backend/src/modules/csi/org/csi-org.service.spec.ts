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
