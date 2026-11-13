import { HandlingSiteService } from './handling-site.service';

describe('HandlingSiteService', () => {
    const sites: Record<string, { id: string; handledBySiteId: string | null }> = {
        'site-skd': { id: 'site-skd', handledBySiteId: 'site-spj' },
        'site-spj': { id: 'site-spj', handledBySiteId: null },
    };
    const repo = { findOne: jest.fn(async ({ where: { id } }) => sites[id] ?? null) };
    const service = new HandlingSiteService(repo as any);

    it('sends a site with a handling site to that site', async () => {
        await expect(service.handlingSiteId('site-skd')).resolves.toBe('site-spj');
    });

    it('keeps a site that handles its own requests', async () => {
        await expect(service.handlingSiteId('site-spj')).resolves.toBe('site-spj');
    });

    it('keeps an unknown site id as is and maps no site to null', async () => {
        await expect(service.handlingSiteId('site-gone')).resolves.toBe('site-gone');
        await expect(service.handlingSiteId(null)).resolves.toBeNull();
        await expect(service.handlingSiteId(undefined)).resolves.toBeNull();
    });
});
