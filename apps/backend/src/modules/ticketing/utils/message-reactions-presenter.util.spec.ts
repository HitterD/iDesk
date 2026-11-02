import { presentThread } from './message-presenter.util';

const msg = (over: Record<string, unknown>) => ({
    id: 'm', content: 'halo', senderId: 'u-1', sender: { fullName: 'Budi' }, attachments: [], attachmentInfo: null,
    deletedAt: null, deletedById: null, pinnedAt: null, pinnedById: null, replyToId: null, mentionedUserIds: [], ...over,
});
const reaction = (userId: string, fullName: string, emoji: string, minute: number) => ({
    userId, emoji, createdAt: new Date(Date.UTC(2026, 10, 2, 8, minute)), user: { id: userId, fullName, email: `${userId}@x.id` },
});

describe('presentThread reactions', () => {
    it('aggregates reactions per emoji with names and ids, in order of first use', () => {
        const [m] = presentThread([msg({
            reactions: [reaction('u-2', 'Ani', '❤️', 2), reaction('u-3', 'Citra', '👍', 1), reaction('u-4', 'Dodi', '👍', 3)],
        })]);
        expect(m.reactions).toEqual([
            { emoji: '👍', count: 2, userIds: ['u-3', 'u-4'], userNames: ['Citra', 'Dodi'] },
            { emoji: '❤️', count: 1, userIds: ['u-2'], userNames: ['Ani'] },
        ]);
        expect(JSON.stringify(m)).not.toContain('@x.id');
    });

    it('a deleted message has no reactions', () => {
        const [m] = presentThread([msg({ deletedAt: new Date(), reactions: [reaction('u-2', 'Ani', '❤️', 1)] })]);
        expect(m.reactions).toEqual([]);
        expect(JSON.stringify(m)).not.toContain('Ani');
    });

    it('a message loaded without its reactions has an empty list', () => {
        const [m] = presentThread([msg({})]);
        expect(m.reactions).toEqual([]);
    });
});
