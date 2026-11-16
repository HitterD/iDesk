import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CsiReport } from '../../../types';
import { PeriodReport } from '../PeriodReport';
import { PERIOD, report } from '../report/__tests__/reportFixture';

const fx = vi.hoisted(() => ({ dialog: vi.fn(), useCsiReport: vi.fn(), report: null as unknown as CsiReport }));
vi.mock('../../../hooks/useCsi', () => ({ useCsiReport: fx.useCsiReport }));
vi.mock('../report/ReportExportDialog', () => ({ ReportExportDialog: (props: unknown) => { fx.dialog(props); return null; } }));

beforeEach(() => {
    fx.report = report();
    fx.useCsiReport.mockReset();
    fx.useCsiReport.mockImplementation(() => ({ data: fx.report, isLoading: false, isError: false, refetch: vi.fn() }));
});
afterEach(cleanup);

const renderReport = () => render(<PeriodReport scope="ict" periodId="p1" sites={PERIOD.sites} />);

describe('PeriodReport', () => {
    it('ranks subject cards by average, highest first with the gold medal', () => {
        renderReport();
        const cards = screen.getAllByRole('button', { name: /^Rincian / });
        expect(cards.map((card) => card.getAttribute('aria-label'))).toEqual(['Rincian Nur', 'Rincian Dimas']);
        expect(within(cards[0]).getByLabelText('Peringkat 1')).toBeInTheDocument();
        expect(within(cards[0]).getByText('KRW')).toBeInTheDocument();
        // Dimas: weakest 4,2 < 4,5 → amber pill with the short label
        expect(within(cards[1]).getByText('Kecepatan respon')).toBeInTheDocument();
        expect(screen.queryByText(/Rincian pertanyaan/)).not.toBeInTheDocument();
    });

    it('uses the survey bands of the payload: with 3,5 / 4,2 a 4,40 is green and 4,2 is no longer "perlu perhatian"', () => {
        fx.report = report({ scoreBands: { fairMin: 3.5, goodMin: 4.2 }, overall: { average: 4.3, respondentCount: 9 } });
        renderReport();
        expect(within(screen.getByRole('group', { name: 'Nilai keseluruhan' })).getByText('Sangat puas')).toBeInTheDocument();
        const dimas = screen.getByRole('button', { name: 'Rincian Dimas' });
        expect(within(dimas).getByText('4,40').parentElement).toHaveClass('text-[hsl(var(--ticket-green-ink))]');
        expect(within(dimas).queryByText('Kecepatan respon')).not.toBeInTheDocument();
    });

    it('site filter refetches with siteId', async () => {
        const user = userEvent.setup();
        renderReport();
        expect(fx.useCsiReport).toHaveBeenLastCalledWith('ict', 'p1', undefined);
        const filter = screen.getByRole('group', { name: 'Filter site laporan' });
        expect(within(filter).getAllByRole('button').map((button) => button.textContent)).toEqual(['Semua site', 'SPJ', 'KRW']);
        await user.click(within(filter).getByRole('button', { name: 'KRW' }));
        expect(fx.useCsiReport).toHaveBeenLastCalledWith('ict', 'p1', 's2');
    });

    it('clicking a card opens the detail sheet', async () => {
        const user = userEvent.setup();
        renderReport();
        await user.click(screen.getByRole('button', { name: 'Rincian Dimas' }));
        const sheet = await screen.findByRole('dialog');
        expect(within(sheet).getByRole('heading', { name: 'Dimas' })).toBeInTheDocument();
        const bars = within(sheet).getByRole('list', { name: 'Nilai per pertanyaan' });
        expect(bars).toHaveTextContent('Kecepatan respon');
        expect(within(sheet).getByText('“Respon cepat”')).toBeInTheDocument();
        expect(within(sheet).queryByText(/Finance|29 Okt 2026/)).not.toBeInTheDocument();
    });

    it('Perbandingan shows a heatmap with short labels and the full text as title', async () => {
        const user = userEvent.setup();
        renderReport();
        await user.click(screen.getByRole('button', { name: 'Perbandingan' }));
        const table = screen.getByRole('table', { name: 'Perbandingan nilai per pertanyaan' });
        const header = within(table).getByRole('columnheader', { name: 'Kecepatan respon' });
        expect(header).toHaveAttribute('title', 'Seberapa cepat petugas merespon laporan Anda?');
        const rows = within(table).getAllByRole('row');
        expect(rows[1]).toHaveTextContent('Nur');
        expect(rows[1]).toHaveTextContent('4,90');
    });

    it('opens on the site picked from the dashboard and never shows a rater score matrix', () => {
        render(<PeriodReport scope="ict" periodId="p1" sites={PERIOD.sites} initialSiteId="s2" />);
        expect(fx.useCsiReport).toHaveBeenLastCalledWith('ict', 'p1', 's2');
        expect(screen.queryByRole('region', { name: 'Siapa menilai siapa' })).not.toBeInTheDocument();
    });

    it('opens the report dialog (PDF preview + Excel) for the selected site', async () => {
        const user = userEvent.setup();
        renderReport();
        await user.click(within(screen.getByRole('group', { name: 'Filter site laporan' })).getByRole('button', { name: 'KRW' }));
        await user.click(screen.getByRole('button', { name: 'Laporan PDF & Excel' }));
        expect(fx.dialog).toHaveBeenLastCalledWith(expect.objectContaining({ open: true, siteId: 's2', periodId: 'p1' }));
    });

    it('ranks selected site subjects ahead of cross-site 1-rater subjects when a site tab is active', async () => {
        const user = userEvent.setup();
        fx.report = report({
            ratees: [
                { periodRateeId: 'r-spj', kind: 'PERSON', displayName: 'Esterlita', jobTitle: 'Legal', siteId: 's1', photoUrl: null, respondentCount: 1, average: 5, indexPct: 100, starDistribution: [0, 0, 0, 0, 1], questions: [], comments: [] },
                { periodRateeId: 'r-krw', kind: 'PERSON', displayName: 'Novitasari', jobTitle: 'HC', siteId: 's2', photoUrl: null, respondentCount: 15, average: 4.95, indexPct: 99, starDistribution: [0, 0, 0, 1, 14], questions: [], comments: [] },
            ],
        });
        renderReport();
        await user.click(within(screen.getByRole('group', { name: 'Filter site laporan' })).getByRole('button', { name: 'KRW' }));
        const cards = screen.getAllByRole('button', { name: /^Rincian / });
        expect(cards.map((card) => card.getAttribute('aria-label'))).toEqual(['Rincian Novitasari', 'Rincian Esterlita']);
    });
});
