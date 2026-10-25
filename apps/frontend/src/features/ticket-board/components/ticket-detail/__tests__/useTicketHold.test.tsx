import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTicketHold } from '../useTicketHold';

const holds = vi.hoisted(() => ({ hardware: null as unknown, eform: null as unknown }));
vi.mock('../../ticket-hardware', () => ({
    useHardwareHold: () => holds.hardware,
    statusSentence: (request: { status: string }) => `hw ${request.status}`,
}));
vi.mock('../../ticket-eform', () => ({
    useEFormHold: () => holds.eform,
    eformStatusSentence: (request: { status: string }) => `ef ${request.status}`,
}));

const hardware = { requestNumber: 'HR-2026-0012', status: 'INSTALLATION' };
const eform = { code: '#AB12CD34', status: 'PENDING_GM' };

describe('useTicketHold', () => {
    beforeEach(() => { holds.hardware = null; holds.eform = null; });

    it('is null for a real vendor wait', () => {
        expect(renderHook(() => useTicketHold({ id: 't-1', status: 'WAITING_VENDOR' })).result.current).toBeNull();
    });

    it('names the request the ticket waits on', () => {
        holds.hardware = hardware;
        expect(renderHook(() => useTicketHold({ id: 't-1', status: 'WAITING_VENDOR' })).result.current)
            .toEqual({ label: 'Menunggu hardware', code: 'HR-2026-0012', detail: 'hw INSTALLATION' });
        holds.hardware = null; holds.eform = eform;
        expect(renderHook(() => useTicketHold({ id: 't-1', status: 'WAITING_VENDOR' })).result.current)
            .toEqual({ label: 'Menunggu E-Form', code: '#AB12CD34', detail: 'ef PENDING_GM' });
    });

    it('says both when the ticket waits on a hardware request and an e-form at once', () => {
        holds.hardware = hardware; holds.eform = eform;
        const hold = renderHook(() => useTicketHold({ id: 't-1', status: 'WAITING_VENDOR' })).result.current;
        expect(hold?.label).toBe('Menunggu hardware & E-Form');
        expect(hold?.code).toBe('HR-2026-0012 · #AB12CD34');
        expect(hold?.detail).toContain('hw INSTALLATION');
        expect(hold?.detail).toContain('ef PENDING_GM');
    });
});
