import { renderHook, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TICKET_SHORTCUTS, useTicketShortcuts } from '../useTicketShortcuts';

describe('useTicketShortcuts', () => {
    it('triggers onReply on R and onResolve on Ctrl+Enter outside text inputs', () => {
        const onReply = vi.fn();
        const onResolve = vi.fn();

        renderHook(() => useTicketShortcuts({ onReply, onResolve }, { enabled: true, ticketNumber: '190826-GEN-0001' }));

        fireEvent.keyDown(window, { key: 'r' });
        expect(onReply).toHaveBeenCalledTimes(1);

        fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });
        expect(onResolve).toHaveBeenCalledTimes(1);
    });

    it('does not swallow native Ctrl+A, Ctrl+S, or Ctrl+P browser shortcuts', () => {
        renderHook(() => useTicketShortcuts({ onReply: vi.fn(), onResolve: vi.fn() }, { enabled: true }));

        for (const key of ['a', 's', 'p']) {
            const evt = new KeyboardEvent('keydown', { key, ctrlKey: true, cancelable: true });
            window.dispatchEvent(evt);
            expect(evt.defaultPrevented).toBe(false);
        }
        expect(TICKET_SHORTCUTS.some((s) => s.keys.includes('A') || s.keys.includes('S') || s.keys.includes('P'))).toBe(false);
    });

    it('ignores shortcuts while focus is inside an input or textarea', () => {
        const onReply = vi.fn();
        const onResolve = vi.fn();
        const textarea = document.createElement('textarea');
        document.body.appendChild(textarea);
        textarea.focus();

        renderHook(() => useTicketShortcuts({ onReply, onResolve }, { enabled: true }));

        fireEvent.keyDown(textarea, { key: 'r' });
        fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });

        expect(onReply).not.toHaveBeenCalled();
        expect(onResolve).not.toHaveBeenCalled();
        textarea.remove();
    });
});
