import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { NotesDrawer } from './NotesDrawer';

vi.mock('./useTicketNotes', () => ({ useTicketNotes: () => ({
    notes: [], candidates: [{ id: 'b', fullName: 'Anggota B' }], loading: false, error: null,
    create: vi.fn(), refresh: vi.fn(),
}) }));
vi.mock('./NoteWorkspace', () => ({ NoteWorkspace: () => <div>Workspace</div> }));

describe('NotesDrawer', () => {
    it('offers a private empty state and member selection rather than public chat', () => {
        render(<NotesDrawer ticketId="t" userId="a" open onOpenChange={() => {}} />);
        expect(screen.getByText('Catatan Internal')).toBeInTheDocument();
        expect(screen.getByText(/hanya anggota yang dipilih/i)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /buat catatan/i }));
        expect(screen.getByLabelText('Judul catatan')).toBeInTheDocument();
        expect(screen.getByLabelText('Anggota B')).toBeInTheDocument();
        expect(screen.queryByText('Public Reply')).not.toBeInTheDocument();
    });
});
