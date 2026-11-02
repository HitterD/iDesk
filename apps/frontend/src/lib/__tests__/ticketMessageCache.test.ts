import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { replaceMessageInCaches } from '../ticketMessageCache';

describe('replaceMessageInCaches', () => {
    it('keeps cached sender fields the server payload leaves out (avatar)', () => {
        const client = new QueryClient();
        client.setQueryData(['ticket', 't-1'], {
            id: 't-1',
            messages: [{ id: 'm-1', content: 'lama', sender: { id: 'u-1', fullName: 'Budi', avatarUrl: '/a.png' } }],
        });

        replaceMessageInCaches(client, 't-1', { id: 'm-1', content: 'baru', sender: { id: 'u-1', fullName: 'Budi' } } as { id: string });

        expect((client.getQueryData(['ticket', 't-1']) as any).messages[0]).toEqual({
            id: 'm-1', content: 'baru', sender: { id: 'u-1', fullName: 'Budi', avatarUrl: '/a.png' },
        });
    });

    it('drops the files of a deleted message', () => {
        const client = new QueryClient();
        client.setQueryData(['ticket-messages', 't-1'], [{ id: 'm-1', content: 'x', attachments: ['/f.png'], attachmentInfo: [{ name: 'f.png' }] }]);

        replaceMessageInCaches(client, 't-1', { id: 'm-1', content: '', attachments: [], attachmentInfo: null, isDeleted: true } as { id: string });

        expect(client.getQueryData(['ticket-messages', 't-1'])).toEqual([
            { id: 'm-1', content: '', attachments: [], attachmentInfo: null, isDeleted: true },
        ]);
    });
});
