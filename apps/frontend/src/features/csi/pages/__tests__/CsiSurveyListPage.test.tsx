import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CsiApi } from '../../api/csi.api';
import { CsiSurveyListPage } from '../CsiSurveyListPage';
import { CsiPendingCard } from '../../components/CsiPendingCard';
import type { CsiActivePeriod } from '../../types';

vi.mock('../../api/csi.api', () => ({
    CsiApi: { active: vi.fn(), form: vi.fn(), submit: vi.fn() },
}));

const SURVEYS: CsiActivePeriod[] = [
    { id: 'p1', scope: 'ICT', title: 'Survei ICT Q4', submitted: false },
    { id: 'p2', scope: 'HC', title: 'Survei HC Q4', submitted: true },
];

const renderAt = (path: string, ui: React.ReactNode) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
        </QueryClientProvider>,
    );
};

beforeEach(() => vi.mocked(CsiApi.active).mockReset());
afterEach(cleanup);

describe('CsiSurveyListPage', () => {
    it('menampilkan survei aktif dengan unit dan status, tautan sesuai layout', async () => {
        vi.mocked(CsiApi.active).mockResolvedValue(SURVEYS);
        renderAt('/client/csi', <CsiSurveyListPage />);
        expect(await screen.findByText('Survei ICT Q4')).toBeInTheDocument();
        expect(screen.getByText('Belum diisi')).toBeInTheDocument();
        expect(screen.getByText('Sudah diisi')).toBeInTheDocument();
        expect(screen.getByText('HC')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Survei ICT Q4/ })).toHaveAttribute('href', '/client/csi/p1');
    });

    it('menampilkan empty state bila tidak ada survei', async () => {
        vi.mocked(CsiApi.active).mockResolvedValue([]);
        renderAt('/csi', <CsiSurveyListPage />);
        expect(await screen.findByText('Tidak ada survei yang sedang berjalan')).toBeInTheDocument();
    });
});

describe('CsiPendingCard', () => {
    it('muncul untuk survei yang belum diisi dan menautkan ke formnya', async () => {
        vi.mocked(CsiApi.active).mockResolvedValue(SURVEYS);
        renderAt('/client/my-tickets', <CsiPendingCard />);
        expect(await screen.findByText('Ada survei menunggu')).toBeInTheDocument();
        expect(screen.getByText('Survei ICT Q4')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Isi Survei' })).toHaveAttribute('href', '/client/csi/p1');
    });

    it('tidak muncul bila semua survei sudah diisi', async () => {
        vi.mocked(CsiApi.active).mockResolvedValue([SURVEYS[1]]);
        const { container } = renderAt('/client/my-tickets', <CsiPendingCard />);
        await vi.waitFor(() => expect(CsiApi.active).toHaveBeenCalled());
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(container).toBeEmptyDOMElement();
    });
});
