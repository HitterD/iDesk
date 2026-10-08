import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, type AxiosResponse } from 'axios';
import api, { refreshSession } from '../api';
import { useAuth } from '../../stores/useAuth';

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
const user = { id: 'one', email: 'one@idesk.com', fullName: 'One', role: 'USER' as const };

beforeEach(() => {
    Object.defineProperty(navigator, 'locks', { value: {
        request: async (_name: string, _options: unknown, callback: () => unknown) => callback(),
    }, configurable: true });
    useAuth.getState().login(user, '2030-01-01T00:00:00.000Z');
});

describe('session API lifecycle', () => {
    it('does not refresh or log out on a stale 401 after login', async () => {
        let rejectRequest!: (error: unknown) => void;
        let requestConfig: any;
        api.defaults.adapter = vi.fn((config) => {
            requestConfig = config;
            return new Promise((_resolve, reject) => { rejectRequest = reject; });
        });
        const pending = api.get('/tickets');
        await vi.waitFor(() => expect(requestConfig).toBeDefined());
        useAuth.getState().login({ ...user, id: 'new' });
        rejectRequest(new AxiosError('Unauthorized', undefined, requestConfig, undefined, {
            status: 401, data: {}, config: requestConfig, headers: {}, statusText: 'Unauthorized',
        }));
        await expect(pending).rejects.toThrow('Unauthorized');
        expect(useAuth.getState().user?.id).toBe('new');
        expect(api.defaults.adapter).toHaveBeenCalledTimes(1);
    });

    it.each([401, 429, 500, undefined])('does not mutate session merely on direct refresh error %s', async (status) => {
        api.defaults.adapter = async (config) => {
            throw new AxiosError('refresh unavailable', undefined, config, undefined, status ? {
                status, data: {}, config, headers: {}, statusText: 'error',
            } : undefined);
        };
        await expect(refreshSession()).rejects.toThrow('refresh unavailable');
        expect(useAuth.getState().isAuthenticated).toBe(true);
    });

    it.each([429, 500, undefined])('preserves session when 401 recovery hits transient refresh error %s', async (status) => {
        api.defaults.adapter = async (config) => {
            const responseStatus = config.url === '/auth/refresh' ? status : 401;
            throw new AxiosError('unavailable', undefined, config, undefined, responseStatus ? {
                status: responseStatus, data: {}, config, headers: {}, statusText: 'error',
            } : undefined);
        };
        await expect(api.get('/tickets')).rejects.toThrow('unavailable');
        expect(useAuth.getState().isAuthenticated).toBe(true);
    });

    it('shares one refresh response among concurrent callers', async () => {
        let resolve!: (response: AxiosResponse) => void;
        let requestConfig: any;
        const adapter = vi.fn((config) => {
            requestConfig = config;
            return new Promise<AxiosResponse>((done) => { resolve = done; });
        });
        api.defaults.adapter = adapter;
        const first = refreshSession();
        const second = refreshSession();
        await vi.waitFor(() => expect(adapter).toHaveBeenCalledTimes(1));
        resolve({ config: requestConfig, headers: {}, status: 200, statusText: 'OK', data: { user, expiresAt: '2031-01-01T00:00:00.000Z' } });
        await Promise.all([first, second]);
        expect(useAuth.getState().expiresAt).toBe('2031-01-01T00:00:00.000Z');
    });
});
