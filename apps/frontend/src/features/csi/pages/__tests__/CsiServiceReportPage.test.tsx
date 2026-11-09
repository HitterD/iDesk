import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CsiServiceReport } from '../../hcTypes';
import { CsiServiceReportPage } from '../CsiServiceReportPage';

const cell = (average: number | null, ratings: number) => ({ average, ratings });
const cells = (average: number | null, ratings: number) => ({
    all: cell(average, ratings),
    byLocation: { SJA1: cell(null, 0), SJA2: cell(null, 0), SJA3: cell(null, 0), SJA4: cell(average, ratings), JKT: cell(null, 0) },
});
const REPORT: CsiServiceReport = {
    period: { id: 'p1', title: 'CSI HC 2026 – Semarang', startDate: '2026-11-01', endDate: '2026-11-30' }, serviceCode: 'HCD',
    dimensions: ['Knowledge'], locations: [{ code: 'SJA4', label: 'SJA 4' }] as CsiServiceReport['locations'],
    overall: { ...cells(4.5, 2), dimensions: { Knowledge: 4.5 }, respondents: 1 },
    services: [
        { level: 'service', key: 's:HCD', label: 'HCD · HC Development', serviceCode: 'HCD', bagian: null, jobTitle: null, serviceFunction: null, ...cells(4.5, 2), dimensions: { Knowledge: 4.5 } },
        { level: 'bagian', key: 'b:HCD:HCD', label: 'HCD', serviceCode: 'HCD', bagian: 'HCD', jobTitle: null, serviceFunction: null, ...cells(4.5, 2), dimensions: { Knowledge: 4.5 } },
        { level: 'pic', key: 'p:rara', label: 'RARA', serviceCode: 'HCD', bagian: 'HCD', jobTitle: 'Staff', serviceFunction: 'People & Organization Development', ...cells(5, 1), dimensions: { Knowledge: 5 } },
    ],
    respondentGroups: [],
    respondents: [{ responseId: 'anonim-1', name: 'Anonim', division: null, department: null, bagian: null, location: null, average: 5, pics: [{ name: 'RARA', serviceCode: 'HCD', bagian: 'HCD', scores: { Knowledge: 5 }, average: 5 }] }],
    pending: [{ department: 'PRODUCTION RTD', pending: 3, total: 8 }],
};

vi.mock('../../api/csiHc.api', () => ({
    CsiHcApi: {
        myReportPeriods: vi.fn(async () => ({ services: ['HCD'], periods: [REPORT.period] })),
        myServiceReport: vi.fn(async () => REPORT),
        myServiceReportExport: vi.fn(),
    },
}));

const renderPage = () => render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter><CsiServiceReportPage /></MemoryRouter>
    </QueryClientProvider>,
);

afterEach(cleanup);

describe('CsiServiceReportPage', () => {
    it('shows the service report with the service function and the pending count per department (no names)', async () => {
        renderPage();
        expect(await screen.findByRole('heading', { name: /report csi layanan/i })).toBeInTheDocument();
        expect(await screen.findByText(/People & Organization Development/)).toBeInTheDocument();
        expect(screen.getByText('Production RTD')).toBeInTheDocument();
        expect(screen.getByText('3 dari 8 belum menilai')).toBeInTheDocument();
    });

    it('lists anonymous answers as Anonim', async () => {
        renderPage();
        await userEvent.click(await screen.findByRole('button', { name: /jawaban per responden/i }));
        expect(screen.getByText('Anonim')).toBeInTheDocument();
    });

    it('explains when the account owns no service', async () => {
        const { CsiHcApi } = await import('../../api/csiHc.api');
        vi.mocked(CsiHcApi.myReportPeriods).mockResolvedValueOnce({ services: [], periods: [] });
        renderPage();
        expect(await screen.findByText(/belum ditunjuk sebagai penanggung jawab/i)).toBeInTheDocument();
    });
});
