import { AccessRequestService } from './access-request.service';
import { TicketType } from '../ticketing/entities/ticket.entity';

/** Sukodono's ICT requests are handled by Sepanjang: the access request's ticket is filed there. */
describe('AccessRequestService.create — handling site', () => {
    const build = (requesterSiteId: string) => {
        const ticketRepo = { create: jest.fn((v: any) => v), save: jest.fn(async (v: any) => ({ id: 't-1', ...v })) };
        const accessRequestRepo = { create: jest.fn((v: any) => v), save: jest.fn(async (v: any) => ({ id: 'ar-1', ...v })) };
        const service = new AccessRequestService(
            { logAsync: jest.fn() } as any,
            accessRequestRepo as any,
            { findOne: jest.fn(async () => ({ id: 'at-1', name: 'VPN' })) } as any,
            ticketRepo as any,
            { findOne: jest.fn(async () => ({ id: 'u-1', siteId: requesterSiteId })) } as any,
            { emit: jest.fn() } as any,
            {} as any,
            {} as any,
            { handlingSiteId: jest.fn(async (siteId: string | null) => (siteId === 'site-skd' ? 'site-spj' : siteId)) } as any,
        );
        return { service, ticketRepo };
    };
    const dto = { accessTypeId: 'at-1', requestedAccess: 'VPN', purpose: 'WFH' } as any;

    it('files a Sukodono requester\'s access ticket under Sepanjang', async () => {
        const { service, ticketRepo } = build('site-skd');
        await service.create('u-1', dto);
        expect(ticketRepo.create).toHaveBeenCalledWith(expect.objectContaining({
            ticketType: TicketType.ACCESS_REQUEST, userId: 'u-1', siteId: 'site-spj',
        }));
    });

    it('keeps other sites on their own site', async () => {
        const { service, ticketRepo } = build('site-krw');
        await service.create('u-1', dto);
        expect(ticketRepo.create).toHaveBeenCalledWith(expect.objectContaining({ siteId: 'site-krw' }));
    });
});
