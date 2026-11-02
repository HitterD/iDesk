import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { applyPinsToCaches } from '../ticketMessageCache';

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

        const messages = (client.getQueryData(['ticket', 't-1']) as any).messages;
        expect(messages.map((m: any) => [m.id, Boolean(m.isPinned), m.pinnedAt ?? null])).toEqual([
            ['a', false, null],
            ['b', true, '2026-11-02T08:00:00Z'],
            ['c', false, null],
        ]);
        expect((client.getQueryData(['ticket-messages', 't-1']) as any)[0]).toMatchObject({ isPinned: true });
    });
});
