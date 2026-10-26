import type { PropsWithChildren } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { usePublishCsiPeriod, useUnpublishCsiPeriod } from '../useCsi';

vi.mock('@/lib/api', () => ({ default: { post: vi.fn() } }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const cases = [
    { action: 'publish', useHook: usePublishCsiPeriod, publishStatus: 'PUBLISHED' },
    { action: 'unpublish', useHook: useUnpublishCsiPeriod, publishStatus: 'DRAFT' },
] as const;

describe.each(cases)('$action period', ({ action, useHook, publishStatus }) => {
    it('posts to the encoded endpoint, returns detail, and invalidates affected caches', async () => {
        const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
        const invalidate = vi.spyOn(client, 'invalidateQueries');
        const detail = { id: 'p/1', publishStatus, status: 'ACTIVE', readiness: { ready: true, checks: [] } };
        vi.mocked(api.post).mockResolvedValueOnce({ data: detail, status: 201 });
        const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
        const { result } = renderHook(() => useHook('hc', 'p/1'), { wrapper });

        await act(async () => { expect(await result.current.mutateAsync()).toEqual(detail); });

        expect(api.post).toHaveBeenCalledWith(`/csi/admin/hc/periods/p%2F1/${action}`);
        expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.csi.period('hc', 'p/1') });
        expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.csi.periods('hc') });
        expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.csi.active() });
        client.clear();
    });

    it('propagates backend errors without invalidating caches', async () => {
        const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
        const invalidate = vi.spyOn(client, 'invalidateQueries');
        const error = Object.assign(new Error('HTTP 409'), { response: { status: 409 } });
        vi.mocked(api.post).mockRejectedValueOnce(error);
        const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
        const { result } = renderHook(() => useHook('ict', 'p1'), { wrapper });

        await act(async () => { await expect(result.current.mutateAsync()).rejects.toBe(error); });

        expect(invalidate).not.toHaveBeenCalled();
        client.clear();
    });
});
