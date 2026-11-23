import 'reflect-metadata';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { EFormRequestController } from './eform-request.controller';
import { EFormDocumentController } from './eform-document.controller';
import { NotInEformFlowGuard } from './ticket-link/not-in-eform-flow.guard';

type Ctor = { prototype: Record<string, unknown> };
const METHODS: Record<number, string> = { [RequestMethod.GET]: 'GET', [RequestMethod.POST]: 'POST', [RequestMethod.PATCH]: 'PATCH' };

function routes(controller: Ctor): Map<string, boolean> {
    const out = new Map<string, boolean>();
    for (const name of Object.getOwnPropertyNames(controller.prototype)) {
        const handler = controller.prototype[name] as object;
        const path = Reflect.getMetadata(PATH_METADATA, handler);
        if (path === undefined) continue;
        const guards: unknown[] = Reflect.getMetadata(GUARDS_METADATA, handler) ?? [];
        out.set(`${METHODS[Reflect.getMetadata(METHOD_METADATA, handler)]} ${path}`, guards.includes(NotInEformFlowGuard));
    }
    return out;
}

const MUST_REFUSE = ['PATCH :id/manager-approve', 'PATCH :id/reject', 'PATCH :id/gm-step', 'PATCH :id/gm-approve', 'POST :id/gm-approval', 'POST :id/credentials', 'POST :id/fulfill'];

describe('legacy e-form routes and the request flow', () => {
    const all = new Map([...routes(EFormRequestController as never), ...routes(EFormDocumentController as never)]);
    it.each(MUST_REFUSE)('%s refuses an e-form that lives on a ticket', (route) => {
        expect(all.has(route)).toBe(true);
        expect(all.get(route)).toBe(true);
    });
});
