import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { toast } from 'sonner';
import { TicketChat } from '../TicketChat';
import type { TicketDetail } from '../types';

vi.mock('@/stores/useAuth', () => ({
    useAuth: () => ({ user: { id: 'agent-1', role: 'AGENT', fullName: 'RM BAGASTYO' } }),
}));

vi.mock('@/lib/api', () => ({
    default: { get: vi.fn(() => Promise.resolve({ data: [] })) },
}));

vi.mock('sonner', () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }));

const requester = { id: 'user-1', fullName: 'SHANNON STEPHANIE LIMAWAN' };
const agent = { id: 'agent-1', fullName: 'RM BAGASTYO' };

const ticket = {
    id: 't-1',
    ticketNumber: '061026-GEN-0001',
    title: 'Device Zebra Tidak Bisa Digunakan Untuk Scan',
    description: 'Fitur scanner tidak bisa digunakan',
    status: 'IN_PROGRESS',
    priority: 'MEDIUM',
    category: 'HARDWARE',
    createdAt: '2026-10-06T04:00:00Z',
    updatedAt: '2026-10-06T06:00:00Z',
    user: requester,
    messages: [
        {
            id: 'm-1',
            content: 'Pak Bagas, ini barusan baterainya dicoba lepas',
            createdAt: '2026-10-06T05:06:00Z',
            isSystemMessage: false,
            attachments: [],
            sender: requester,
        },
        {
            id: 'm-2',
            // Written by an older client: no space after the arrow, CRLF line breaks.
            content: '↩SHANNON STEPHANIE LIMAWAN: Pak Bagas, ini barusan bater…\r\n\r\nokeee shannon',
            createdAt: '2026-10-06T06:07:00Z',
            isSystemMessage: false,
            attachments: [],
            sender: agent,
        },
        {
            id: 'm-3',
            content: '↩ Orang Lain: pesan yang sudah dihapus\n\nbalasan',
            createdAt: '2026-10-06T06:08:00Z',
            isSystemMessage: false,
            attachments: [],
            sender: agent,
        },
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

describe('TicketChat replies', () => {
    beforeAll(() => {
        Element.prototype.scrollIntoView = vi.fn();
    });
    beforeEach(() => vi.clearAllMocks());

    it('renders a stored reply as a quote block instead of raw text', () => {
        renderChat();
        expect(screen.getByText('okeee shannon')).toBeInTheDocument();
        expect(screen.queryByText(/↩/)).not.toBeInTheDocument();
        const quote = screen.getAllByRole('button', { name: /Shannon Stephanie Limawan/ })[0];
        expect(quote).toHaveTextContent('Pak Bagas, ini barusan bater…');
    });

    it('jumps to and highlights the quoted message', async () => {
        renderChat();
        const original = document.querySelector('[data-message-id="m-1"]') as HTMLElement;
        fireEvent.click(screen.getAllByRole('button', { name: /Shannon Stephanie Limawan/ })[0]);
        expect(original.scrollIntoView).toHaveBeenCalled();
        await waitFor(() => expect(original.className).toContain('bg-primary/10'));
    });

    it('tells the user when the quoted message is not in the thread', () => {
        renderChat();
        fireEvent.click(screen.getByRole('button', { name: /Orang Lain/ }));
        expect(toast.info).toHaveBeenCalledWith('Pesan asli tidak tersedia');
    });

    it('shows sender names in title case above their bubbles', () => {
        renderChat();
        expect(screen.getAllByText('Shannon Stephanie Limawan').length).toBeGreaterThan(0);
    });

    it('sends a reply in the stored quote format and clears the preview', async () => {
        const onSend = renderChat();
        fireEvent.click(document.querySelector('[data-message-id="m-1"] button[title="More actions"]')!);
        fireEvent.click(screen.getByRole('button', { name: 'Reply' }));
        expect(screen.getByText('Membalas Shannon Stephanie Limawan')).toBeInTheDocument();

        const input = screen.getByRole('textbox', { name: 'Balas ke requester…' });
        fireEvent.change(input, { target: { value: 'siap' } });
        fireEvent.keyDown(input, { key: 'Enter' });

        await waitFor(() => expect(onSend).toHaveBeenCalled());
        expect(onSend.mock.calls[0][0]).toBe('↩ SHANNON STEPHANIE LIMAWAN: Pak Bagas, ini barusan baterainya dicoba lepas\n\nsiap');
        await waitFor(() => expect(screen.queryByText('Membalas Shannon Stephanie Limawan')).not.toBeInTheDocument());
    });

    it('cancels a reply with Escape', () => {
        renderChat();
        fireEvent.click(document.querySelector('[data-message-id="m-1"] button[title="More actions"]')!);
        fireEvent.click(screen.getByRole('button', { name: 'Reply' }));
        fireEvent.keyDown(screen.getByRole('textbox', { name: 'Balas ke requester…' }), { key: 'Escape' });
        expect(screen.queryByText('Membalas Shannon Stephanie Limawan')).not.toBeInTheDocument();
    });
});
