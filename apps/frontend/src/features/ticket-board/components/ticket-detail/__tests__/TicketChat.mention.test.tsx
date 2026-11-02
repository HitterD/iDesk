import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TicketChat } from '../TicketChat';
import type { TicketDetail } from '../types';

const AGENT = { id: 'agent-1', role: 'AGENT', fullName: 'RM BAGASTYO' };
let currentUser = AGENT;

const CANDIDATES = [
    { id: 'u-jason', fullName: 'Jason Kristanto', avatarUrl: null },
    { id: 'u-alphin', fullName: 'Alphin Santoso', avatarUrl: null },
];
const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), delete: vi.fn(), post: vi.fn(), patch: vi.fn() }));
vi.mock('@/stores/useAuth', () => ({ useAuth: () => ({ user: currentUser }) }));
vi.mock('@/lib/api', () => ({ default: api }));
vi.mock('sonner', () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }));

const USER_SENDER = { id: 'user-1', fullName: 'SHANNON STEPHANIE LIMAWAN', role: 'USER' };
const ticket = (messages: object[] = []) => ({
    id: 't-1', ticketNumber: '021126-GEN-0010', title: 'Printer', description: 'Printer error', status: 'IN_PROGRESS',
    priority: 'MEDIUM', createdAt: '2026-11-01T04:00:00Z', updatedAt: '2026-11-01T06:00:00Z', viewerAccess: 'handler',
    user: { id: 'user-1', fullName: 'SHANNON STEPHANIE LIMAWAN' }, messages,
}) as unknown as TicketDetail;

const renderChat = (t: TicketDetail, onSendMessage = vi.fn(() => Promise.resolve())) => {
    render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
            <TicketChat ticket={t} isConnected onSendMessage={onSendMessage} onImageClick={vi.fn()} />
        </QueryClientProvider>,
    );
    return onSendMessage;
};

describe('TicketChat mentions', () => {
    beforeAll(() => { Element.prototype.scrollIntoView = vi.fn(); });
    beforeEach(() => {
        vi.clearAllMocks();
        currentUser = AGENT;
        api.get.mockImplementation((url: string) => Promise.resolve({ data: url.endsWith('/mention-candidates') ? CANDIDATES : [] }));
    });

    it('typing @ offers the people this ticket allows, and Enter puts the name in the text', async () => {
        const user = userEvent.setup();
        const onSend = renderChat(ticket());
        const input = screen.getByRole('textbox', { name: 'Balas ke pemohon…' });

        await user.type(input, 'Tolong @ja');
        const picker = await screen.findByRole('listbox', { name: 'Sebut orang' });
        // Each option shows an avatar (initials) and the name.
        const options = within(picker).getAllByRole('option');
        expect(options).toHaveLength(1);
        expect(options[0]).toHaveTextContent('Jason Kristanto');
        expect(api.get).toHaveBeenCalledWith('/tickets/t-1/mention-candidates');

        await user.keyboard('{Enter}');
        expect((input as HTMLTextAreaElement).value).toBe('Tolong @Jason Kristanto ');
        await user.type(input, 'cek ya');
        await user.keyboard('{Enter}');

        await waitFor(() => expect(onSend).toHaveBeenCalled());
        expect(onSend.mock.calls[0][0]).toBe('Tolong @Jason Kristanto cek ya');
        expect(onSend.mock.calls[0][5]).toEqual(['u-jason']);
    });

    it('a name removed from the text is not sent as a mention', async () => {
        const user = userEvent.setup();
        const onSend = renderChat(ticket());
        const input = screen.getByRole('textbox', { name: 'Balas ke pemohon…' }) as HTMLTextAreaElement;

        await user.type(input, '@al');
        await screen.findByRole('listbox', { name: 'Sebut orang' });
        await user.keyboard('{Enter}');
        await user.clear(input);
        await user.type(input, 'tidak jadi');
        await user.keyboard('{Enter}');

        await waitFor(() => expect(onSend).toHaveBeenCalled());
        expect(onSend.mock.calls[0][5] ?? []).toEqual([]);
    });

    it('Escape closes the picker and the next Enter sends', async () => {
        const user = userEvent.setup();
        const onSend = renderChat(ticket());
        const input = screen.getByRole('textbox', { name: 'Balas ke pemohon…' });
        await user.type(input, 'email ke @');
        await screen.findByRole('listbox', { name: 'Sebut orang' });

        await user.keyboard('{Escape}');
        expect(screen.queryByRole('listbox', { name: 'Sebut orang' })).not.toBeInTheDocument();
        await user.keyboard('{Enter}');

        await waitFor(() => expect(onSend).toHaveBeenCalled());
        expect(onSend.mock.calls[0][0]).toBe('email ke @');
    });

    it('a shorter name is not sent when only a longer name that starts with it remains', async () => {
        api.get.mockImplementation((url: string) => Promise.resolve({ data: url.endsWith('/mention-candidates')
            ? [{ id: 'u-andi', fullName: 'Andi', avatarUrl: null }, { id: 'u-andi-tan', fullName: 'Andi Tan', avatarUrl: null }]
            : [] }));
        const user = userEvent.setup();
        const onSend = renderChat(ticket());
        const input = screen.getByRole('textbox', { name: 'Balas ke pemohon…' }) as HTMLTextAreaElement;

        await user.type(input, '@andi t');
        await screen.findByRole('listbox', { name: 'Sebut orang' });
        await user.keyboard('{Enter}');
        expect(input.value).toBe('@Andi Tan ');
        // Pick plain "Andi" too, then remove it again: only Andi Tan is still mentioned.
        await user.type(input, '@andi');
        await screen.findByRole('listbox', { name: 'Sebut orang' });
        await user.keyboard('{Enter}');
        await user.clear(input);
        await user.type(input, '@Andi Tan halo');
        await user.keyboard('{Escape}');
        await user.keyboard('{Enter}');

        await waitFor(() => expect(onSend).toHaveBeenCalled());
        expect(onSend.mock.calls[0][5]).toEqual(['u-andi-tan']);
    });

    it('shows mentions in a bubble as chips', () => {
        renderChat(ticket([{
            id: 'a', content: 'Pak @Jason Kristanto bug reply-nya bisa dicoba lagi', createdAt: '2026-11-02T07:00:00Z',
            isSystemMessage: false, attachments: [], sender: USER_SENDER,
            mentionedUserIds: ['u-jason'], mentions: [{ id: 'u-jason', fullName: 'Jason Kristanto' }],
        }]));
        const bubble = document.querySelector('[data-message-id="a"] .chat-bubble') as HTMLElement;
        const chip = within(bubble).getByText('@Jason Kristanto');
        expect(chip).toHaveClass('chat-mention');
        expect(bubble).toHaveTextContent('Pak @Jason Kristanto bug reply-nya bisa dicoba lagi');
    });
});
