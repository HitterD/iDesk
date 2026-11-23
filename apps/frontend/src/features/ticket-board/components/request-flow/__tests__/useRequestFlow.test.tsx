import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/lib/api';
import { flowCalls, useRequestFlow, useRequestFlowAction } from '../useRequestFlow';

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn() } }));

const TID = '0b6d3c4e-1111-4222-8333-444455556677';

function wrapper() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const Wrap = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    return { Wrap, invalidate };
}

describe('useRequestFlow', () => {
    beforeEach(() => { vi.mocked(api.get).mockReset(); vi.mocked(api.post).mockReset(); vi.mocked(api.put).mockReset(); });

    it('loads the flow of a request ticket', async () => {
        vi.mocked(api.get).mockResolvedValue({ data: { kind: 'EFORM', phase: 'review' } });
        const { Wrap } = wrapper();
        const { result } = renderHook(() => useRequestFlow(TID, true), { wrapper: Wrap });
        await waitFor(() => expect(result.current.data?.phase).toBe('review'));
        expect(api.get).toHaveBeenCalledWith(`/request-flow/${TID}`);
    });

    it('does not call the API for an ordinary IT ticket', () => {
        const { Wrap } = wrapper();
        renderHook(() => useRequestFlow(TID, false), { wrapper: Wrap });
        expect(api.get).not.toHaveBeenCalled();
    });
});

describe('flowCalls', () => {
    it('maps every action to its endpoint', () => {
        expect(flowCalls.review(TID, { route: 'MANAGER' })).toEqual({ method: 'post', url: `/request-flow/${TID}/review`, body: { route: 'MANAGER' } });
        expect(flowCalls.decision(TID, { decision: 'APPROVE' })).toMatchObject({ url: `/request-flow/${TID}/decision` });
        expect(flowCalls.editItems(TID, { items: [], reason: 'x' })).toMatchObject({ method: 'put', url: `/request-flow/${TID}/items` });
        expect(flowCalls.procure(TID, { lines: [] })).toMatchObject({ url: `/request-flow/${TID}/procurement` });
        expect(flowCalls.arrivals(TID, { itemIds: [] })).toMatchObject({ url: `/request-flow/${TID}/arrivals` });
        expect(flowCalls.installDone(TID, { assets: [], signatureData: 's' })).toMatchObject({ url: `/request-flow/${TID}/install-done` });
        expect(flowCalls.fulfill(TID, { mode: 'NO_CREDENTIALS', signatureData: 's' })).toMatchObject({ url: `/request-flow/${TID}/fulfill` });
        expect(flowCalls.confirm(TID, { result: 'OK' })).toMatchObject({ url: `/request-flow/${TID}/confirm` });
        expect(flowCalls.documentNumber(TID, 'F/1')).toMatchObject({ method: 'patch', body: { value: 'F/1' } });
        expect(flowCalls.remind(TID)).toMatchObject({ url: `/request-flow/${TID}/remind` });
    });

    it('scheduling uses the hardware endpoints keyed by the hardware request and the schedule', () => {
        expect(flowCalls.proposeSchedule('hr-1', { slots: [] })).toMatchObject({ method: 'post', url: '/hardware-requests/hr-1/schedule/propose' });
        expect(flowCalls.selectSlot('hr-1', 's-1', { slotIndex: 0 })).toMatchObject({ url: '/hardware-requests/hr-1/schedule/s-1/select-slot' });
        expect(flowCalls.requestReschedule('hr-1', 's-1', { reason: 'sibuk' })).toMatchObject({ url: '/hardware-requests/hr-1/schedule/s-1/request-reschedule' });
        expect(flowCalls.startInstall('hr-1')).toMatchObject({ url: '/hardware-requests/hr-1/install/start' });
    });
});

describe('useRequestFlowAction', () => {
    beforeEach(() => { vi.mocked(api.post).mockReset(); });

    it('sends the call and refreshes the flow, the ticket and the lists', async () => {
        vi.mocked(api.post).mockResolvedValue({ data: { ok: true } });
        const { Wrap, invalidate } = wrapper();
        const { result } = renderHook(() => useRequestFlowAction(TID), { wrapper: Wrap });
        await act(async () => { await result.current.mutateAsync(flowCalls.review(TID, { route: 'NONE' })); });
        expect(api.post).toHaveBeenCalledWith(`/request-flow/${TID}/review`, { route: 'NONE' });
        const keys = invalidate.mock.calls.map(([filter]) => JSON.stringify((filter as { queryKey: unknown }).queryKey));
        expect(keys).toEqual(expect.arrayContaining([JSON.stringify(['request-flow', TID]), JSON.stringify(['ticket', TID]), JSON.stringify(['tickets']), JSON.stringify(['dashboard-stats'])]));
    });

    it('a failed call leaves the data alone and rejects with the server message', async () => {
        vi.mocked(api.post).mockRejectedValue({ response: { data: { message: 'Status tiket berubah. Muat ulang detail tiket.' } } });
        const { Wrap, invalidate } = wrapper();
        const { result } = renderHook(() => useRequestFlowAction(TID), { wrapper: Wrap });
        await expect(result.current.mutateAsync(flowCalls.confirm(TID, { result: 'OK' }))).rejects.toBeDefined();
        expect(invalidate).not.toHaveBeenCalled();
    });
});
