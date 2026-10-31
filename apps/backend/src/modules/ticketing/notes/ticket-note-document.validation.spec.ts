import { validateNoteDocument } from './ticket-note-document.validation';

describe('validateNoteDocument', () => {
    it('accepts formatted document text without interpreting it as HTML', () => {
        expect(() => validateNoteDocument({ type: 'doc', content: [{ type: 'paragraph', content: [
            { type: 'text', text: '<script>alert(1)</script>', marks: [{ type: 'bold' }] },
        ] }] }, []) ) .not.toThrow();
    });
    it.each(['script', 'iframe', 'html'])('rejects unknown node %s', type => {
        expect(() => validateNoteDocument({ type: 'doc', content: [{ type }] }, [])).toThrow();
    });
    it('rejects externally sourced images', () => {
        expect(() => validateNoteDocument({ type: 'doc', content: [
            { type: 'image', attrs: { src: 'https://evil.example/image.png' } },
        ] }, [])).toThrow();
    });
    it('accepts only note-owned image identifiers', () => {
        const doc = { type: 'doc', content: [{ type: 'image', attrs: { attachmentId: 'image-1' } }] };
        expect(() => validateNoteDocument(doc, ['image-1'])).not.toThrow();
        expect(() => validateNoteDocument(doc, ['image-2'])).toThrow();
    });
    it('accepts the default TipTap paragraph attributes and nullable code language', () => {
        expect(() => validateNoteDocument({ type: 'doc', content: [
            { type: 'paragraph' }, { type: 'codeBlock', attrs: { language: null } },
        ] }, [])).not.toThrow();
    });

    it('rejects event handlers on otherwise valid nodes', () => {
        expect(() => validateNoteDocument({ type: 'doc', content: [
            { type: 'paragraph', attrs: { onclick: 'alert(1)' } },
        ] }, [])).toThrow();
    });
    it('rejects javascript links and unknown marks', () => {
        const text = { type: 'text', text: 'click', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] };
        expect(() => validateNoteDocument({ type: 'doc', content: [{ type: 'paragraph', content: [text] }] }, [])).toThrow();
    });
    it('rejects excessively nested input', () => {
        let node: any = { type: 'paragraph' };
        for (let i = 0; i < 30; i++) node = { type: 'blockquote', content: [node] };
        expect(() => validateNoteDocument({ type: 'doc', content: [node] }, [])).toThrow();
    });
});
