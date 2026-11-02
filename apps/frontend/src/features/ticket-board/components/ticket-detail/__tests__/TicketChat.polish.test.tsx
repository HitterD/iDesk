import { fireEvent, render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TicketChat } from '../TicketChat';
import type { TicketDetail } from '../types';

const AGENT = { id: 'agent-1', role: 'AGENT', fullName: 'RM BAGASTYO' };
vi.mock('@/stores/useAuth', () => ({ useAuth: () => ({ user: AGENT }) }));
vi.mock('@/lib/api', () => ({ default: { get: vi.fn(() => Promise.resolve({ data: [] })) } }));
vi.mock('sonner', () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }));

const AGENT_SENDER = { id: 'agent-1', fullName: 'RM BAGASTYO', role: 'AGENT' };
const USER_SENDER = { id: 'user-1', fullName: 'SHANNON STEPHANIE LIMAWAN', role: 'USER' };
const msg = (id: string, sender: object, content: string, at: string, extra: object = {}) => ({
    id, content, createdAt: at, isSystemMessage: false, attachments: [], sender, ...extra,
});
const ticket = (messages: object[]) => ({
    id: 't-1', ticketNumber: '021126-GEN-0012', title: 'Printer', description: 'Printer error', status: 'IN_PROGRESS',
    priority: 'MEDIUM', createdAt: '2026-11-01T04:00:00Z', updatedAt: '2026-11-01T06:00:00Z', viewerAccess: 'handler',
    user: { id: 'user-1', fullName: 'SHANNON STEPHANIE LIMAWAN' }, userLastReadAt: null, messages,
}) as unknown as TicketDetail;

const client = new QueryClient();
const view = (t: TicketDetail) => (
    <QueryClientProvider client={client}>
        <TicketChat ticket={t} isConnected onSendMessage={vi.fn(() => Promise.resolve())} onImageClick={vi.fn()} />
    </QueryClientProvider>
);
const row = (id: string) => document.querySelector(`[data-message-id="${id}"]`) as HTMLElement;

describe('TicketChat polish', () => {
    beforeAll(() => { Element.prototype.scrollIntoView = vi.fn(); });
    beforeEach(() => vi.mocked(Element.prototype.scrollIntoView).mockClear());

    it('a message still being sent shows a clock, not a sent tick', () => {
        render(view(ticket([msg('temp-1', AGENT_SENDER, 'halo', '2026-11-02T08:00:00Z')])));
        expect(row('temp-1').querySelector('[aria-label="Mengirim"]')).not.toBeNull();
        expect(row('temp-1').querySelector('[aria-label="Terkirim"]')).toBeNull();
    });

    it('a message arriving while scrolled up keeps its entrance animation', () => {
        const base = [msg('a', USER_SENDER, 'pesan lama', '2026-11-02T07:00:00Z')];
        const { rerender } = render(view(ticket(base)));
        const stream = document.querySelector('.chat-stream') as HTMLElement;
        Object.defineProperty(stream, 'scrollHeight', { configurable: true, value: 2000 });
        Object.defineProperty(stream, 'clientHeight', { configurable: true, value: 500 });
        stream.scrollTop = 0;
        fireEvent.scroll(stream);

        rerender(view(ticket([...base, msg('b', USER_SENDER, 'pesan baru', '2026-11-02T08:00:00Z')])));

        expect(row('b')).toHaveClass('is-arriving');
    });

    it('opening the chat jumps to the bottom at once, without a smooth scroll', () => {
        render(view(ticket([msg('a', USER_SENDER, 'halo', '2026-11-02T07:00:00Z')])));
        expect(vi.mocked(Element.prototype.scrollIntoView).mock.calls[0]?.[0]).toEqual({ behavior: 'auto' });
    });

    it('time and ticks sit at the end of the last line of text, inside it', () => {
        render(view(ticket([msg('a', AGENT_SENDER, 'Sudah saya cek', '2026-11-02T07:00:00Z')])));
        const paragraph = row('a').querySelector('.chat-bubble p') as HTMLElement;
        expect(paragraph.querySelector('time')).not.toBeNull();
        expect(paragraph.querySelector('[aria-label="Terkirim"]')).not.toBeNull();
    });
});
