import { BadRequestException } from '@nestjs/common';
import { IpopCatalogService } from '../ipop-catalog.service';
import { TicketType } from '../../../ticketing/entities/ticket.entity';

const modules = [
    { slug: 'it-support', name: 'IT Support Tickets', isActive: true, sortOrder: 1 },
    { slug: 'oracle-k2', name: 'Oracle K2 Request', isActive: true, sortOrder: 2 },
    { slug: 'web-developer', name: 'Web Developer Request', isActive: true, sortOrder: 3 },
    { slug: 'mobile-developer', name: 'Mobile Developer Request', isActive: true, sortOrder: 4 },
];

const build = () => new IpopCatalogService(
    { find: jest.fn().mockResolvedValue(modules) } as any,
    { find: jest.fn().mockResolvedValue([{ value: 'Billing' }]) } as any,
);

describe('IpopCatalogService', () => {
    it('lists the four ticket modules with the web form categories', async () => {
        const list = await build().listModules();

        expect(list.map((m) => m.slug)).toEqual(['it-support', 'oracle-k2', 'web-developer', 'mobile-developer']);
        expect(list[0].categories).toEqual(['GENERAL', 'HARDWARE', 'SOFTWARE', 'NETWORK', 'Billing', 'HARDWARE_INSTALLATION']);
        expect(list[0].supportsHardwareInstallation).toBe(true);
        expect(list[1]).toMatchObject({ categories: ['ORACLE_REQUEST'], defaultCategory: 'ORACLE_REQUEST', supportsHardwareInstallation: false });
    });

    // The module the user picked decides the queue, never the category text.
    it.each([
        ['oracle-k2', TicketType.ORACLE_REQUEST],
        ['web-developer', TicketType.WEB_DEV_REQUEST],
        ['mobile-developer', TicketType.MOBILE_DEV_REQUEST],
    ])('routes %s to its own request type', async (slug, type) => {
        const route = await build().resolveRoute(slug, undefined);
        expect(route).toMatchObject({ category: type, ticketType: type, isHardwareInstallation: false });
    });

    it('keeps IT Support tickets as SERVICE with the chosen category', async () => {
        expect(await build().resolveRoute('it-support', 'NETWORK')).toMatchObject({ category: 'NETWORK', ticketType: TicketType.SERVICE });
        expect(await build().resolveRoute('it-support', 'Billing')).toMatchObject({ category: 'Billing' });
    });

    it('marks hardware installation on IT Support', async () => {
        expect(await build().resolveRoute('it-support', 'HARDWARE_INSTALLATION'))
            .toMatchObject({ ticketType: TicketType.HARDWARE_INSTALLATION, isHardwareInstallation: true });
    });

    it('rejects a category that does not belong to the module instead of re-routing it', async () => {
        await expect(build().resolveRoute('oracle-k2', 'NETWORK')).rejects.toThrow(BadRequestException);
        // "Oracle" text on IT Support would have been routed to Oracle by the old category heuristic.
        await expect(build().resolveRoute('it-support', 'Oracle')).rejects.toThrow(/not valid/);
        await expect(build().resolveRoute('it-support', undefined)).rejects.toThrow(/required/);
    });

    it('rejects unknown or inactive modules', async () => {
        await expect(build().resolveRoute('hardware-request', 'GENERAL')).rejects.toThrow(/Unknown or inactive/);
    });
});
