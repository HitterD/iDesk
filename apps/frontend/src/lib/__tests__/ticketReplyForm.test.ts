import { describe, expect, it } from 'vitest';
import { buildReplyForm } from '../ticketReplyForm';

describe('buildReplyForm', () => {
    it('sends content, the internal flag and the reply link', () => {
        const form = buildReplyForm({ content: 'sudah', isInternal: false, replyToId: 'm-1' });
        expect(form.get('content')).toBe('sudah');
        expect(form.get('isInternal')).toBe('false');
        expect(form.get('replyToId')).toBe('m-1');
    });

    it('sends the mentioned people as a JSON list', () => {
        const form = buildReplyForm({ content: '@Ani cek', mentionedUserIds: ['u-2', 'u-3'] });
        expect(form.get('mentionedUserIds')).toBe('["u-2","u-3"]');
    });

    it('leaves the reply link out when there is none, and adds every file', () => {
        const a = new File(['a'], 'a.png');
        const b = new File(['b'], 'b.pdf');
        const form = buildReplyForm({ content: 'x', files: [a, b] });
        expect(form.has('replyToId')).toBe(false);
        expect(form.getAll('files')).toHaveLength(2);
    });
});
