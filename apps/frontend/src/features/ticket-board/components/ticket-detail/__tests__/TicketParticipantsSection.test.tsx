import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi } from 'vitest';
import api from '@/lib/api';
import { TicketParticipantsSection } from '../TicketParticipantsSection';
vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));
vi.mock('@/components/ui/UserAvatar', () => ({ UserAvatar: () => <span>Avatar</span> }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function setup(isClosed = false) {
    return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <TicketParticipantsSection ticketId="ticket" creator={{ id: 'creator', fullName: 'Creator' }} canAddUsers canManageUsers isClosed={isClosed} />
    </QueryClientProvider>);
}

describe('Ticket member selection', () => {
    it('normalizes duplicate names, excludes creator and submits selected stable IDs only', async () => {
        vi.mocked(api.get).mockResolvedValue({ data: [
            { id: 'creator', fullName: 'Creator', email: 'creator@example.test' },
            { id: 'one', fullName: 'BUDI SANTOSO', email: 'one@example.test', department: { name: 'IT' } },
            { id: 'two', fullName: 'BUDI SANTOSO', email: 'two@example.test', department: { name: 'IT' } },
        ] });
        vi.mocked(api.post).mockResolvedValue({ data: {} });
        setup();
        fireEvent.click(screen.getByRole('button', { name: 'Tambah anggota tiket' }));
        expect(await screen.findAllByRole('checkbox')).toHaveLength(2);
        expect(screen.getAllByText('Budi Santoso')).toHaveLength(2);
        expect(screen.getByRole('button', { name: 'Tambahkan' })).toBeDisabled();
        fireEvent.click(screen.getAllByRole('checkbox')[1]);
        fireEvent.click(screen.getByRole('button', { name: 'Tambahkan' }));
        await waitFor(() => expect(api.post).toHaveBeenCalledWith('/tickets/ticket/participants', { userIds: ['two'] }));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });
    it('does not expose add controls for terminal tickets', () => {
        setup(true);
        expect(screen.queryByRole('button', { name: 'Tambah anggota tiket' })).not.toBeInTheDocument();
    });
    it('shows fetch errors and a retry instead of an empty success state', async () => {
        vi.mocked(api.get).mockRejectedValue(new Error('offline'));
        setup();
        fireEvent.click(screen.getByRole('button', { name: 'Tambah anggota tiket' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Daftar anggota gagal dimuat');
        expect(screen.getByRole('button', { name: 'Coba lagi' })).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Tambahkan' })).toBeDisabled();
    });
});
