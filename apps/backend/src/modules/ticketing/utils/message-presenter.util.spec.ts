import { presentMessage } from './message-presenter.util';

describe('presentMessage', () => {
    const live = {
        id: 'm-1', content: 'rahasia', senderId: 'u-1', attachments: ['/uploads/tickets/t-1/a.png'],
        attachmentInfo: [{ path: '/uploads/tickets/t-1/a.png', name: 'a.png', size: 1, mime: 'image/png' }],
        deletedAt: null, deletedById: null,
    };

    it('blanks content and files of a deleted message', () => {
        const out = presentMessage({ ...live, deletedAt: new Date(), deletedById: 'u-1' });
        expect(out).toMatchObject({ content: '', attachments: [], attachmentInfo: null, isDeleted: true, deletedByAdmin: false });
        expect(JSON.stringify(out)).not.toContain('rahasia');
        expect(out).not.toHaveProperty('deletedById');
    });

    it('marks a deletion by someone else as by admin', () => {
        expect(presentMessage({ ...live, deletedAt: new Date(), deletedById: 'admin-1' }).deletedByAdmin).toBe(true);
    });

    it('leaves a live message untouched', () => {
        expect(presentMessage(live)).toMatchObject({ content: 'rahasia', attachments: live.attachments, isDeleted: false, deletedByAdmin: false });
    });

    it('does not mutate its input', () => {
        const deleted = { ...live, deletedAt: new Date(), deletedById: 'u-1' };
        presentMessage(deleted);
        expect(deleted.content).toBe('rahasia');
        expect(deleted.deletedById).toBe('u-1');
    });
});
