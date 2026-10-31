import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NoteDiscussion } from './NoteDiscussion';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
vi.mock('@/lib/api', () => ({ default: api }));

const note = {
    id: 'n', ticketId: 't', createdById: 'me', selectedSolutionMessageId: 'm1',
    members: [{ id: 'me', fullName: 'Agent SPJ' }, { id: 'ops', fullName: 'Agen Ops Dua' }],
} as any;
const messages = [
    { id: 'm1', authorId: 'me', content: 'Cek stok roller ya', sequence: 1, createdAt: '2026-10-31T02:00:00Z', mentionedUserIds: ['ops'], attachmentIds: [] },
    { id: 'm2', authorId: 'ops', content: 'Ada 2 di gudang', sequence: 2, createdAt: '2026-10-31T02:01:00Z', mentionedUserIds: [], attachmentIds: [] },
];
const renderDiscussion = (readonly = false) => render(<QueryClientProvider client={new QueryClient()}>
    <NoteDiscussion note={note} userId="me" readonly={readonly} refresh={() => {}} />
</QueryClientProvider>);

describe('NoteDiscussion chat', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        api.get.mockResolvedValue({ data: { messages, throughSequence: 2 } });
        api.post.mockResolvedValue({ data: {} });
    });

    it('places own messages on the right and others on the left like a chat', async () => {
        renderDiscussion();
        const own = (await screen.findByText('Cek stok roller ya')).closest('[data-direction]');
        const other = screen.getByText('Ada 2 di gudang').closest('[data-direction]');
        expect(own).toHaveAttribute('data-direction', 'out');
        expect(other).toHaveAttribute('data-direction', 'in');
        expect(screen.getByText('Agen Ops Dua')).toBeInTheDocument();
    });

    it('marks the selected solution on its bubble', async () => {
        renderDiscussion();
        await screen.findByText('Cek stok roller ya');
        expect(screen.getByText('Solusi dipakai')).toBeInTheDocument();
    });

    it('sends with Enter and keeps Shift+Enter for a new line', async () => {
        renderDiscussion();
        const box = await screen.findByRole('textbox', { name: 'Tulis pesan diskusi' });
        fireEvent.change(box, { target: { value: 'Baik' } });
        fireEvent.keyDown(box, { key: 'Enter', shiftKey: true });
        expect(api.post).not.toHaveBeenCalledWith(expect.stringContaining('/messages'), expect.anything());
        fireEvent.keyDown(box, { key: 'Enter' });
        await waitFor(() => expect(api.post).toHaveBeenCalledWith('/tickets/t/notes/n/messages',
            expect.objectContaining({ content: 'Baik', mentionedUserIds: [] })));
    });

    it('turns an @ name pick into a mention sent with the message', async () => {
        renderDiscussion();
        const box = await screen.findByRole('textbox', { name: 'Tulis pesan diskusi' });
        fireEvent.change(box, { target: { value: 'Tolong @Ag', selectionStart: 10 } });
        fireEvent.click(await screen.findByRole('option', { name: /Agen Ops Dua/ }));
        expect((box as HTMLTextAreaElement).value).toBe('Tolong @Agen Ops Dua ');
        fireEvent.keyDown(box, { key: 'Enter' });
        await waitFor(() => expect(api.post).toHaveBeenCalledWith('/tickets/t/notes/n/messages',
            expect.objectContaining({ mentionedUserIds: ['ops'] })));
    });

    it('offers marking another message as the solution from its action toolbar', async () => {
        api.put.mockResolvedValue({ data: {} });
        renderDiscussion();
        const row = (await screen.findByText('Ada 2 di gudang')).closest('[data-direction]') as HTMLElement;
        fireEvent.click(within(row).getByRole('button', { name: 'Jadikan solusi' }));
        await waitFor(() => expect(api.put).toHaveBeenCalledWith('/tickets/t/notes/n/solution', { messageId: 'm2' }));
    });

    it('keeps a closed note discussion read only', async () => {
        renderDiscussion(true);
        await screen.findByText('Cek stok roller ya');
        expect(screen.queryByRole('textbox', { name: 'Tulis pesan diskusi' })).not.toBeInTheDocument();
        expect(screen.getByText(/hanya dapat dibaca/i)).toBeInTheDocument();
    });
});
