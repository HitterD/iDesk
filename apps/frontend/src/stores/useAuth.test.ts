import { describe, it, expect, vi } from 'vitest';
import { useAuth, performLogout } from './useAuth';
import api from '../lib/api';

const user = { id: 'one', email: 'one@idesk.com', fullName: 'One', role: 'USER' as const };
function synchronize(state: unknown) {
    window.dispatchEvent(new StorageEvent('storage', {
        key: 'auth-storage', newValue: JSON.stringify({ state, version: 0 }),
    }));
}

describe('browser session synchronization', () => {
    it('does not send queued logout against a newer login', async () => {
        let release!: () => void;
        Object.defineProperty(navigator, 'locks', { value: {
            request: async (_name: string, _options: unknown, callback: () => unknown) => {
                await new Promise<void>((done) => { release = done; });
                return callback();
            },
        }, configurable: true });
        useAuth.getState().login(user);
        const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} });
        const pending = performLogout();
        await vi.waitFor(() => expect(release).toBeDefined());
        useAuth.getState().login({ ...user, id: 'new' });
        release();
        await pending;
        expect(post).not.toHaveBeenCalled();
        expect(useAuth.getState().user?.id).toBe('new');
        post.mockRestore();
    });

    it('syncs same-account expiry without publishing a storage feedback event', () => {
        useAuth.getState().login(user, '2029-01-01T00:00:00.000Z');
        const generation = useAuth.getState().generation;
        const publish = vi.spyOn(Storage.prototype, 'setItem');
        synchronize({ user, isAuthenticated: true, expiresAt: '2030-01-01T00:00:00.000Z' });
        expect(useAuth.getState().expiresAt).toBe('2030-01-01T00:00:00.000Z');
        expect(useAuth.getState().generation).toBe(generation);
        expect(publish).not.toHaveBeenCalled();
        publish.mockRestore();
    });

    it.each([
        { isAuthenticated: 'yes', user },
        { isAuthenticated: true, user: { ...user, role: 'ROOT' } },
        { isAuthenticated: true, user, expiresAt: 'invalid' },
        { isAuthenticated: true, user, sessionId: {} },
    ])('ignores malformed external storage payload %j', (payload) => {
        useAuth.getState().login(user);
        const generation = useAuth.getState().generation;
        synchronize(payload);
        expect(useAuth.getState().user).toEqual(user);
        expect(useAuth.getState().generation).toBe(generation);
    });

    it('does not invalidate anonymous bootstrap when another tab publishes anonymous state', () => {
        useAuth.getState().logout();
        const generation = useAuth.getState().generation;
        synchronize({ user: null, isAuthenticated: false, expiresAt: null });
        expect(useAuth.getState().generation).toBe(generation);
    });

    it('logs out another tab without republishing or deleting storage', () => {
        useAuth.getState().login(user);
        const publish = vi.spyOn(Storage.prototype, 'setItem');
        const remove = vi.spyOn(Storage.prototype, 'removeItem');
        synchronize({ user: null, isAuthenticated: false, expiresAt: null });
        expect(useAuth.getState().isAuthenticated).toBe(false);
        expect(publish).not.toHaveBeenCalled();
        expect(remove).not.toHaveBeenCalled();
        publish.mockRestore();
        remove.mockRestore();
    });
});
