import { ConfigService } from '@nestjs/config';
import { CacheService } from './cache.service';

describe('CacheService.getOrSet', () => {
    const build = () => new CacheService(
        { get: jest.fn((_key: string, fallback?: string) => fallback) } as unknown as ConfigService,
        { enabled: false, isReady: () => false } as any,
    );

    it('runs the factory once for concurrent misses on the same key', async () => {
        const cache = build();
        let resolveFactory: (value: number) => void = () => undefined;
        const factory = jest.fn(() => new Promise<number>((resolve) => { resolveFactory = resolve; }));

        const first = cache.getOrSet('stats:site-1', factory, 15);
        const second = cache.getOrSet('stats:site-1', factory, 15);
        await new Promise((resolve) => setImmediate(resolve));
        resolveFactory(42);

        await expect(Promise.all([first, second])).resolves.toEqual([42, 42]);
        expect(factory).toHaveBeenCalledTimes(1);
    });

    it('lets a later call retry after the factory fails', async () => {
        const cache = build();
        const factory = jest.fn()
            .mockRejectedValueOnce(new Error('db down'))
            .mockResolvedValueOnce('ok');

        await expect(cache.getOrSet('stats:site-1', factory, 15)).rejects.toThrow('db down');
        await expect(cache.getOrSet('stats:site-1', factory, 15)).resolves.toBe('ok');
        expect(factory).toHaveBeenCalledTimes(2);
    });
});
