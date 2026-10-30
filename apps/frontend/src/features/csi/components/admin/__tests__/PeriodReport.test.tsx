import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CsiReport } from '../../../types';
import { PeriodReport } from '../PeriodReport';
import { PERIOD, report } from '../report/__tests__/reportFixture';

const fx = vi.hoisted(() => ({ useCsiReport: vi.fn(), report: null as unknown as CsiReport }));
vi.mock('../../../hooks/useCsi', () => ({ useCsiReport: fx.useCsiReport }));

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
        expect(within(sheet).getByText(/Finance · 29 Okt 2026/)).toBeInTheDocument();
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
});
