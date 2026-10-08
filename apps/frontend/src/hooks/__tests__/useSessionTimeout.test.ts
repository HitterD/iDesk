import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSessionTimeout } from '../useSessionTimeout';
import { useAuth } from '../../stores/useAuth';
import { refreshSession } from '../../lib/api';
import { toast } from 'sonner';

vi.mock('../../lib/api', () => ({ default: {}, refreshSession: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
const user = { id: 'one', email: 'one@idesk.com', fullName: 'One', role: 'USER' as const };
beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/dashboard');
    useAuth.getState().login(user, new Date(Date.now() + 1000).toISOString());
});
afterEach(() => { vi.useRealTimers(); });

describe('proactive session lifecycle', () => {
    it.each([undefined, 429, 500])('preserves session and displays error for transient timeout refresh %s', async (status) => {
        vi.mocked(refreshSession).mockRejectedValue(status ? { response: { status } } : new Error('offline'));
        renderHook(() => useSessionTimeout());
        await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
        expect(useAuth.getState().isAuthenticated).toBe(true);
        expect(toast.error).toHaveBeenCalled();
    });
    it('ignores timeout rejection belonging to a previous login', async () => {
        let reject!: (reason: unknown) => void;
        vi.mocked(refreshSession).mockReturnValueOnce(new Promise((_resolve, fail) => { reject = fail; }));
        renderHook(() => useSessionTimeout());
        await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
        act(() => { useAuth.getState().login({ ...user, id: 'new' }, new Date(Date.now() + 3600000).toISOString()); });
        await act(async () => { reject({ response: { status: 401 } }); });
        expect(useAuth.getState().user?.id).toBe('new');
        expect(toast.error).not.toHaveBeenCalled();
    });
    it('logs out the current lifecycle when refresh is genuinely rejected', async () => {
        vi.mocked(refreshSession).mockRejectedValue({ response: { status: 401 } });
        renderHook(() => useSessionTimeout());
        await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
        expect(useAuth.getState().isAuthenticated).toBe(false);
    });
});
