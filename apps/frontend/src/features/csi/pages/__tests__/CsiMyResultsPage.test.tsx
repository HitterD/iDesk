import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CsiSelfResult } from '../../types';
import { CsiMyResultsPage } from '../CsiMyResultsPage';

const base: CsiSelfResult = {
    periodRateeId: 'pr1',
    periodId: 'p1', title: 'CSI HC 2026 – Semarang', startDate: '2026-11-01', endDate: '2026-11-30', status: 'ACTIVE',
    serviceFunction: 'People & Organization Development', teamName: null, raters: 2, expectedRaters: null, minRaters: 3, ready: false, average: null, dimensions: [], comments: [],
    scoreBands: { fairMin: 4, goodMin: 4.5 },
};
const fx = vi.hoisted(() => ({
    results: [] as unknown[],
    remind: vi.fn(async () => ({ reminded: true })),
}));
vi.mock('../../api/csi.api', () => ({ CsiApi: { myResults: vi.fn(async () => fx.results), remindMyResultRaters: fx.remind } }));

const renderPage = () => render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter><CsiMyResultsPage /></MemoryRouter>
    </QueryClientProvider>,
);

afterEach(cleanup);

describe('CsiMyResultsPage', () => {
    it('waits for 3 raters before showing anything', async () => {
        fx.results = [base];
        renderPage();
        expect(await screen.findByText(/hasil tampil setelah minimal 3 penilai mengisi \(saat ini 2\)/i)).toBeInTheDocument();
        expect(screen.queryByText(/rata-rata/i)).toBeNull();
    });

    it('shows the average, the dimensions and anonymous comments when ready', async () => {
        fx.results = [{ ...base, raters: 4, ready: true, average: 4.25, dimensions: [{ label: 'Knowledge', average: 4.5 }], comments: ['Sangat membantu'] }];
        renderPage();
        expect(await screen.findByText('4,25')).toBeInTheDocument();
        expect(screen.getByText('Knowledge')).toBeInTheDocument();
        expect(screen.getByText('4,50')).toBeInTheDocument();
        expect(screen.getByText('“Sangat membantu”')).toBeInTheDocument();
        expect(screen.getByText(/dari 4 penilai/)).toBeInTheDocument();
        expect(screen.getByText(/People & Organization Development/)).toBeInTheDocument();
    });

    it('colours the result with the survey bands of the payload', async () => {
        fx.results = [{ ...base, raters: 4, ready: true, average: 4.3, scoreBands: { fairMin: 3.5, goodMin: 4.2 },
            dimensions: [{ label: 'Knowledge', average: 3.4 }], comments: [] }];
        renderPage();
        expect((await screen.findByText('4,30')).closest('p')).toHaveClass('text-[hsl(var(--ticket-green-ink))]');
        expect(screen.getByText('3,40')).toHaveClass('text-[hsl(var(--ticket-red-ink))]');
    });

    it('shows a team label alongside a personal result in the same period', async () => {
        fx.results = [base, { ...base, teamName: 'Payroll' }];
        renderPage();
        expect(await screen.findByText('Tim Payroll')).toBeInTheDocument();
        expect(screen.getAllByRole('heading', { name: base.title })).toHaveLength(2);
    });

    it('shows empty team message when minRaters <= 1 and no raters yet', async () => {
        fx.results = [{ ...base, teamName: 'Payroll', raters: 0, minRaters: 1, ready: false }];
        renderPage();
        expect(await screen.findByText('Tim Payroll')).toBeInTheDocument();
        expect(screen.getByText('Belum ada penilaian.')).toBeInTheDocument();
    });

    it('explains when nobody rated the account', async () => {
        fx.results = [];
        renderPage();
        expect(await screen.findByText(/anda belum menjadi orang yang dinilai/i)).toBeInTheDocument();
    });

    it('shows X / Y rater progress and lets rated users trigger anonymous reminders while ACTIVE', async () => {
        const user = userEvent.setup();
        fx.remind.mockClear();
        fx.remind.mockResolvedValueOnce({ reminded: true }).mockResolvedValueOnce({ reminded: false });
        fx.results = [
            { ...base, periodRateeId: 'pr-wait', raters: 2, expectedRaters: 10, ready: false },
            { ...base, periodRateeId: 'pr-ready', raters: 4, expectedRaters: 8, ready: true, average: 4.6, dimensions: [{ label: 'Responsif', average: 4.6 }] },
            { ...base, periodRateeId: 'pr-done', status: 'ENDED', raters: 5, expectedRaters: 5, ready: true, average: 4.5 },
        ];
        renderPage();

        expect(await screen.findByText('2 / 10 penilai sudah mengisi')).toBeInTheDocument();
        expect(screen.getByText(/saat ini 2 dari 10/i)).toBeInTheDocument();
        expect(screen.getByText('4 / 8 penilai sudah mengisi')).toBeInTheDocument();
        expect(screen.getByText('5 / 5 penilai sudah mengisi')).toBeInTheDocument();

        const buttons = screen.getAllByRole('button', { name: /ingatkan penilai/i });
        expect(buttons).toHaveLength(2);

        await user.click(buttons[0]);
        expect(fx.remind).toHaveBeenCalledWith('pr-wait');
        expect(await screen.findByText(/pengingat anonim telah dikirim ke penilai yang belum mengisi/i)).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: /ingatkan penilai/i }));
        expect(fx.remind).toHaveBeenCalledWith('pr-ready');
        expect(await screen.findByText(/semua penilai yang belum mengisi sudah diingatkan dalam 24 jam terakhir/i)).toBeInTheDocument();
    });

    it('renders pending raters auto-open for <= 10 on ACTIVE & ENDED, collapses > 10 with search, and hides UPCOMING', async () => {
        const user = userEvent.setup();
        const many = Array.from({ length: 12 }, (_, idx) => ({
            userId: `u-${idx}`,
            fullName: `Penilai ${String(idx + 1).padStart(2, '0')}`,
            department: idx === 11 ? 'Finance' : 'Purchasing',
            siteCode: 'SPJ',
        }));
        fx.results = [
            {
                ...base,
                periodRateeId: 'pr-few',
                status: 'ENDED',
                expectedRaters: 5,
                raters: 3,
                pendingRaters: [
                    { userId: 'u-a', fullName: 'Budi Santoso', department: 'HRGA', siteCode: 'KRW' },
                    { userId: 'u-b', fullName: 'Citra Lestari', department: null, siteCode: 'SPJ' },
                ],
            },
            {
                ...base,
                periodRateeId: 'pr-many',
                status: 'ACTIVE',
                expectedRaters: 20,
                raters: 8,
                pendingRaters: many,
            },
            {
                ...base,
                periodRateeId: 'pr-upcoming',
                status: 'UPCOMING',
                expectedRaters: 3,
                raters: 0,
                pendingRaters: [{ userId: 'u-x', fullName: 'Harusnya Tersembunyi', department: 'IT', siteCode: 'SPJ' }],
            },
        ];
        renderPage();

        // <= 10 auto-opened
        expect(await screen.findByText('Belum menilai (2)')).toBeInTheDocument();
        expect(screen.getByText('Budi Santoso')).toBeInTheDocument();
        expect(screen.getByText('HRGA · KRW')).toBeInTheDocument();
        expect(screen.getByText('Citra Lestari')).toBeInTheDocument();

        // UPCOMING hidden
        expect(screen.queryByText('Harusnya Tersembunyi')).not.toBeInTheDocument();

        // > 10 collapsed by default until clicked, then searchable
        expect(screen.queryByText('Penilai 12')).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: /Belum menilai \(12\)/i }));
        expect(await screen.findByText('Penilai 12')).toBeInTheDocument();

        const searchBoxes = screen.getAllByRole('textbox', { name: 'Cari penilai yang belum menilai' });
        await user.type(searchBoxes[searchBoxes.length - 1], 'finance');
        expect(screen.getByText('Penilai 12')).toBeInTheDocument();
        expect(screen.queryByText('Penilai 01')).not.toBeInTheDocument();
    });
});
