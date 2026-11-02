import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { applyReactionsToCaches } from '../ticketMessageCache';
import { cachedTicket } from './cacheTestHelpers';

describe('applyReactionsToCaches', () => {
    it('replaces the reactions of one message in both caches', () => {
        const client = new QueryClient();
        const reactions = [{ emoji: '\u{1F44D}', count: 1, userIds: ['u-1'], userNames: ['Budi'] }];
        client.setQueryData(['ticket', 't-1'], { id: 't-1', messages: [{ id: 'a', reactions: [] }, { id: 'b' }] });
        client.setQueryData(['ticket-messages', 't-1'], [{ id: 'a' }]);

        applyReactionsToCaches(client, 't-1', 'a', reactions);

        expect(cachedTicket(client, 't-1').messages).toEqual([{ id: 'a', reactions }, { id: 'b' }]);
        expect(client.getQueryData(['ticket-messages', 't-1'])).toEqual([{ id: 'a', reactions }]);
    });
});
