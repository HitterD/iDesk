import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TicketChat } from '../TicketChat';
import type { TicketDetail } from '../types';

const AGENT = { id: 'agent-1', role: 'AGENT', fullName: 'RM BAGASTYO' };
let currentUser = AGENT;

const api = vi.hoisted(() => ({
    get: vi.fn(() => Promise.resolve({ data: [] })),
    put: vi.fn(),
    delete: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
}));
vi.mock('@/stores/useAuth', () => ({ useAuth: () => ({ user: currentUser }) }));
vi.mock('@/lib/api', () => ({ default: api }));
vi.mock('sonner', () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }));

const USER_SENDER = { id: 'user-1', fullName: 'SHANNON STEPHANIE LIMAWAN', role: 'USER' };
const thumbs = '\u{1F44D}';
const heart = '❤️';
const ticket = (reactions: object[]) => ({
    id: 't-1', ticketNumber: '021126-GEN-0009', title: 'Printer', description: 'Printer error', status: 'IN_PROGRESS',
    priority: 'MEDIUM', createdAt: '2026-11-01T04:00:00Z', updatedAt: '2026-11-01T06:00:00Z', viewerAccess: 'handler',
    user: { id: 'user-1', fullName: 'SHANNON STEPHANIE LIMAWAN' },
    messages: [{ id: 'a', content: 'Printer mati', createdAt: '2026-11-02T07:00:00Z', isSystemMessage: false, attachments: [], sender: USER_SENDER, reactions }],
}) as unknown as TicketDetail;

/** Renders from the ['ticket', id] cache, as the detail pages do. */
const FromCache = () => {
    const { data } = useQuery<TicketDetail>({ queryKey: ['ticket', 't-1'], queryFn: () => Promise.reject(new Error('no fetch')), enabled: false });
    return data ? <TicketChat ticket={data} isConnected onSendMessage={vi.fn(() => Promise.resolve())} onImageClick={vi.fn()} /> : null;
};
const renderChat = (t: TicketDetail) => {
    const client = new QueryClient();
    client.setQueryData(['ticket', 't-1'], t);
    render(<QueryClientProvider client={client}><FromCache /></QueryClientProvider>);
    return client;
};
const row = () => document.querySelector('[data-message-id="a"]') as HTMLElement;

describe('TicketChat saved reactions', () => {
    beforeAll(() => { Element.prototype.scrollIntoView = vi.fn(); });
    beforeEach(() => { vi.clearAllMocks(); currentUser = AGENT; });

    it('shows reactions from the server with counts, names and the viewer’s own marked', () => {
        renderChat(ticket([
            { emoji: thumbs, count: 2, userIds: ['agent-1', 'user-1'], userNames: ['RM BAGASTYO', 'SHANNON STEPHANIE LIMAWAN'] },
            { emoji: heart, count: 1, userIds: ['user-1'], userNames: ['SHANNON STEPHANIE LIMAWAN'] },
        ]));
        const mine = within(row()).getByRole('button', { name: /Setuju · 2 · hapus reaksi Anda/ });
        expect(mine).toHaveAttribute('title', 'RM BAGASTYO, SHANNON STEPHANIE LIMAWAN');
        expect(within(row()).getByRole('button', { name: /Suka · 1 · tambah reaksi/ })).toBeInTheDocument();
    });

    it('offers no reaction button where the server would refuse it (internal note, closed ticket)', () => {
        const internal = ticket([]);
        (internal.messages as any[])[0].isInternal = true;
        renderChat(internal);
        expect(within(row()).queryByRole('button', { name: 'Tambah reaksi' })).not.toBeInTheDocument();
    });

    it('offers no reaction button on a closed ticket', () => {
        renderChat({ ...ticket([]), status: 'CLOSED' } as TicketDetail);
        expect(within(row()).queryByRole('button', { name: 'Tambah reaksi' })).not.toBeInTheDocument();
    });

    it('picking an emoji saves it on the server', async () => {
        api.put.mockResolvedValue({ data: [{ emoji: thumbs, count: 1, userIds: ['agent-1'], userNames: ['RM BAGASTYO'] }] });
        const user = userEvent.setup();
        renderChat(ticket([]));
        await user.click(within(row()).getByRole('button', { name: 'Tambah reaksi' }));
        await user.click(await screen.findByRole('button', { name: 'Setuju' }));
        await waitFor(() => expect(api.put).toHaveBeenCalledWith('/tickets/t-1/messages/a/reaction', { emoji: thumbs }));
        expect(await within(row()).findByRole('button', { name: /Setuju · 1 · hapus reaksi Anda/ })).toBeInTheDocument();
    });

    it('clicking my own chip removes my reaction', async () => {
        api.delete.mockResolvedValue({ data: [] });
        const user = userEvent.setup();
        renderChat(ticket([{ emoji: thumbs, count: 1, userIds: ['agent-1'], userNames: ['RM BAGASTYO'] }]));
        await user.click(within(row()).getByRole('button', { name: /Setuju · 1 · hapus reaksi Anda/ }));
        await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/tickets/t-1/messages/a/reaction'));
        await waitFor(() => expect(within(row()).queryByRole('button', { name: /Setuju ·/ })).not.toBeInTheDocument());
    });

    it("clicking someone else's chip switches my reaction to that emoji", async () => {
        api.put.mockResolvedValue({ data: [{ emoji: heart, count: 2, userIds: ['user-1', 'agent-1'], userNames: ['S', 'R'] }] });
        const user = userEvent.setup();
        renderChat(ticket([
            { emoji: thumbs, count: 1, userIds: ['agent-1'], userNames: ['RM BAGASTYO'] },
            { emoji: heart, count: 1, userIds: ['user-1'], userNames: ['SHANNON'] },
        ]));
        await user.click(within(row()).getByRole('button', { name: /Suka · 1 · tambah reaksi/ }));
        await waitFor(() => expect(api.put).toHaveBeenCalledWith('/tickets/t-1/messages/a/reaction', { emoji: heart }));
        expect(api.put).toHaveBeenCalledTimes(1);
    });
});
