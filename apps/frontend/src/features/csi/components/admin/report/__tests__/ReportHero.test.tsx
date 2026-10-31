import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { toneClasses } from '../../../../lib/csiTone';
import { ReportHero } from '../ReportHero';
import { report } from './reportFixture';

afterEach(cleanup);

describe('ReportHero', () => {
    it('shows 4,65 with "Sangat puas" in green', () => {
        render(<ReportHero report={report()} />);
        const panel = screen.getByRole('group', { name: 'Nilai keseluruhan' });
        expect(panel).toHaveTextContent('4,65');
        expect(within(panel).getByText('Sangat puas')).toHaveClass(toneClasses('green').ink);
        expect(panel).toHaveTextContent('Indeks 93,0%');
        expect(panel).toHaveTextContent('naik 0,12 dari periode lalu');
        expect(screen.getByRole('group', { name: 'Jawaban masuk' })).toHaveTextContent('9 / 10');
        expect(screen.getByRole('group', { name: 'Jawaban masuk' })).toHaveTextContent('90% dari basis');
    });

    it('shows the strongest and weakest question by short label', () => {
        render(<ReportHero report={report()} />);
        // Keramahan: (4,6 + 5) / 2 = 4,8 · Kecepatan respon: (4,2 + 4,8) / 2 = 4,5
        const strongest = screen.getByRole('group', { name: 'Paling kuat' });
        expect(strongest).toHaveTextContent('Keramahan petugas');
        expect(strongest).toHaveTextContent('4,80');
        const weakest = screen.getByRole('group', { name: 'Perlu perhatian' });
        expect(weakest).toHaveTextContent('Kecepatan respon');
        expect(weakest).not.toHaveTextContent('Seberapa cepat');
    });

    it('renders the question label at card-title size, clamped to 2 lines, full text as title', () => {
        render(<ReportHero report={report()} />);
        const label = within(screen.getByRole('group', { name: 'Perlu perhatian' })).getByText('Kecepatan respon');
        expect(label).toHaveClass('line-clamp-2', 'text-[15px]', 'font-semibold');
        expect(label).toHaveAttribute('title', 'Seberapa cepat petugas merespon laporan Anda?');
    });

    it('hides the trend when there is no previous period', () => {
        render(<ReportHero report={report({ previousAverage: null })} />);
        expect(screen.queryByText(/dari periode lalu/)).not.toBeInTheDocument();
    });
});
