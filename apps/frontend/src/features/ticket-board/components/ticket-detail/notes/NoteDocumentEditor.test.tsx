import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { NoteDocumentEditor } from './NoteDocumentEditor';
vi.mock('@/lib/api', () => ({ default: { get: vi.fn().mockResolvedValue({ data: [] }), post: vi.fn().mockRejectedValue(new Error('locked')) } }));
describe('NoteDocumentEditor', () => {
    it('does not offer editing for a closed ticket', () => {
        render(<NoteDocumentEditor note={{ id: 'n', ticketId: 't', document: { type: 'doc', content: [{ type: 'paragraph' }] } } as any} readonly />);
        expect(screen.queryByRole('button', { name: 'Edit dokumen' })).not.toBeInTheDocument();
        expect(screen.getByText('Dokumen bersama')).toBeInTheDocument();
    });
    it('explains a failed editing lease without claiming changes saved', async () => {
        render(<NoteDocumentEditor note={{ id: 'n', ticketId: 't', document: { type: 'doc', content: [{ type: 'paragraph' }] } } as any} readonly={false} />);
        fireEvent.click(screen.getByRole('button', { name: 'Edit dokumen' }));
        expect(await screen.findByRole('alert')).toHaveTextContent(/sedang diedit|sesi edit/i);
    });
});
