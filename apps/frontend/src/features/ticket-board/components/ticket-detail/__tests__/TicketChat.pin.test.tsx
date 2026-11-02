import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TicketChat } from '../TicketChat';
import type { TicketDetail } from '../types';

const AGENT = { id: 'agent-1', role: 'AGENT', fullName: 'RM BAGASTYO' };
const REQUESTER = { id: 'user-1', role: 'USER', fullName: 'SHANNON STEPHANIE LIMAWAN' };
let currentUser: { id: string; role: string; fullName: string } = AGENT;

const api = vi.hoisted(() => ({
    get: vi.fn(() => Promise.resolve({ data: [] })),
    post: vi.fn(() => Promise.resolve({ data: [] })),
    delete: vi.fn(() => Promise.resolve({ data: [] })),
    patch: vi.fn(),
}));
const toast = vi.hoisted(() => ({ info: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock('@/stores/useAuth', () => ({ useAuth: () => ({ user: currentUser }) }));
vi.mock('@/lib/api', () => ({ default: api }));
vi.mock('sonner', () => ({ toast }));

const NOW = new Date('2026-11-02T08:00:00Z');
const ago = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();
const AGENT_SENDER = { id: 'agent-1', fullName: 'RM BAGASTYO', role: 'AGENT' };
const USER_SENDER = { id: 'user-1', fullName: 'SHANNON STEPHANIE LIMAWAN', role: 'USER' };
const msg = (id: string, sender: object, content: string, at: string, extra: object = {}) => ({
    id, content, createdAt: at, isSystemMessage: false, attachments: [], sender, ...extra,
});

const baseTicket = (messages: object[], extra: object = {}) => ({
    id: 't-1', ticketNumber: '021126-GEN-0001', title: 'Printer', description: 'Printer error', status: 'IN_PROGRESS',
    priority: 'MEDIUM', createdAt: '2026-11-01T04:00:00Z', updatedAt: '2026-11-01T06:00:00Z', viewerAccess: 'handler',
    user: { id: 'user-1', fullName: 'SHANNON STEPHANIE LIMAWAN' }, messages, ...extra,
}) as unknown as TicketDetail;

const renderChat = (ticket: TicketDetail) => {
    const client = new QueryClient();
    client.setQueryData(['ticket', 't-1'], ticket);
    render(
        <QueryClientProvider client={client}>
            <TicketChat ticket={ticket} isConnected onSendMessage={vi.fn(() => Promise.resolve())} onImageClick={vi.fn()} />
        </QueryClientProvider>,
    );
    return client;
};
const row = (id: string) => document.querySelector(`[data-message-id="${id}"]`) as HTMLElement;
const menuItems = async () => (await screen.findAllByRole('menuitem')).map((i) => i.textContent);

describe('TicketChat pins and reply links', () => {
    beforeAll(() => { Element.prototype.scrollIntoView = vi.fn(); });
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(NOW);
        vi.clearAllMocks();
        currentUser = AGENT;
    });
    afterEach(() => vi.useRealTimers());

    it('no pin bar without pins', () => {
        renderChat(baseTicket([msg('a', USER_SENDER, 'Printer mati', ago(30))]));
        expect(screen.queryByRole('button', { name: /Pesan disematkan/ })).not.toBeInTheDocument();
    });

    it('shows the latest pin and cycles through pins with a counter', async () => {
        const user = userEvent.setup();
        renderChat(baseTicket([
            msg('a', USER_SENDER, 'SOP reset printer', ago(30), { isPinned: true, pinnedAt: ago(20) }),
            msg('b', AGENT_SENDER, 'IP printer 10.0.0.12', ago(25), { isPinned: true, pinnedAt: ago(10) }),
        ]));

        const bar = screen.getByRole('button', { name: 'Pesan disematkan 2 dari 2' });
        expect(bar).toHaveTextContent('IP printer 10.0.0.12');
        await user.click(bar);
        expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
        const next = screen.getByRole('button', { name: 'Pesan disematkan 1 dari 2' });
        expect(next).toHaveTextContent('SOP reset printer');
    });

    it('menu offers Sematkan and calls the API', async () => {
        const user = userEvent.setup();
        renderChat(baseTicket([msg('a', USER_SENDER, 'Printer mati', ago(30))]));
        await user.click(within(row('a')).getByRole('button', { name: 'Aksi lainnya' }));
        expect(await menuItems()).toContain('Sematkan');
        await user.click(screen.getByRole('menuitem', { name: 'Sematkan' }));
        await waitFor(() => expect(api.post).toHaveBeenCalledWith('/tickets/t-1/messages/a/pin'));
    });

    it('Lepas sematan calls the API, from the menu and from the bar', async () => {
        const user = userEvent.setup();
        renderChat(baseTicket([msg('a', USER_SENDER, 'Printer mati', ago(30), { isPinned: true, pinnedAt: ago(5) })]));
        await user.click(within(row('a')).getByRole('button', { name: 'Aksi lainnya' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Lepas sematan' }));
        await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/tickets/t-1/messages/a/pin'));

        await user.click(screen.getByRole('button', { name: 'Lepas sematan' }));
        await waitFor(() => expect(api.delete).toHaveBeenCalledTimes(2));
    });

    it('pin of an unloaded message tells the user', async () => {
        const user = userEvent.setup();
        const client = renderChat(baseTicket([msg('a', USER_SENDER, 'Printer mati', ago(30), { isPinned: true, pinnedAt: ago(5) })]));
        document.querySelector('[data-message-id="a"]')?.removeAttribute('data-message-id');
        await user.click(screen.getByRole('button', { name: /Pesan disematkan/ }));
        expect(toast.info).toHaveBeenCalledWith('Pesan belum dimuat, gulir ke atas untuk melihatnya');
        expect(client).toBeDefined();
    });

    it('a reply quotes its original through replyTo and jumps to it', async () => {
        const user = userEvent.setup();
        renderChat(baseTicket([
            msg('a', USER_SENDER, 'Printer lantai 2 mati', ago(30)),
            // Stored text still carries the quote; the link decides which message it points at,
            // even when another message has the same text.
            msg('b', AGENT_SENDER, '↩ SHANNON STEPHANIE LIMAWAN: Printer lantai 2 mati\n\nSaya cek', ago(20), {
                replyToId: 'a', replyTo: { id: 'a', senderName: 'SHANNON STEPHANIE LIMAWAN', snippet: 'Printer lantai 2 mati', isDeleted: false },
            }),
            msg('c', USER_SENDER, 'Printer lantai 2 mati', ago(10)),
        ]));
        const quote = within(row('b')).getByRole('button', { name: /Printer lantai 2 mati/ });
        await user.click(quote);
        expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
        expect(row('a').className).toContain('bg-primary');
    });

    it('a reply to a deleted message says so', () => {
        renderChat(baseTicket([
            msg('a', USER_SENDER, '', ago(30), { isDeleted: true }),
            msg('b', AGENT_SENDER, '↩ Shannon Stephanie Limawan: Pesan telah dihapus\n\nSaya cek', ago(20), {
                replyToId: 'a', replyTo: { id: 'a', senderName: 'SHANNON STEPHANIE LIMAWAN', snippet: '', isDeleted: true },
            }),
        ]));
        expect(within(row('b')).getByText('Pesan telah dihapus')).toBeInTheDocument();
        expect(within(row('b')).getByText('Saya cek')).toBeInTheDocument();
    });

    it('requester view does not offer Sematkan on system or deleted messages, and shows a pin mark', async () => {
        currentUser = REQUESTER;
        const user = userEvent.setup();
        renderChat(baseTicket([
            msg('a', AGENT_SENDER, 'Sudah saya restart', ago(30), { isPinned: true, pinnedAt: ago(5) }),
            msg('b', AGENT_SENDER, '', ago(20), { isDeleted: true }),
        ], { viewerAccess: 'requester' }));
        expect(within(row('a')).getByRole('img', { name: 'Disematkan' })).toBeInTheDocument();
        expect(within(row('b')).queryByRole('button', { name: 'Aksi lainnya' })).not.toBeInTheDocument();
        await user.click(within(row('a')).getByRole('button', { name: 'Aksi lainnya' }));
        expect(await menuItems()).toContain('Lepas sematan');
    });
});
