import { beforeEach, describe, it, expect, vi } from 'vitest';

beforeEach(() => {
    Object.defineProperty(navigator, 'locks', {
        value: { request: async (_name: string, _options: unknown, callback: () => unknown) => callback() },
        configurable: true,
    });
});
import { coordinateSession, singleFlightRefresh } from '../sessionCoordinator';
import type { AxiosResponse } from 'axios';

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((done) => { resolve = done; });
    return { promise, resolve };
}

describe('session cookie coordination', () => {
    it('shares refresh among callers in the same lifecycle', async () => {
        const pending = deferred<AxiosResponse>();
        const operation = vi.fn(() => pending.promise);
        const first = singleFlightRefresh(1, operation);
        const second = singleFlightRefresh(1, operation);
        expect(second).toBe(first);
        await Promise.resolve();
        expect(operation).toHaveBeenCalledTimes(1);
        pending.resolve({ data: { expiresAt: '2030-01-01T00:00:00.000Z' } } as AxiosResponse);
        await first;
    });

    it('keeps login queued until an earlier cookie response completes', async () => {
        const pending = deferred<void>();
        const order: string[] = [];
        const refresh = coordinateSession(async () => {
            order.push('refresh-start');
            await pending.promise;
            order.push('refresh-end');
        });
        const login = coordinateSession(async () => { order.push('login'); });
        await Promise.resolve();
        expect(order).toEqual(['refresh-start']);
        pending.resolve();
        await Promise.all([refresh, login]);
        expect(order).toEqual(['refresh-start', 'refresh-end', 'login']);
    });

    it('holds the browser exclusive lock until the cookie operation settles', async () => {
        const pending = deferred<void>();
        const request = vi.fn(async (_name, _options, callback) => callback());
        Object.defineProperty(navigator, 'locks', { value: { request }, configurable: true });
        const operation = coordinateSession(() => pending.promise);
        await Promise.resolve();
        expect(request).toHaveBeenCalledWith('idesk-auth-cookie', { mode: 'exclusive' }, expect.any(Function));
        pending.resolve();
        await operation;
        Object.defineProperty(navigator, 'locks', { value: undefined, configurable: true });
    });

    it('fails closed without Web Locks without sending cookie-changing requests', async () => {
        Object.defineProperty(navigator, 'locks', { value: undefined, configurable: true });
        const operation = vi.fn(async () => 'rotated');
        await expect(coordinateSession(operation)).rejects.toThrow('koordinasi sesi aman');
        expect(operation).not.toHaveBeenCalled();
    });

    it('continues after a rejected cookie operation', async () => {
        await expect(coordinateSession(async () => { throw new Error('offline'); })).rejects.toThrow('offline');
        await expect(coordinateSession(async () => 'login')).resolves.toBe('login');
    });
});
