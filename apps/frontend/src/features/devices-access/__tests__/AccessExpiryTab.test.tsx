import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/lib/api';
import { toast } from 'sonner';
import { AccessExpiryTab } from '../tabs/AccessExpiryTab';

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

afterEach(cleanup);

const item = (over: Record<string, unknown> = {}) => ({
    eformId: 'ef-1', ticketId: 't-1', kind: 'VPN', requesterName: 'Andi Pratama', department: 'QC', startDate: '2025-12-01', endDate: '2026-11-27',
    group: 'soon', daysLeft: 4, ...over,
});
const COUNTS = { soon: 1, expired: 1, active: 2, permanent: 3 };

function renderTab() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={client}><MemoryRouter><AccessExpiryTab /></MemoryRouter></QueryClientProvider>);
}

describe('AccessExpiryTab', () => {
    beforeEach(() => {
        vi.mocked(api.get).mockReset(); vi.mocked(api.post).mockReset(); vi.mocked(toast.success).mockReset();
        vi.mocked(api.get).mockImplementation(async (_url: string, config?: { params?: { group?: string } }) => {
            const group = config?.params?.group ?? 'soon';
            const items = group === 'expired' ? [item({ eformId: 'ef-2', requesterName: 'Budi Santoso', group: 'expired', daysLeft: -3, endDate: '2026-11-20' })] : [item()];
            return { data: { group, counts: COUNTS, items } };
        });
        vi.mocked(api.post).mockResolvedValue({ data: { ticketId: 't-new', ticketNumber: '231126-IT-0001' } });
    });

    it('opens on "Segera berakhir" and shows the counts of every group', async () => {
        renderTab();
        expect(await screen.findByText('Andi Pratama')).toBeInTheDocument();
        expect(api.get).toHaveBeenCalledWith('/request-flow/center/access', { params: { group: 'soon' } });
        expect(screen.getByRole('button', { name: /Segera berakhir/ })).toHaveTextContent('1');
        expect(screen.getByRole('button', { name: /Permanen/ })).toHaveTextContent('3');
    });

    it('clicking a KPI card switches the group', async () => {
        renderTab();
        await screen.findByText('Andi Pratama');
        fireEvent.click(screen.getByRole('button', { name: /Kedaluwarsa/ }));
        expect(await screen.findByText('Budi Santoso')).toBeInTheDocument();
        expect(api.get).toHaveBeenCalledWith('/request-flow/center/access', { params: { group: 'expired' } });
    });

    it('"Ingatkan" reminds the requester of an access ending soon', async () => {
        renderTab();
        fireEvent.click(await screen.findByRole('button', { name: 'Ingatkan' }));
        await waitFor(() => expect(api.post).toHaveBeenCalledWith('/request-flow/center/access/ef-1/remind'));
        expect(toast.success).toHaveBeenCalledWith('Pengingat dikirim ke Andi Pratama');
    });

    it('"Cabut akses" files the revoke ticket and says so', async () => {
        renderTab();
        await screen.findByText('Andi Pratama');
        fireEvent.click(screen.getByRole('button', { name: /Kedaluwarsa/ }));
        fireEvent.click(await screen.findByRole('button', { name: 'Cabut akses' }));
        await waitFor(() => expect(api.post).toHaveBeenCalledWith('/request-flow/center/access/ef-2/revoke'));
        expect(toast.success).toHaveBeenCalledWith('Tiket pencabutan akses dibuat untuk IT');
    });

    it('each row links to its ticket', async () => {
        renderTab();
        expect(await screen.findByRole('link', { name: 'Tiket' })).toHaveAttribute('href', '/tickets/t-1');
    });

    it('says so when a group is empty', async () => {
        vi.mocked(api.get).mockResolvedValue({ data: { group: 'soon', counts: COUNTS, items: [] } });
        renderTab();
        expect(await screen.findByText('Tidak ada akses di kelompok ini.')).toBeInTheDocument();
    });
});
