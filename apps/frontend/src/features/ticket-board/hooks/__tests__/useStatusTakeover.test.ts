import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '@/stores/useAuth';
import {
    isTakeoverConflict,
    needsTakeoverConfirm,
    REASSIGN_CONFIRMATION_REQUIRED,
    useStatusTakeover,
} from '../useStatusTakeover';

const ME = 'agent-me';
const OTHER = { id: 'agent-other', fullName: 'Agent Lain' };

const conflict = (data: Record<string, unknown>) => ({ response: { status: 409, data } });

describe('needsTakeoverConfirm', () => {
    it('is false when the current user is already the PIC', () => {
        expect(needsTakeoverConfirm({ status: 'TODO', assignedTo: { id: ME } }, 'IN_PROGRESS', ME)).toBe(false);
    });

    it('is false for an unassigned ticket (backend auto-assigns)', () => {
        expect(needsTakeoverConfirm({ status: 'TODO', assignedTo: null }, 'IN_PROGRESS', ME)).toBe(false);
    });

    it('is true when another agent is PIC and the ticket moves to IN_PROGRESS', () => {
        expect(needsTakeoverConfirm({ status: 'TODO', assignedTo: OTHER }, 'IN_PROGRESS', ME)).toBe(true);
    });

    it('is false when another agent is PIC but the new status is WAITING_VENDOR', () => {
        expect(needsTakeoverConfirm({ status: 'TODO', assignedTo: OTHER }, 'WAITING_VENDOR', ME)).toBe(false);
    });

    it('is false when the ticket is already IN_PROGRESS', () => {
        expect(needsTakeoverConfirm({ status: 'IN_PROGRESS', assignedTo: OTHER }, 'IN_PROGRESS', ME)).toBe(false);
    });
});

describe('isTakeoverConflict', () => {
    it('is true for a 409 carrying the takeover code', () => {
        expect(isTakeoverConflict(conflict({ code: REASSIGN_CONFIRMATION_REQUIRED }))).toBe(true);
    });

    it('is false for a 409 without the code', () => {
        expect(isTakeoverConflict(conflict({ message: 'Conflict' }))).toBe(false);
    });

    it('is false for non-axios values', () => {
        expect(isTakeoverConflict(new Error('boom'))).toBe(false);
        expect(isTakeoverConflict(undefined)).toBe(false);
    });
});

describe('useStatusTakeover', () => {
    const ticket = { id: 't-1', ticketNumber: '201026-GEN-0001', title: 'Printer', status: 'TODO', assignedTo: OTHER };

    const setRole = (role: 'AGENT' | 'MANAGER') =>
        useAuth.setState({ user: { id: ME, fullName: 'Saya', email: 'me@x.id', role }, isAuthenticated: true });

    beforeEach(() => setRole('AGENT'));

    it('sends immediately when no confirmation is needed', async () => {
        const send = vi.fn().mockResolvedValue(undefined);
        const { result } = renderHook(() => useStatusTakeover());

        let applied: boolean | undefined;
        await act(async () => {
            applied = await result.current.request({ ...ticket, assignedTo: null }, 'IN_PROGRESS', send);
        });

        expect(send).toHaveBeenCalledWith({});
        expect(applied).toBe(true);
        expect(result.current.dialogProps).toBeNull();
    });

    it('opens the dialog before sending and retries with takeover + reason on confirm', async () => {
        const send = vi.fn().mockResolvedValue(undefined);
        const { result } = renderHook(() => useStatusTakeover());

        let pending!: Promise<boolean>;
        act(() => {
            pending = result.current.request(ticket, 'IN_PROGRESS', send);
        });

        expect(send).not.toHaveBeenCalled();
        expect(result.current.dialogProps?.ticket?.assignedTo?.fullName).toBe('Agent Lain');
        expect(result.current.dialogProps?.targetAgent?.id).toBe(ME);
        expect(result.current.dialogProps?.onKeepAssignee).toBeUndefined();

        await act(async () => {
            await result.current.dialogProps?.onConfirm('Beban Kerja Penuh / Overload');
        });

        expect(send).toHaveBeenCalledWith({ takeover: true, reason: 'Beban Kerja Penuh / Overload' });
        await expect(pending).resolves.toBe(true);
        expect(result.current.dialogProps).toBeNull();
    });

    it('resolves false without sending when the user cancels', async () => {
        const send = vi.fn();
        const { result } = renderHook(() => useStatusTakeover());

        let pending!: Promise<boolean>;
        act(() => {
            pending = result.current.request(ticket, 'IN_PROGRESS', send);
        });
        act(() => result.current.dialogProps?.onClose());

        await expect(pending).resolves.toBe(false);
        expect(send).not.toHaveBeenCalled();
        expect(result.current.dialogProps).toBeNull();
    });

    it('opens the dialog with the server PIC when the first send hits a takeover 409', async () => {
        const send = vi.fn()
            .mockRejectedValueOnce(conflict({ code: REASSIGN_CONFIRMATION_REQUIRED, currentAssignee: { id: 'x', fullName: 'Agent Server' } }))
            .mockResolvedValueOnce(undefined);
        const { result } = renderHook(() => useStatusTakeover());

        await act(async () => {
            void result.current.request({ ...ticket, assignedTo: null }, 'IN_PROGRESS', send);
        });

        expect(result.current.dialogProps?.ticket?.assignedTo?.fullName).toBe('Agent Server');
    });

    it('offers keep-assignee to MANAGER and sends keepAssignee', async () => {
        setRole('MANAGER');
        const send = vi.fn().mockResolvedValue(undefined);
        const { result } = renderHook(() => useStatusTakeover());

        act(() => {
            void result.current.request(ticket, 'IN_PROGRESS', send);
        });
        await act(async () => {
            await result.current.dialogProps?.onKeepAssignee?.();
        });

        expect(send).toHaveBeenCalledWith({ keepAssignee: true });
    });

    it('rethrows non-takeover errors from the first send', async () => {
        const send = vi.fn().mockRejectedValue({ response: { status: 500, data: {} } });
        const { result } = renderHook(() => useStatusTakeover());

        await expect(result.current.request({ ...ticket, assignedTo: null }, 'IN_PROGRESS', send)).rejects.toBeTruthy();
    });

    it('shows the server message inside the dialog when the retry fails', async () => {
        const send = vi.fn().mockRejectedValue({ response: { status: 400, data: { message: 'Alasan pengambilalihan wajib diisi.' } } });
        const { result } = renderHook(() => useStatusTakeover());

        act(() => {
            void result.current.request(ticket, 'IN_PROGRESS', send);
        });

        await act(async () => {
            await expect(result.current.dialogProps?.onConfirm('x')).rejects.toThrow('Alasan pengambilalihan wajib diisi.');
        });
        expect(result.current.dialogProps).not.toBeNull();
    });

    it('requestBulk lists conflicting tickets from the bulk 409', async () => {
        const send = vi.fn()
            .mockRejectedValueOnce(conflict({
                code: REASSIGN_CONFIRMATION_REQUIRED,
                tickets: [{ id: 't-1', ticketNumber: '201026-GEN-0001', currentAssignee: { id: 'x', fullName: 'Agent A' } }],
            }))
            .mockResolvedValueOnce(undefined);
        const { result } = renderHook(() => useStatusTakeover());

        await act(async () => {
            void result.current.requestBulk(send);
        });

        expect(result.current.dialogProps?.ticketsSummary).toEqual([
            { ticketNumber: '201026-GEN-0001', assigneeName: 'Agent A' },
        ]);
    });
});
