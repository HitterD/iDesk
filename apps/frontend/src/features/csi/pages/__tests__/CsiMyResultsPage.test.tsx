import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CsiSelfResult } from '../../types';
import { CsiMyResultsPage } from '../CsiMyResultsPage';

const base: CsiSelfResult = {
    periodId: 'p1', title: 'CSI HC 2026 – Semarang', startDate: '2026-11-01', endDate: '2026-11-30', status: 'ACTIVE',
    serviceFunction: 'People & Organization Development', raters: 2, minRaters: 3, ready: false, average: null, dimensions: [], comments: [],
};
const fx = vi.hoisted(() => ({ results: [] as unknown[] }));
vi.mock('../../api/csi.api', () => ({ CsiApi: { myResults: vi.fn(async () => fx.results) } }));

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

    it('explains when nobody rated the account', async () => {
        fx.results = [];
        renderPage();
        expect(await screen.findByText(/anda belum menjadi orang yang dinilai/i)).toBeInTheDocument();
    });
});
