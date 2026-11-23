import 'reflect-metadata';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { HardwareRequestController } from './hardware-request.controller';
import { InstallationController } from './installation.controller';
import { NotInRequestFlowGuard } from '../guards/not-in-request-flow.guard';

type Ctor = { prototype: Record<string, unknown> };
const METHODS: Record<number, string> = { [RequestMethod.GET]: 'GET', [RequestMethod.POST]: 'POST', [RequestMethod.PATCH]: 'PATCH', [RequestMethod.PUT]: 'PUT', [RequestMethod.DELETE]: 'DELETE' };

/** "POST :id/cancel" -> whether the route refuses requests that live on a ticket. */
function routes(controller: Ctor): Map<string, boolean> {
    const out = new Map<string, boolean>();
    for (const name of Object.getOwnPropertyNames(controller.prototype)) {
        const handler = controller.prototype[name] as object;
        const path = Reflect.getMetadata(PATH_METADATA, handler);
        if (path === undefined) continue;
        const guards: unknown[] = Reflect.getMetadata(GUARDS_METADATA, handler) ?? [];
        out.set(`${METHODS[Reflect.getMetadata(METHOD_METADATA, handler)]} ${path}`, guards.includes(NotInRequestFlowGuard));
    }
    return out;
}

/** The ticket page itself calls these (scheduling and starting the install are keyed by the hardware request). */
const USED_BY_THE_TICKET_PAGE = [
    'POST :id/schedule/propose', 'POST :id/schedule/:scheduleId/select-slot', 'POST :id/schedule/:scheduleId/request-reschedule', 'POST :id/install/start',
];
const MUST_REFUSE = [
    'POST :id/cancel', 'POST :id/close', 'POST :id/review', 'POST :id/approve', 'POST :id/reject', 'PATCH :id/items/:itemId',
    'POST :id/procurement/decision', 'POST :id/procurement/complete', 'POST :id/confirm-installation', 'PATCH :id',
    'POST :id/schedule', 'POST :id/schedule/confirm', 'POST :id/schedule/reschedule', 'POST :id/items/:itemId/barcode',
    'POST :id/install/complete', 'PATCH :id/items/:itemId/delivery',
];

describe('legacy hardware-request routes and the request flow', () => {
    const all = new Map([...routes(HardwareRequestController as never), ...routes(InstallationController as never)]);

    it.each(MUST_REFUSE)('%s refuses a request that lives on a ticket', (route) => {
        expect(all.has(route)).toBe(true);
        expect(all.get(route)).toBe(true);
    });

    it.each(USED_BY_THE_TICKET_PAGE)('%s stays open: the request ticket page calls it', (route) => {
        expect(all.has(route)).toBe(true);
        expect(all.get(route)).toBe(false);
    });
});
