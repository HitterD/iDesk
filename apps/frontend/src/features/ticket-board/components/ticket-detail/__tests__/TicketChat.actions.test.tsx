import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TicketChat } from '../TicketChat';
import type { TicketDetail } from '../types';

const AGENT = { id: 'agent-1', role: 'AGENT', fullName: 'RM BAGASTYO' };
const REQUESTER = { id: 'user-1', role: 'USER', fullName: 'SHANNON STEPHANIE LIMAWAN' };
let currentUser: typeof AGENT = AGENT;

vi.mock('@/stores/useAuth', () => ({ useAuth: () => ({ user: currentUser }) }));
vi.mock('@/lib/api', () => ({ default: { get: vi.fn(() => Promise.resolve({ data: [] })) } }));
vi.mock('sonner', () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }));

const ticket = {
    id: 't-1',
    ticketNumber: '061026-GEN-0001',
    title: 'Scanner Zebra',
    description: 'Fitur scanner tidak bisa digunakan',
    status: 'IN_PROGRESS',
    priority: 'MEDIUM',
    createdAt: '2026-10-06T04:00:00Z',
    updatedAt: '2026-10-06T06:00:00Z',
    user: { id: 'user-1', fullName: 'SHANNON STEPHANIE LIMAWAN' },
    messages: [
        { id: 'm-1', content: 'Baterai sudah dilepas', createdAt: '2026-10-06T05:06:00Z', isSystemMessage: false,
            attachments: [], sender: { id: 'user-1', fullName: 'SHANNON STEPHANIE LIMAWAN', role: 'USER' } },
        { id: 'm-2', content: 'Baik, saya cek', createdAt: '2026-10-06T06:07:00Z', isSystemMessage: false,
            attachments: [], sender: { id: 'agent-1', fullName: 'RM BAGASTYO', role: 'AGENT' } },
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

describe('TicketChat round-2 actions', () => {
    beforeAll(() => { Element.prototype.scrollIntoView = vi.fn(); });
    beforeEach(() => { vi.clearAllMocks(); currentUser = AGENT; });

    it('requester sees no Public/Internal toggle and no quick replies', () => {
        currentUser = REQUESTER;
        renderChat();
        expect(screen.queryByRole('group', { name: 'Jenis balasan' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Internal Note' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /quick reply/i })).not.toBeInTheDocument();
        expect(screen.queryByText('Terlihat oleh pemohon')).not.toBeInTheDocument();
    });

    it('offers no manual Internal Note toggle; internal notes moved to the private notes drawer', () => {
        renderChat();
        expect(screen.queryByRole('button', { name: 'Internal Note' })).not.toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: /Balas ke pemohon/ })).toBeInTheDocument();
    });

    it('public reply sends isInternal=false', async () => {
        const onSend = renderChat();
        const input = screen.getByRole('textbox', { name: 'Balas ke pemohon…' });
        fireEvent.change(input, { target: { value: 'halo' } });
        fireEvent.click(screen.getByRole('button', { name: 'Kirim' }));
        await waitFor(() => expect(onSend).toHaveBeenCalledWith('halo', null, false, expect.any(Function)));
    });

    it('send is disabled until there is text', () => {
        renderChat();
        const send = screen.getByRole('button', { name: 'Kirim' });
        expect(send).toBeDisabled();
        const input = screen.getByRole('textbox', { name: 'Balas ke pemohon…' });
        fireEvent.change(input, { target: { value: '   ' } });
        expect(send).toBeDisabled();
        fireEvent.change(input, { target: { value: 'ok' } });
        expect(send).not.toBeDisabled();
    });

    it('each message has a toolbar with an accessible ⋯ menu (Salin/Balas; Edit/Hapus hidden until available)', async () => {
        const user = userEvent.setup();
        renderChat();
        const toolbar = within(row('m-1')).getByRole('toolbar', { name: 'Aksi pesan' });
        await user.click(within(toolbar).getByRole('button', { name: 'Aksi lainnya' }));
        expect((await screen.findAllByRole('menuitem')).map((i) => i.textContent)).toEqual(['Salin', 'Balas']);
        await user.keyboard('{Escape}');
        await user.click(within(row('m-2')).getByRole('button', { name: 'Aksi lainnya' }));
        expect((await screen.findAllByRole('menuitem')).map((i) => i.textContent)).toEqual(['Salin', 'Balas']);
    });

    it('reaction picker adds a chip and clicking the chip removes it', async () => {
        const user = userEvent.setup();
        renderChat();
        await user.click(within(row('m-1')).getByRole('button', { name: 'Tambah reaksi' }));
        await user.click(await screen.findByRole('button', { name: 'Setuju' }));
        const chip = within(row('m-1')).getByRole('button', { name: /Setuju · 1 · hapus reaksi Anda/ });
        expect(chip).toHaveAttribute('aria-pressed', 'true');
        expect(chip).toHaveClass('is-on', 'is-pop');
        await user.click(chip);
        expect(within(row('m-1')).queryByRole('button', { name: /Setuju ·/ })).not.toBeInTheDocument();
    });
    it('touch long-press opens the tool pill without the native callout or context menu', () => {
        vi.useFakeTimers();
        try {
            renderChat();
            const wrap = row('m-1').querySelector('.chat-bubble-wrap') as HTMLElement;
            // jsdom has no PointerEvent init for pointerType; attach it to the dispatched event.
            const touch = (type: string) => {
                const event = new MouseEvent(type, { bubbles: true, cancelable: true });
                Object.defineProperty(event, 'pointerType', { value: 'touch' });
                act(() => { wrap.dispatchEvent(event); });
            };
            expect(fireEvent.contextMenu(wrap)).toBe(true); // not pressing: native menu untouched
            touch('pointerdown');
            expect(wrap).toHaveClass('is-pressing');
            expect(fireEvent.contextMenu(wrap)).toBe(false); // prevented during the press
            act(() => { vi.advanceTimersByTime(450); });
            expect(row('m-1')).toHaveClass('tools-open');
            touch('pointerup');
            expect(wrap).not.toHaveClass('is-pressing');
            expect(fireEvent.contextMenu(wrap)).toBe(true);
        } finally {
            vi.useRealTimers();
        }
    });
});

describe('TicketChat hardware request entry', () => {
    beforeAll(() => { Element.prototype.scrollIntoView = vi.fn(); });
    beforeEach(() => { currentUser = AGENT; });

    const openPlus = () => fireEvent.click(screen.getByRole('button', { name: 'Lampiran & sticker' }));

    it('offers ICT a hardware request in the + menu of an IT support ticket', () => {
        renderChat();
        openPlus();
        expect(screen.getByRole('menuitem', { name: /Hardware request/ })).toBeInTheDocument();
    });

    it('keeps it out of the requester menu', () => {
        currentUser = REQUESTER;
        renderChat();
        openPlus();
        expect(screen.queryByRole('menuitem', { name: /Hardware request/ })).not.toBeInTheDocument();
    });
});
