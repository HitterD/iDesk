import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TicketChat } from '../TicketChat';
import type { TicketDetail } from '../types';

const AGENT = { id: 'agent-1', role: 'AGENT', fullName: 'RM BAGASTYO' };
const ADMIN = { id: 'admin-1', role: 'ADMIN', fullName: 'ADMIN SATU' };
const REQUESTER = { id: 'user-1', role: 'USER', fullName: 'SHANNON STEPHANIE LIMAWAN' };
let currentUser: { id: string; role: string; fullName: string } = AGENT;

const api = vi.hoisted(() => ({
    get: vi.fn(() => Promise.resolve({ data: [] })),
    patch: vi.fn(),
    delete: vi.fn(),
}));
vi.mock('@/stores/useAuth', () => ({ useAuth: () => ({ user: currentUser }) }));
vi.mock('@/lib/api', () => ({ default: api }));
vi.mock('sonner', () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }));

const NOW = new Date('2026-11-01T08:00:00Z');
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();
const msg = (id: string, sender: { id: string; fullName: string; role: string }, content: string, at: string, extra: object = {}) => ({
    id, content, createdAt: at, isSystemMessage: false, attachments: [], sender, ...extra,
});
const AGENT_SENDER = { id: 'agent-1', fullName: 'RM BAGASTYO', role: 'AGENT' };
const USER_SENDER = { id: 'user-1', fullName: 'SHANNON STEPHANIE LIMAWAN', role: 'USER' };

const baseTicket = (messages: object[]) => ({
    id: 't-1', ticketNumber: '011126-GEN-0001', title: 'Scanner', description: 'Scanner rusak', status: 'IN_PROGRESS',
    priority: 'MEDIUM', createdAt: '2026-10-31T04:00:00Z', updatedAt: '2026-10-31T06:00:00Z', viewerAccess: 'handler',
    user: { id: 'user-1', fullName: 'SHANNON STEPHANIE LIMAWAN' }, messages,
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

describe('TicketChat edit and delete', () => {
    beforeAll(() => { Element.prototype.scrollIntoView = vi.fn(); });
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(NOW);
        vi.clearAllMocks();
        currentUser = AGENT;
    });
    afterEach(() => vi.useRealTimers());

    it('own recent message offers Edit and Hapus', async () => {
        const user = userEvent.setup();
        renderChat(baseTicket([msg('m-1', AGENT_SENDER, 'Baik, saya cek', minutesAgo(2))]));
        await user.click(within(row('m-1')).getByRole('button', { name: 'Aksi lainnya' }));
        expect(await menuItems()).toEqual(['Salin', 'Balas', 'Sematkan', 'Edit', 'Hapus']);
    });

    it('an old own message offers Hapus but not Edit', async () => {
        const user = userEvent.setup();
        renderChat(baseTicket([msg('m-1', AGENT_SENDER, 'Baik, saya cek', minutesAgo(20))]));
        await user.click(within(row('m-1')).getByRole('button', { name: 'Aksi lainnya' }));
        expect(await menuItems()).toEqual(['Salin', 'Balas', 'Sematkan', 'Hapus']);
    });

    it("requester sees no Hapus on the agent's message", async () => {
        currentUser = REQUESTER;
        const user = userEvent.setup();
        renderChat({ ...baseTicket([msg('m-1', AGENT_SENDER, 'Baik', minutesAgo(2))]), viewerAccess: 'requester' } as TicketDetail);
        await user.click(within(row('m-1')).getByRole('button', { name: 'Aksi lainnya' }));
        expect(await menuItems()).toEqual(['Salin', 'Balas', 'Sematkan']);
    });

    it("admin sees Hapus on anyone's message but no Edit", async () => {
        currentUser = ADMIN;
        const user = userEvent.setup();
        renderChat(baseTicket([msg('m-1', USER_SENDER, 'Halo', minutesAgo(2))]));
        await user.click(within(row('m-1')).getByRole('button', { name: 'Aksi lainnya' }));
        expect(await menuItems()).toEqual(['Salin', 'Balas', 'Sematkan', 'Hapus']);
    });

    it('editing fills the composer, shows the banner and saves the new text', async () => {
        api.patch.mockResolvedValue({ data: msg('m-1', AGENT_SENDER, 'Baik, saya cek sekarang', minutesAgo(2), { editedAt: NOW.toISOString() }) });
        const user = userEvent.setup();
        const client = renderChat(baseTicket([msg('m-1', AGENT_SENDER, 'Baik, saya cek', minutesAgo(2))]));

        await user.click(within(row('m-1')).getByRole('button', { name: 'Aksi lainnya' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Edit' }));

        expect(screen.getByText('Mengedit pesan')).toBeInTheDocument();
        const input = screen.getByRole('textbox') as HTMLTextAreaElement;
        expect(input.value).toBe('Baik, saya cek');
        await user.clear(input);
        await user.type(input, 'Baik, saya cek sekarang');
        await user.click(screen.getByRole('button', { name: 'Simpan perubahan' }));

        await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/tickets/t-1/messages/m-1', { content: 'Baik, saya cek sekarang' }));
        await waitFor(() => expect(screen.queryByText('Mengedit pesan')).not.toBeInTheDocument());
        expect((client.getQueryData(['ticket', 't-1']) as TicketDetail).messages?.[0].content).toBe('Baik, saya cek sekarang');
    });

    it('editing a reply keeps its quote', async () => {
        api.patch.mockResolvedValue({ data: msg('m-2', AGENT_SENDER, 'x', minutesAgo(1)) });
        const user = userEvent.setup();
        renderChat(baseTicket([
            msg('m-1', USER_SENDER, 'Scanner mati', minutesAgo(5)),
            msg('m-2', AGENT_SENDER, '↩ Shannon Stephanie Limawan: Scanner mati\n\nSaya cek', minutesAgo(1)),
        ]));

        await user.click(within(row('m-2')).getByRole('button', { name: 'Aksi lainnya' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Edit' }));
        const input = screen.getByRole('textbox') as HTMLTextAreaElement;
        expect(input.value).toBe('Saya cek');
        await user.type(input, ' dulu');
        await user.click(screen.getByRole('button', { name: 'Simpan perubahan' }));

        await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/tickets/t-1/messages/m-2', {
            content: '↩ Shannon Stephanie Limawan: Scanner mati\n\nSaya cek dulu',
        }));
    });

    it('Esc cancels editing and clears the composer', async () => {
        const user = userEvent.setup();
        renderChat(baseTicket([msg('m-1', AGENT_SENDER, 'Baik, saya cek', minutesAgo(2))]));
        await user.click(within(row('m-1')).getByRole('button', { name: 'Aksi lainnya' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Edit' }));
        await waitFor(() => expect(screen.getByRole('textbox')).toHaveFocus());

        await user.keyboard('{Escape}');

        expect(screen.queryByText('Mengedit pesan')).not.toBeInTheDocument();
        expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('');
    });

    it('a failed save keeps the draft and the edit mode', async () => {
        api.patch.mockRejectedValue(new Error('Batas waktu edit 15 menit sudah lewat'));
        const user = userEvent.setup();
        renderChat(baseTicket([msg('m-1', AGENT_SENDER, 'Baik, saya cek', minutesAgo(2))]));
        await user.click(within(row('m-1')).getByRole('button', { name: 'Aksi lainnya' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Edit' }));
        const input = screen.getByRole('textbox') as HTMLTextAreaElement;
        await user.type(input, '!');
        await user.click(screen.getByRole('button', { name: 'Simpan perubahan' }));

        await waitFor(() => expect(api.patch).toHaveBeenCalled());
        expect(screen.getByText('Mengedit pesan')).toBeInTheDocument();
        expect(input.value).toBe('Baik, saya cek!');
    });

    it('deleting asks for confirmation and calls the API only after Hapus', async () => {
        api.delete.mockResolvedValue({ data: { ...msg('m-1', AGENT_SENDER, '', minutesAgo(2)), isDeleted: true, deletedByAdmin: false } });
        const user = userEvent.setup();
        renderChat(baseTicket([msg('m-1', AGENT_SENDER, 'Baik, saya cek', minutesAgo(2))]));
        await user.click(within(row('m-1')).getByRole('button', { name: 'Aksi lainnya' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Hapus' }));

        expect(await screen.findByText('Hapus pesan?')).toBeInTheDocument();
        expect(api.delete).not.toHaveBeenCalled();
        await user.click(screen.getByRole('button', { name: 'Hapus' }));

        await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/tickets/t-1/messages/m-1'));
    });

    it('a deleted message shows the placeholder without its text, tools or ticks', () => {
        renderChat({ ...baseTicket([{ ...msg('m-1', AGENT_SENDER, '', minutesAgo(2)), isDeleted: true, deletedByAdmin: false }]), userLastReadAt: NOW.toISOString() } as TicketDetail);
        expect(within(row('m-1')).getByText('Pesan ini telah dihapus')).toBeInTheDocument();
        expect(within(row('m-1')).queryByRole('toolbar')).not.toBeInTheDocument();
        expect(within(row('m-1')).queryByRole('img', { name: /Terkirim|Dibaca/ })).not.toBeInTheDocument();
    });

    it('a message deleted by an admin says so', () => {
        renderChat(baseTicket([{ ...msg('m-1', USER_SENDER, '', minutesAgo(2)), isDeleted: true, deletedByAdmin: true }]));
        expect(within(row('m-1')).getByText('Dihapus oleh admin')).toBeInTheDocument();
    });

    it('leaves edit mode when someone else deletes the message being edited', async () => {
        const { toast } = await import('sonner');
        const user = userEvent.setup();
        const live = baseTicket([msg('m-1', AGENT_SENDER, 'Baik, saya cek', minutesAgo(2))]);
        const client = new QueryClient();
        const view = (t: TicketDetail) => (
            <QueryClientProvider client={client}>
                <TicketChat ticket={t} isConnected onSendMessage={vi.fn(() => Promise.resolve())} onImageClick={vi.fn()} />
            </QueryClientProvider>
        );
        const { rerender } = render(view(live));
        await user.click(within(row('m-1')).getByRole('button', { name: 'Aksi lainnya' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Edit' }));
        expect(screen.getByText('Mengedit pesan')).toBeInTheDocument();

        rerender(view(baseTicket([{ ...msg('m-1', AGENT_SENDER, '', minutesAgo(2)), isDeleted: true, deletedByAdmin: true }])));

        await waitFor(() => expect(screen.queryByText('Mengedit pesan')).not.toBeInTheDocument());
        expect(toast.info).toHaveBeenCalledWith('Pesan yang Anda edit sudah dihapus');
    });

    it('editing a reply limits the body so the whole message stays within 5000 characters', async () => {
        const user = userEvent.setup();
        renderChat(baseTicket([
            msg('m-1', USER_SENDER, 'Scanner mati', minutesAgo(5)),
            msg('m-2', AGENT_SENDER, '\u21a9 Shannon Stephanie Limawan: Scanner mati\n\nSaya cek', minutesAgo(1)),
        ]));
        await user.click(within(row('m-2')).getByRole('button', { name: 'Aksi lainnya' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Edit' }));

        const prefix = '\u21a9 Shannon Stephanie Limawan: Scanner mati\n\n'.length;
        expect(screen.getByRole('textbox')).toHaveAttribute('maxlength', String(5000 - prefix));
    });

    it('an edited message is labelled diedit', () => {
        renderChat(baseTicket([msg('m-1', USER_SENDER, 'Halo', minutesAgo(2), { editedAt: minutesAgo(1) })]));
        expect(within(row('m-1')).getByText('diedit')).toBeInTheDocument();
    });
});
