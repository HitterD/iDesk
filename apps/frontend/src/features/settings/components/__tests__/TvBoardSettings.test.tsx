import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import api from '@/lib/api';
import { TvBoardSettings } from '../TvBoardSettings';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@/lib/api', () => ({
    default: {
        get: vi.fn(),
        delete: vi.fn(),
    },
}));

const site = {
    id: 's1', code: 'SPJ', name: 'Sepanjang', isActive: true, tvToken: null,
    ringtoneNewTicket: '/uploads/sounds/umum.mp3',
    ringtoneNewTicketSupport: null,
    ringtoneNewTicketOracle: '/uploads/sounds/oracle.mp3',
    ringtoneNewTicketWebDev: null,
    ringtoneNewTicketMobileDev: null,
    ringtoneInProgress: null,
    ringtoneClosing: null,
    closingTime: null,
};

describe('TvBoardSettings', () => {
    it('shows the legacy site-wide upload on empty division slots only', async () => {
        (api.get as any).mockResolvedValue({ data: [site] });
        render(<TvBoardSettings />);

        expect(await screen.findAllByText('Kustom umum')).toHaveLength(3);
        expect(screen.getByText('Kustom')).toBeInTheDocument();
        expect(screen.getByText('Bawaan: Chime Assigned')).toBeInTheDocument();
    });

    it('clears the legacy slot when deleting an inherited sound', async () => {
        (api.get as any).mockResolvedValue({ data: [site] });
        (api.delete as any).mockResolvedValue({ data: { ...site, ringtoneNewTicket: null } });
        render(<TvBoardSettings />);

        const [inheritedDelete] = await screen.findAllByTitle(/Hapus kustom umum/);
        fireEvent.click(inheritedDelete);

        await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/sites/s1/tv-ringtone/newTicket'));
        expect(screen.queryByText('Kustom umum')).toBeNull();
    });
});
