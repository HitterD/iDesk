import { presentThread } from './message-presenter.util';

const at = (m: number) => new Date(Date.UTC(2026, 10, 2, 8, m));
const msg = (over: Record<string, unknown>) => ({
    id: 'x', content: '', senderId: 'u-1', sender: { id: 'u-1', fullName: 'Budi Santoso' }, attachments: [], attachmentInfo: null,
    deletedAt: null, deletedById: null, pinnedAt: null, pinnedById: null, replyToId: null, createdAt: at(0), ...over,
});

describe('presentThread', () => {
    it('links a reply to its original with sender and snippet', () => {
        const [, reply] = presentThread([
            msg({ id: 'a', content: 'Printer lantai 2 mati' }),
            msg({ id: 'b', content: '↩ Budi Santoso: Printer lantai 2 mati\n\nSaya cek', senderId: 'u-2', replyToId: 'a' }),
        ]);
        expect(reply.replyTo).toEqual({ id: 'a', senderName: 'Budi Santoso', snippet: 'Printer lantai 2 mati', isDeleted: false });
    });

    it('blanks the quote of a reply whose original was deleted, in content and replyTo', () => {
        const [, reply] = presentThread([
            msg({ id: 'a', content: 'password wifi: rahasia123', deletedAt: at(5), deletedById: 'u-1' }),
            msg({ id: 'b', content: '↩ Budi Santoso: password wifi: rahasia123\n\nSudah saya catat', senderId: 'u-2', replyToId: 'a' }),
        ]);
        expect(JSON.stringify(reply)).not.toContain('rahasia123');
        expect(reply.content).toBe('↩ Budi Santoso: Pesan telah dihapus\n\nSudah saya catat');
        expect(reply.replyTo).toEqual({ id: 'a', senderName: 'Budi Santoso', snippet: '', isDeleted: true });
    });

    it('ignores a replyToId that is not in the thread', () => {
        const [only] = presentThread([msg({ id: 'b', content: 'halo', replyToId: 'elsewhere' })]);
        expect(only.replyTo).toBeNull();
        expect(only.content).toBe('halo');
    });

    it('exposes pin state with the pinner name, never pinnedById', () => {
        const [pinned, plain] = presentThread([
            msg({ id: 'a', content: 'SOP reset', pinnedAt: at(9), pinnedById: 'u-9', pinnedBy: { id: 'u-9', fullName: 'Ani Wijaya', email: 'ani@x.id' } }),
            msg({ id: 'b', content: 'ok' }),
        ]);
        expect(pinned).toMatchObject({ isPinned: true, pinnedAt: at(9), pinnedByName: 'Ani Wijaya' });
        expect(pinned).not.toHaveProperty('pinnedById');
        expect(pinned).not.toHaveProperty('pinnedBy');
        expect(plain).toMatchObject({ isPinned: false, pinnedAt: null, pinnedByName: null });
    });
});
