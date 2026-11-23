import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/lib/api';
import { ScheduleTab } from '../tabs/ScheduleTab';

vi.mock('@/lib/api', () => ({ default: { get: vi.fn() } }));

vi.mock('@/stores/useAuth', () => ({ useAuth: () => ({ user: { id: 'u-2' } }) }));

afterEach(cleanup);

const ev = (id: string, tech: string, techId: string, start: string, over: Record<string, unknown> = {}) => ({
    scheduleId: id, ticketId: `t-${id}`, ticketNumber: `N-${id}`, title: `Pasang ${id}`, siteId: 's', technicianId: techId, technicianName: tech,
    status: 'CONFIRMED', start, end: start, ...over,
});
const WEEK = {
    weekStart: '2026-11-23',
    events: [
        ev('a', 'YUDI ARTA', 'u-1', '2026-11-24T02:00:00Z'),
        ev('b', 'BENY SAPUTRA', 'u-2', '2026-11-25T03:00:00Z'),
        ev('c', 'YUDI ARTA', 'u-1', '2026-11-26T02:00:00Z', { status: 'PROPOSED_AWAITING_USER' }),
    ],
    load: [{ technicianId: 'u-1', technicianName: 'YUDI ARTA', count: 2 }, { technicianId: 'u-2', technicianName: 'BENY SAPUTRA', count: 1 }],
};

function renderTab() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={client}><MemoryRouter><ScheduleTab today="2026-11-25" /></MemoryRouter></QueryClientProvider>);
}

describe('ScheduleTab', () => {
    beforeEach(() => {
        vi.mocked(api.get).mockReset();
        vi.mocked(api.get).mockResolvedValue({ data: WEEK });
    });

    it('asks for the week of today (Monday start) and lays the events on their days', async () => {
        renderTab();
        expect(await screen.findByText('Pasang a')).toBeInTheDocument();
        expect(api.get).toHaveBeenCalledWith('/request-flow/center/schedule', { params: { weekStart: '2026-11-23' } });
        expect(screen.getAllByTestId('week-day')).toHaveLength(7);
    });

    it('filtering by technician hides the events of the other technicians', async () => {
        renderTab();
        await screen.findByText('Pasang a');
        fireEvent.click(screen.getByRole('button', { name: 'BENY' }));
        expect(screen.queryByText('Pasang a')).toBeNull();
        expect(within(screen.getByRole('region', { name: 'Kalender pemasangan' })).getByText('Pasang b')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Semua teknisi' }));
        expect(screen.getByText('Pasang a')).toBeInTheDocument();
    });

    it('marks an install still waiting for the requester to choose', async () => {
        renderTab();
        const waiting = await screen.findByText('Pasang c');
        expect(waiting.closest('[data-state]')).toHaveAttribute('data-state', 'wait');
    });

    it('shows the technician load and flags a busy one', async () => {
        vi.mocked(api.get).mockResolvedValue({ data: { ...WEEK, load: [{ technicianId: 'u-1', technicianName: 'YUDI ARTA', count: 3 }] } });
        renderTab();
        const load = screen.getByRole('region', { name: 'Beban teknisi minggu ini' });
        expect(await within(load).findByText('YUDI')).toBeInTheDocument();
        expect(load.querySelector('.hot')).not.toBeNull();
    });

    it('keeps my installation today when browsing another week', async () => {
        vi.mocked(api.get).mockImplementation(async (_url, config) => ({ data: config?.params.weekStart === WEEK.weekStart ? WEEK : { events: [], load: [] } }));
        renderTab();
        const today = await screen.findByRole('region', { name: 'Jadwal saya hari ini' });
        expect(await within(today).findByRole('link', { name: /Pasang b/ })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Minggu berikutnya' }));
        await waitFor(() => expect(within(screen.getByRole('region', { name: 'Kalender pemasangan' })).queryByText('Pasang b')).not.toBeInTheDocument());
        expect(within(today).getByRole('link', { name: /Pasang b/ })).toBeInTheDocument();
    });

    it('moves to the next week', async () => {
        renderTab();
        await screen.findByText('Pasang a');
        fireEvent.click(screen.getByRole('button', { name: 'Minggu berikutnya' }));
        await waitFor(() => expect(api.get).toHaveBeenCalledWith('/request-flow/center/schedule', { params: { weekStart: '2026-11-30' } }));
    });

    it('each event opens its ticket', async () => {
        renderTab();
        expect(await screen.findByRole('link', { name: /Pasang a/ })).toHaveAttribute('href', '/tickets/t-a');
    });

    it('mockup: four KPI cards and the side panel with the queue that still needs a schedule', async () => {
        vi.mocked(api.get).mockResolvedValue({ data: { ...WEEK, unscheduled: [{ ticketId: 't-q', ticketNumber: '150926-GEN-0011', title: 'Hardware Request HR-2026-0018', requesterName: 'User SPJ' }], rescheduleRequested: 2 } });
        renderTab();
        await screen.findByText('Pasang a');
        for (const label of ['Minggu ini', 'Belum dijadwalkan', 'Menunggu pemohon pilih', 'Jadwal ulang']) expect(screen.getByText(label)).toBeInTheDocument();
        const queue = screen.getByRole('region', { name: 'Perlu dijadwalkan' });
        expect(within(queue).getByRole('link', { name: /Hardware Request HR-2026-0018/ })).toHaveAttribute('href', '/tickets/t-q');
        expect(screen.getByRole('region', { name: 'Jadwal saya hari ini' })).toBeInTheDocument();
    });
});
