import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CsiApi } from '../../api/csi.api';
import { CsiSurveyListPage } from '../CsiSurveyListPage';
import { CsiPendingCard } from '../../components/CsiPendingCard';
import { draftKey } from '../../lib/surveyDraft';
import type { CsiActivePeriod } from '../../types';

vi.mock('@/stores/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));

vi.mock('../../api/csi.api', () => ({
    CsiApi: { active: vi.fn(), form: vi.fn(), submit: vi.fn() },
}));
const hcAccess = vi.hoisted(() => ({ services: [] as string[] }));
vi.mock('../../api/csiHc.api', () => ({
    CsiHcApi: { myReportAccess: vi.fn(async () => ({ admin: false, services: hcAccess.services })) },
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
afterEach(() => { cleanup(); localStorage.clear(); });

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

    it('shows Lanjutkan when draft exists, but never for submitted or another user', async () => {
        localStorage.setItem(draftKey('u1', 'p1'), '{}');
        localStorage.setItem(draftKey('u1', 'p2'), '{}');
        localStorage.setItem(draftKey('other', 'p3'), '{}');
        vi.mocked(CsiApi.active).mockResolvedValue([...SURVEYS, { ...SURVEYS[0], id: 'p3', title: 'Baru' }]);
        renderAt('/client/csi', <CsiSurveyListPage />);
        expect(await screen.findByRole('link', { name: /Survei ICT Q4.*Lanjutkan/ })).toHaveAttribute('href', '/client/csi/p1');
        expect(screen.getAllByText('Lanjutkan')).toHaveLength(1);
        expect(screen.getByRole('link', { name: /Baru.*Isi Survei/ })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Survei HC Q4/ })).not.toHaveTextContent('Lanjutkan');
    });

    it('an answered survey is locked for the account (one answer per account), the rest are counted', async () => {
        vi.mocked(CsiApi.active).mockResolvedValue(SURVEYS);
        renderAt('/client/csi', <CsiSurveyListPage />);
        expect(await screen.findByRole('link', { name: /Survei HC Q4.*Sudah dikirim/ })).toHaveAttribute('href', '/client/csi/p2');
        expect(screen.queryByText(/orang lain/)).not.toBeInTheDocument();
        expect(screen.getByText('1 dari 2 survei belum Anda isi.')).toBeInTheDocument();
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

    it('shows Lanjutkan when a pending survey has a draft', async () => {
        localStorage.setItem(draftKey('u1', 'p1'), '{}');
        vi.mocked(CsiApi.active).mockResolvedValue(SURVEYS);
        renderAt('/client/my-tickets', <CsiPendingCard />);
        expect(await screen.findByRole('link', { name: 'Lanjutkan' })).toHaveAttribute('href', '/client/csi/p1');
    });

    it('keeps Isi Survei for another user or a submitted draft', async () => {
        localStorage.setItem(draftKey('other', 'p1'), '{}');
        localStorage.setItem(draftKey('u1', 'p2'), '{}');
        vi.mocked(CsiApi.active).mockResolvedValue(SURVEYS);
        renderAt('/client/my-tickets', <CsiPendingCard />);
        expect(await screen.findByRole('link', { name: 'Isi Survei' })).toBeInTheDocument();
    });

    it('resumes via the list when any of multiple pending surveys has a draft', async () => {
        localStorage.setItem(draftKey('u1', 'p3'), '{}');
        vi.mocked(CsiApi.active).mockResolvedValue([...SURVEYS, { ...SURVEYS[0], id: 'p3' }]);
        renderAt('/client/my-tickets', <CsiPendingCard />);
        expect(await screen.findByRole('link', { name: 'Lanjutkan' })).toHaveAttribute('href', '/client/csi');
    });

    it('tidak muncul bila semua survei sudah diisi', async () => {
        vi.mocked(CsiApi.active).mockResolvedValue([SURVEYS[1]]);
        const { container } = renderAt('/client/my-tickets', <CsiPendingCard />);
        await vi.waitFor(() => expect(CsiApi.active).toHaveBeenCalled());
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(container).toBeEmptyDOMElement();
    });

    it('shows the service report link only to service report owners', async () => {
        vi.mocked(CsiApi.active).mockResolvedValue(SURVEYS);
        hcAccess.services = ['HCD'];
        renderAt('/csi', <CsiSurveyListPage />);
        expect(await screen.findByRole('link', { name: /report csi layanan/i })).toHaveAttribute('href', '/csi/report');
        cleanup();
        hcAccess.services = [];
        renderAt('/csi', <CsiSurveyListPage />);
        await screen.findByText('Survei ICT Q4');
        expect(screen.queryByRole('link', { name: /report csi layanan/i })).toBeNull();
    });
});
