import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TicketChat } from '../TicketChat';
import { toast } from 'sonner';
import type { TicketDetail } from '../types';

const AGENT = { id: 'agent-1', role: 'AGENT', fullName: 'RM BAGASTYO' };
const REQUESTER = { id: 'user-1', role: 'USER', fullName: 'SHANNON STEPHANIE LIMAWAN' };
let currentUser: typeof AGENT = AGENT;

vi.mock('@/stores/useAuth', () => ({ useAuth: () => ({ user: currentUser }) }));
vi.mock('@/lib/api', () => ({ default: { get: vi.fn(() => Promise.resolve({ data: [] })) } }));
vi.mock('sonner', () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }));

const PDF_PATH = '/uploads/tickets/t-1/1730000000-456.pdf';

const ticket = {
    id: 't-1',
    ticketNumber: '061026-GEN-0001',
    title: 'Scanner Zebra',
    description: 'Fitur scanner tidak bisa digunakan',
    status: 'IN_PROGRESS',
    priority: 'MEDIUM',
    category: 'HARDWARE',
    createdAt: '2026-10-06T04:00:00Z',
    updatedAt: '2026-10-06T06:00:00Z',
    user: { id: 'user-1', fullName: 'SHANNON STEPHANIE LIMAWAN' },
    messages: [
        { id: 'm-1', content: 'Baterai sudah dilepas', createdAt: '2026-10-06T05:06:00Z', isSystemMessage: false,
            attachments: [], sender: { id: 'user-1', fullName: 'SHANNON STEPHANIE LIMAWAN' } },
        { id: 'm-2', content: 'Baik, saya cek', createdAt: '2026-10-06T06:07:00Z', isSystemMessage: false,
            attachments: [PDF_PATH], attachmentInfo: [{ path: PDF_PATH, name: 'SOP.pdf', size: 10, mime: 'application/pdf' }],
            sender: { id: 'agent-1', fullName: 'RM BAGASTYO' } },
        { id: 'm-3', content: 'Catatan rahasia staf', createdAt: '2026-10-06T06:08:00Z', isSystemMessage: false,
            isInternal: true, attachments: [], sender: { id: 'agent-1', fullName: 'RM BAGASTYO' } },
        { id: 'm-4', content: 'Status changed from TODO to IN_PROGRESS by RM BAGASTYO', createdAt: '2026-10-06T06:09:00Z',
            isSystemMessage: true, attachments: [], sender: null },
    ],
} as unknown as TicketDetail;

const renderChat = (onSendMessage = vi.fn(() => Promise.resolve())) => {
    render(
        <QueryClientProvider client={new QueryClient()}>
            <TicketChat ticket={ticket} isConnected onSendMessage={onSendMessage} onImageClick={vi.fn()} />
        </QueryClientProvider>,
    );
    return onSendMessage;
};

const row = (id: string) => document.querySelector(`[data-message-id="${id}"]`) as HTMLElement;

describe('TicketChat surface', () => {
    beforeAll(() => {
        Element.prototype.scrollIntoView = vi.fn();
        // jsdom has no DataTransfer; the composer builds a FileList with it.
        globalThis.DataTransfer ??= class {
            private list: File[] = [];
            items = { add: (file: File) => { this.list.push(file); } };
            get files() { return this.list as unknown as FileList; }
        } as unknown as typeof DataTransfer;
    });
    beforeEach(() => { vi.clearAllMocks(); currentUser = AGENT; });

    it('uses a viewport-constrained sticker surface and preserves sending', async () => {
        const onSend = renderChat();
        fireEvent.click(screen.getByRole('button', { name: 'Lampiran & sticker' }));
        fireEvent.click(await screen.findByRole('menuitem', { name: 'Sticker' }));
        const picker = screen.getByRole('dialog', { name: 'Sticker' });
        expect(picker).toHaveClass('td-sticker-menu');
        fireEvent.click(within(picker).getAllByRole('button', { name: /^Sticker / })[0]);
        await waitFor(() => expect(onSend).toHaveBeenCalled());
    });

    it('aligns the agent\'s own messages outgoing and keeps author identity on both sides', () => {
        renderChat();
        expect(row('m-2')).toHaveAttribute('data-direction', 'out');
        expect(row('m-1')).toHaveAttribute('data-direction', 'in');
        expect(screen.getAllByText('Rm Bagastyo').length).toBeGreaterThan(0);
        expect(screen.getByText('Catatan rahasia staf')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Internal Note' })).toBeInTheDocument();
    });

    it('aligns relative to the requester and hides internal notes and controls from them', () => {
        currentUser = REQUESTER;
        renderChat();
        expect(row('m-1')).toHaveAttribute('data-direction', 'out');
        expect(row('m-2')).toHaveAttribute('data-direction', 'in');
        expect(screen.queryByText('Catatan rahasia staf')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Internal Note' })).not.toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: 'Balas ke IT Support…' })).toBeInTheDocument();
    });

    it('shows the opening report only once when an agent filed the ticket for the requester (older tickets)', () => {
        const filedByAgent = {
            ...ticket,
            description: 'email tidak bisa digunakan',
            messages: [
                // Before the fix the opening report was saved with the filing agent as sender.
                { id: 'g-1', content: 'email tidak bisa digunakan', createdAt: ticket.createdAt, isSystemMessage: false,
                    attachments: [], sender: { id: 'agent-1', fullName: 'RM BAGASTYO' } },
                ...ticket.messages!,
            ],
        } as unknown as TicketDetail;
        render(<QueryClientProvider client={new QueryClient()}><TicketChat ticket={filedByAgent} isConnected onSendMessage={vi.fn(() => Promise.resolve())} onImageClick={vi.fn()} /></QueryClientProvider>);
        // Shown in the requester's "Laporan awal" card only, not again as an agent chat bubble.
        expect(row('g-1')).toBeNull();
        expect(row('m-2')).not.toBeNull();
    });

    it('says who filed the ticket when an agent filed it for the requester', () => {
        const filed = { ...ticket, createdBy: { id: 'agent-1', fullName: 'RM BAGASTYO' } } as unknown as TicketDetail;
        render(<QueryClientProvider client={new QueryClient()}><TicketChat ticket={filed} isConnected onSendMessage={vi.fn(() => Promise.resolve())} onImageClick={vi.fn()} /></QueryClientProvider>);
        const root = document.querySelector('[data-root-issue]') as HTMLElement;
        expect(within(root).getByText(/Dibuat oleh/)).toHaveTextContent('Dibuat oleh Rm Bagastyo');
    });

    it('does not show a filer note when the requester filed the ticket themselves', () => {
        renderChat();
        const root = document.querySelector('[data-root-issue]') as HTMLElement;
        expect(within(root).queryByText(/Dibuat oleh/)).toBeNull();
    });

    it('still shows a later agent reply that happens to repeat the description', () => {
        const repeated = {
            ...ticket,
            description: 'email tidak bisa digunakan',
            messages: [
                { id: 'r-1', content: 'email tidak bisa digunakan', createdAt: '2026-10-06T07:00:00Z', isSystemMessage: false,
                    attachments: [], sender: { id: 'agent-1', fullName: 'RM BAGASTYO' } },
            ],
        } as unknown as TicketDetail;
        render(<QueryClientProvider client={new QueryClient()}><TicketChat ticket={repeated} isConnected onSendMessage={vi.fn(() => Promise.resolve())} onImageClick={vi.fn()} /></QueryClientProvider>);
        // Not the opening report: posted well after the ticket was created.
        expect(row('r-1')).not.toBeNull();
    });

    it('keeps system events in the timeline as centered events', () => {
        renderChat();
        const event = document.querySelector('[data-system-event="m-4"]');
        expect(event).toBeInTheDocument();
        expect(event).toHaveClass('chat-system-event');
    });

    it('keeps original attachment rendering in bubbles', () => {
        renderChat();
        expect(within(row('m-2')).getByRole('button', { name: 'Preview SOP.pdf' })).toBeInTheDocument();
    });

    it('keeps the draft and queued files when sending is rejected', async () => {
        const onSend = renderChat(vi.fn(() => Promise.reject(new Error('Tiket sudah ditutup'))));
        const input = screen.getByRole('textbox', { name: 'Balas ke pemohon…' }) as HTMLTextAreaElement;
        fireEvent.change(input, { target: { value: 'coba lagi' } });
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        fireEvent.change(fileInput, { target: { files: [new File(['x'], 'bukti.png', { type: 'image/png' })] } });
        expect(screen.getByText('bukti.png')).toBeInTheDocument();
        fireEvent.keyDown(input, { key: 'Enter' });
        await waitFor(() => expect(onSend).toHaveBeenCalled());
        await waitFor(() => expect(screen.getByRole('button', { name: 'Kirim' })).not.toBeDisabled());
        expect(input.value).toBe('coba lagi');
        expect(screen.getByText('bukti.png')).toBeInTheDocument();
    });

    it('announces only new incoming messages; the stream, tool pills and typing indicator are not live regions', () => {
        const props = { isConnected: true, onSendMessage: vi.fn(() => Promise.resolve()), onImageClick: vi.fn() };
        const view = (t: TicketDetail, typingUsers: Record<string, string> = {}) => (
            <QueryClientProvider client={new QueryClient()}>
                <TicketChat ticket={t} typingUsers={typingUsers} {...props} />
            </QueryClientProvider>
        );
        const { rerender } = render(view(ticket));
        const announcer = screen.getByTestId('chat-announcer');
        expect(document.querySelector('.chat-stream')).not.toHaveAttribute('aria-live');
        expect(document.querySelectorAll('[aria-live]:not([data-testid="chat-announcer"])').length).toBe(0);
        // Existing history is not read out on open.
        expect(announcer).toHaveTextContent('');

        rerender(view(ticket, { 'user-1': 'SHANNON STEPHANIE LIMAWAN' }));
        expect(screen.getByText(/sedang mengetik/)).toBeInTheDocument();
        expect(announcer).toHaveTextContent('');

        const incoming = { id: 'm-5', content: 'Sudah saya coba', createdAt: '2026-10-06T06:20:00Z', isSystemMessage: false,
            attachments: [], sender: { id: 'user-1', fullName: 'SHANNON STEPHANIE LIMAWAN' } };
        const withIncoming = { ...ticket, messages: [...(ticket.messages ?? []), incoming] } as TicketDetail;
        rerender(view(withIncoming));
        expect(announcer).toHaveTextContent('Pesan baru dari Shannon Stephanie Limawan');
        expect(announcer).not.toHaveTextContent(/Balas|reaksi|Sudah saya coba/);

        // The viewer's own send is not announced.
        const own = { ...incoming, id: 'm-6', content: 'Oke', sender: { id: 'agent-1', fullName: 'RM BAGASTYO' } };
        rerender(view({ ...withIncoming, messages: [...(withIncoming.messages ?? []), own] } as TicketDetail));
        expect(announcer).toHaveTextContent('Pesan baru dari Shannon Stephanie Limawan');
    });

    it('keeps the composer in its own fixed region below the scrolling stream', () => {
        renderChat();
        const composer = document.querySelector('.chat-composer');
        expect(composer).toBeInTheDocument();
        expect(composer?.querySelector('.chat-composer-box')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Kirim' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Lampiran & sticker' })).toBeInTheDocument();
    });

    it('keeps the pinned bar, jump action, connection state and details drawer on every width', () => {
        renderChat();
        const bar = document.querySelector('[data-pinned-bar]') as HTMLElement;
        // No sm-only hiding: the bar is a flex row at every breakpoint.
        expect(bar.className).not.toMatch(/(^|\s)hidden(\s|$)/);
        expect(within(bar).getByTitle('Lompat ke laporan awal')).toBeInTheDocument();
        expect(within(bar).getByTitle('Terhubung real-time')).toHaveTextContent('Live');
        fireEvent.click(within(bar).getByRole('button', { name: 'Tampilkan detail' }));
        const drawer = document.querySelector('[data-pinned-drawer]') as HTMLElement;
        expect(drawer.className).not.toMatch(/(^|\s)hidden(\s|$)/);
        expect(within(drawer).getByText(/Dilaporkan oleh/)).toBeInTheDocument();
    });

    it('shows the keyboard shortcut hint and the character counter in the composer helper row', () => {
        renderChat();
        const foot = document.querySelector('.chat-compose-foot') as HTMLElement;
        expect(foot.querySelector('.chat-compose-hint')).toHaveTextContent('Enter kirim · Shift+Enter baris baru · Ctrl+V tempel gambar');
        expect(screen.getByRole('button', { name: 'Kirim' })).toHaveAttribute('title', expect.stringContaining('Shift+Enter'));
        const input = screen.getByRole('textbox', { name: 'Balas ke pemohon…' });
        fireEvent.change(input, { target: { value: 'halo' } });
        expect(foot.querySelector('.chat-compose-count')).toHaveTextContent(/^4\/5[.,]000$/);
    });

    it('confirms a pasted screenshot with a toast and queues it', () => {
        renderChat();
        const input = screen.getByRole('textbox', { name: 'Balas ke pemohon…' });
        const shot = new File(['x'], 'image.png', { type: 'image/png' });
        fireEvent.paste(input, { clipboardData: { items: [{ type: 'image/png', getAsFile: () => shot }] } });
        expect(toast.success).toHaveBeenCalledWith('1 screenshot ditempel');
        expect(screen.getByText('image.png')).toBeInTheDocument();
    });
});
