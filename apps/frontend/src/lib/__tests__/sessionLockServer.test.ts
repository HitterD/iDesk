import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSessionLockServer } from '../sessionLockServer';
afterEach(() => vi.useRealTimers());
describe('shared worker two-client lock', () => {
    it('grants the second client only after the first cookie response and state application release', () => {
        vi.useFakeTimers();
        const server = createSessionLockServer();
        const first = { postMessage: vi.fn() }, second = { postMessage: vi.fn() };
        server.receive(first, { type: 'acquire', id: 'one' });
        server.receive(second, { type: 'acquire', id: 'two' });
        expect(first.postMessage).toHaveBeenCalledWith({ type: 'granted', id: 'one' });
        expect(second.postMessage).not.toHaveBeenCalled();
        server.receive(first, { type: 'release', id: 'one' });
        expect(second.postMessage).toHaveBeenCalledWith({ type: 'granted', id: 'two' });
        server.receive(second, { type: 'release', id: 'two' });
    });
    it.each(['disconnect', 'timeout'])('fails closed on holder %s instead of overlapping an uncertain request', (reason) => {
        vi.useFakeTimers();
        const server = createSessionLockServer();
        const first = { postMessage: vi.fn() }, second = { postMessage: vi.fn() };
        server.receive(first, { type: 'acquire', id: 'one' });
        server.receive(second, { type: 'acquire', id: 'two' });
        if (reason === 'disconnect') server.disconnect(first);
        else vi.advanceTimersByTime(45_000);
        expect(second.postMessage).toHaveBeenCalledWith({ type: 'failed', id: 'two' });
        server.receive(first, { type: 'release', id: 'one' });
        expect(second.postMessage).not.toHaveBeenCalledWith({ type: 'granted', id: 'two' });
    });
});
