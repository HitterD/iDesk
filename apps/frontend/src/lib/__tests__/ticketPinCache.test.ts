import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
    appendOptimisticMessage,
    applyPinsToCaches,
    reconcileOptimisticMessage,
    removeOptimisticMessage,
} from '../ticketMessageCache';
import { cachedMessages, cachedTicket } from './cacheTestHelpers';

describe('applyPinsToCaches', () => {
    it('marks exactly the listed messages as pinned', () => {
        const client = new QueryClient();
        client.setQueryData(['ticket', 't-1'], {
            id: 't-1',
            messages: [
                { id: 'a', isPinned: true, pinnedAt: '2026-11-01T08:00:00Z' },
                { id: 'b', isPinned: false, pinnedAt: null },
                { id: 'c' },
            ],
        });
        client.setQueryData(['ticket-messages', 't-1'], [{ id: 'b' }]);

        applyPinsToCaches(client, 't-1', [{ id: 'b', senderName: 'Budi', snippet: 'x', pinnedAt: '2026-11-02T08:00:00Z', isInternal: false }]);

        const { messages } = cachedTicket(client, 't-1');
        expect(messages.map((m) => [m.id, Boolean(m.isPinned), m.pinnedAt ?? null])).toEqual([
            ['a', false, null],
            ['b', true, '2026-11-02T08:00:00Z'],
            ['c', false, null],
        ]);
        expect(cachedMessages(client, 't-1')[0]).toMatchObject({ isPinned: true });
    });

    it('updates explicit canUnpin booleans and preserves existing canUnpin across socket broadcasts', () => {
        const client = new QueryClient();
        client.setQueryData(['ticket', 't-1'], {
            id: 't-1',
            messages: [{ id: 'a', isPinned: true, pinnedAt: '2026-11-01T08:00:00Z', canUnpin: true }],
        });

        applyPinsToCaches(client, 't-1', [{ id: 'a', senderName: 'A', snippet: 'x', pinnedAt: '2026-11-01T08:00:00Z', isInternal: false }]);
        expect((cachedTicket(client, 't-1').messages[0] as { canUnpin?: boolean }).canUnpin).toBe(true);

        applyPinsToCaches(client, 't-1', [{ id: 'a', senderName: 'A', snippet: 'x', pinnedAt: '2026-11-01T08:00:00Z', isInternal: false, canUnpin: false }]);
        expect((cachedTicket(client, 't-1').messages[0] as { canUnpin?: boolean }).canUnpin).toBe(false);
    });

    it('appends, reconciles, and removes optimistic messages without duplicating socket arrivals', () => {
        const client = new QueryClient();
        client.setQueryData(['ticket', 't-1'], { id: 't-1', messages: [] });

        appendOptimisticMessage(client, 't-1', { id: 'temp-1', sender: { id: 'u-1' } });
        expect(cachedTicket(client, 't-1').messages).toHaveLength(1);

        reconcileOptimisticMessage(client, 't-1', 'temp-1', { id: 'real-1', sender: { id: 'u-1' } });
        expect(cachedTicket(client, 't-1').messages.map((m) => m.id)).toEqual(['real-1']);

        appendOptimisticMessage(client, 't-1', { id: 'temp-2' });
        appendOptimisticMessage(client, 't-1', { id: 'real-2' });
        reconcileOptimisticMessage(client, 't-1', 'temp-2', { id: 'real-2' });
        expect(cachedTicket(client, 't-1').messages.map((m) => m.id)).toEqual(['real-1', 'real-2']);

        appendOptimisticMessage(client, 't-1', { id: 'temp-3' });
        removeOptimisticMessage(client, 't-1', 'temp-3');
        expect(cachedTicket(client, 't-1').messages.map((m) => m.id)).toEqual(['real-1', 'real-2']);
    });
});
