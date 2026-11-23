import 'reflect-metadata';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RequestFlowModule } from './request-flow.module';

/**
 * Production crashed at boot: a request-flow provider injected a repository the module never registered
 * (`EFormRequestRepository`). Unit tests mock every dependency, so only the module wiring itself can catch this.
 * Every repository a provider of this module injects must be registered by its own TypeOrmModule.forFeature.
 */
describe('RequestFlowModule wiring', () => {
    const imports: unknown[] = Reflect.getMetadata(MODULE_METADATA.IMPORTS, RequestFlowModule) ?? [];
    const providers: Array<new (...args: never[]) => unknown> = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, RequestFlowModule) ?? [];

    /** Tokens the forFeature import of this module provides (e.g. 'EFormRequestRepository'). */
    const registered = new Set<unknown>(imports.flatMap((entry) => {
        const dynamic = entry as { providers?: Array<{ provide: unknown }> };
        return (dynamic.providers ?? []).map((p) => p.provide);
    }));

    /** Repository tokens each provider asks for through @InjectRepository. */
    const injected = providers.flatMap((provider) => {
        const selfDeclared: Array<{ index: number; param: unknown }> = Reflect.getMetadata('self:paramtypes', provider) ?? [];
        return selfDeclared
            .filter(({ param }) => typeof param === 'string' && param.endsWith('Repository'))
            .map(({ param }) => ({ provider: provider.name, token: param }));
    });

    it('finds the repositories the providers inject (the check itself works)', () => {
        expect(injected.map((i) => i.token)).toEqual(expect.arrayContaining([getRepositoryToken({ name: 'User' } as never)].map(String)));
    });

    it.each(injected.map((i) => [i.provider, i.token]))('%s gets %s from this module', (_provider, token) => {
        expect(registered.has(token)).toBe(true);
    });
});
