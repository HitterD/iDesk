import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CsiDashboard as Dashboard } from '../../../../types';
import { CsiDashboard } from '../CsiDashboard';

const fx = vi.hoisted(() => ({
    data: null as unknown as Dashboard,
    mutateAsync: vi.fn(),
    toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock('../../../../hooks/useCsi', () => ({
    useCsiDashboard: () => ({ data: fx.data, isLoading: false, isError: false, refetch: vi.fn() }),
    useSendCsiDashboardReminders: () => ({ mutateAsync: fx.mutateAsync, isPending: false }),
}));
vi.mock('sonner', () => ({ toast: fx.toast }));

const END = '2099-12-31';
const ACTIVE: Dashboard['active'] = [
    { periodId: 'p1', title: 'CSI Q4', siteId: 's1', siteCode: 'SPJ', siteName: 'Sepanjang', responses: 6, basis: 6, target: 6, targetPct: 90, average: 4.66, endDate: END },
    { periodId: 'p1', title: 'CSI Q4', siteId: 's2', siteCode: 'KRW', siteName: 'Karawang', responses: 2, basis: 5, target: 5, targetPct: 90, average: 4.5, endDate: END },
];
const DATA: Dashboard = {
    active: ACTIVE,
    trend: [
        { siteId: 's1', siteCode: 'SPJ', points: [{ periodId: 'p0', label: 'Q3 26', average: 4.5 }, { periodId: 'p1', label: 'Q4 26', average: 4.66 }] },
        { siteId: 's2', siteCode: 'KRW', points: [{ periodId: 'p0', label: 'Q3 26', average: null }, { periodId: 'p1', label: 'Q4 26', average: 4.5 }] },
    ],
    peopleDelta: [
        { name: 'Yudi', photoUrl: null, siteId: 's1', delta: 0.22 },
        { name: 'Arif', photoUrl: null, siteId: 's2', delta: -0.12 },
    ],
    pending: [
        { userId: 'u1', fullName: 'Andi', department: 'Gudang', siteId: 's2', periodId: 'p1' },
        { userId: 'u2', fullName: 'Citra', department: 'HRGA', siteId: 's2', periodId: 'p2' },
    ],
    comments: [{ text: 'Respon cepat.', subjectName: 'Yudi', siteId: 's1', createdAt: '2026-10-29T03:00:00Z' }],
};

beforeEach(() => { vi.clearAllMocks(); fx.data = DATA; fx.mutateAsync.mockResolvedValue({ sent: 1, skipped: 0 }); });
afterEach(cleanup);

const renderDashboard = () => render(<CsiDashboard scope="ict" />);

describe('CsiDashboard', () => {
    it('shows one target card per active site', () => {
        renderDashboard();
        const panel = screen.getByRole('region', { name: 'Target per site' });
        const cards = within(panel).getAllByRole('group');
        expect(cards).toHaveLength(2);
        expect(within(cards[0]).getByText('6/6 penilai · target 90%')).toBeInTheDocument();
        expect(within(cards[0]).getByText('Tercapai')).toBeInTheDocument();
        expect(within(cards[0]).getByText('100%')).toBeInTheDocument();
        expect(within(cards[1]).getByText('2/5 penilai · target 90%')).toBeInTheDocument();
        expect(within(cards[1]).getByText(/^sisa \d+ hari$/)).toBeInTheDocument();
        expect(within(cards[1]).getByText('4,50')).toBeInTheDocument();
    });

    it('flags sites below target in the attention card', () => {
        renderDashboard();
        const attention = screen.getByRole('group', { name: 'Belum capai target' });
        expect(attention).toHaveTextContent('1 site');
        expect(attention).toHaveTextContent('Karawang');
        expect(attention).not.toHaveTextContent('Sepanjang');
        expect(screen.getByRole('group', { name: 'Jawaban masuk' })).toHaveTextContent('8 / 11');
        expect(screen.getByRole('group', { name: 'Survei aktif' })).toHaveTextContent('1');
    });

    it('reminds one person and everyone, one call per period', async () => {
        const user = userEvent.setup();
        renderDashboard();
        await user.click(screen.getByRole('button', { name: 'Ingatkan Andi' }));
        expect(fx.mutateAsync).toHaveBeenCalledWith({ periodId: 'p1', userIds: ['u1'] });
        fx.mutateAsync.mockClear();
        await user.click(screen.getByRole('button', { name: 'Ingatkan semua' }));
        expect(fx.mutateAsync).toHaveBeenCalledTimes(1);
        expect(fx.mutateAsync).toHaveBeenCalledWith({ periodId: 'p2', userIds: ['u2'] });
    });

    it('labels the bulk reminder "Ingatkan semua" when the list is complete', () => {
        renderDashboard();
        expect(screen.getByRole('button', { name: 'Ingatkan semua' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Ingatkan yang tampil' })).not.toBeInTheDocument();
    });

    it('labels the bulk reminder "Ingatkan yang tampil" when the list may be truncated (10 rows)', () => {
        const pending = Array.from({ length: 10 }, (_, i) => ({ userId: `u${i}`, fullName: `Orang ${i}`, department: null, siteId: 's1', periodId: 'p1' }));
        fx.data = { ...DATA, pending };
        renderDashboard();
        expect(screen.getByRole('button', { name: 'Ingatkan yang tampil' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Ingatkan semua' })).not.toBeInTheDocument();
    });

    it('empty state when there is no active period', () => {
        fx.data = { ...DATA, active: [], pending: [], comments: [] };
        renderDashboard();
        expect(screen.getByText('Belum ada survei aktif.')).toBeInTheDocument();
        expect(screen.queryByRole('region', { name: 'Target per site' })).not.toBeInTheDocument();
    });

    it('trend tab draws one line per site', async () => {
        renderDashboard();
        await userEvent.setup().click(screen.getByRole('button', { name: 'Tren' }));
        const chart = screen.getByRole('img', { name: 'Grafik tren skor per site' });
        expect(chart.querySelectorAll('[data-site-line]')).toHaveLength(2);
        // all scores >= 4 -> 4,00–5,00 axis
        expect(within(chart).getByText('4,00')).toBeInTheDocument();
        expect(within(chart).queryByText('1,00')).not.toBeInTheDocument();
        const people = screen.getByRole('region', { name: 'Perubahan per orang' });
        expect(within(people).getByText('+0,22')).toBeInTheDocument();
        expect(within(people).getByText('−0,12')).toBeInTheDocument();
    });

    it('trend tab empty state', async () => {
        fx.data = { ...DATA, trend: [], peopleDelta: [] };
        renderDashboard();
        await userEvent.setup().click(screen.getByRole('button', { name: 'Tren' }));
        expect(screen.getByText('Belum ada data tren.')).toBeInTheDocument();
    });
});
