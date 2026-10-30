import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi } from 'vitest';
import api from '@/lib/api';
import { SetTicketReminderModal } from '../SetTicketReminderModal';
vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function setup() {
    return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <SetTicketReminderModal isOpen onClose={vi.fn()} ticketId="ticket" ticketNumber="IT-001"
            assignedAgent={{ id: 'agent', fullName: 'AGENT TEST', email: 'agent@example.test' }} />
    </QueryClientProvider>);
}

describe('Ticket reminders', () => {
    it('keeps all presets and posts the selected future schedule and trimmed optional note', async () => {
        vi.mocked(api.get).mockResolvedValue({ data: [] });
        vi.mocked(api.post).mockResolvedValue({ data: {} });
        setup();
        expect(screen.getByText('Penerima: Agent Test')).toBeInTheDocument();
        expect(screen.queryByText('agent@example.test')).not.toBeInTheDocument();
        const presets = screen.getByRole('group', { name: 'Pilihan cepat' });
        expect(within(presets).getAllByRole('button')).toHaveLength(4);
        fireEvent.click(within(presets).getByRole('button', { name: '2 Hari Lagi' }));
        expect(within(presets).getByRole('button', { name: '2 Hari Lagi' })).toHaveAttribute('aria-pressed', 'true');
        fireEvent.change(screen.getByLabelText('Catatan pengingat'), { target: { value: '  Follow up vendor  ' } });
        fireEvent.click(screen.getByRole('button', { name: 'Jadwalkan pengingat' }));
        await waitFor(() => expect(api.post).toHaveBeenCalledWith('/tickets/ticket/reminders', {
            remindAt: expect.any(String), note: 'Follow up vendor',
        }));
        const payload = vi.mocked(api.post).mock.calls[0][1] as { remindAt: string };
        expect(new Date(payload.remindAt).getTime()).toBeGreaterThan(Date.now());
    });
    it('retains scheduled reminder deletion confirmation', async () => {
        vi.mocked(api.get).mockResolvedValue({ data: [{ id: 'reminder', remindAt: '2030-01-02T08:00:00Z', isSent: false }] });
        vi.mocked(api.delete).mockResolvedValue({ data: {} });
        setup();
        fireEvent.click(await screen.findByRole('button', { name: 'Batalkan pengingat' }));
        expect(api.delete).not.toHaveBeenCalled();
        expect(screen.getByText('Batalkan pengingat?')).toBeInTheDocument();
        fireEvent.click(screen.getAllByRole('button', { name: 'Batalkan pengingat' }).at(-1)!);
        await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/tickets/ticket/reminders/reminder'));
    });
});
