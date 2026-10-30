import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CsiAdminPage } from '../CsiAdminPage';

const access = vi.hoisted(() => ({ role: 'ADMIN', pageAccess: {} as Record<string, boolean> }));

vi.mock('@/stores/useAuth', () => ({ useAuth: () => ({ user: { id: 'a1', role: access.role } }) }));
vi.mock('@/hooks/usePermissions', () => ({
    useMyPermissions: () => ({ data: { pageAccess: access.pageAccess }, isLoading: false, isError: false }),
}));
// Tab content is covered by its own tests; keep the page test about routing and access.
type ListItem = { id: string; publishStatus: 'DRAFT' | 'PUBLISHED' };
const DRAFT_ROW: ListItem = { id: 'd1', publishStatus: 'DRAFT' };
const PUBLISHED_ROW: ListItem = { id: 'p1', publishStatus: 'PUBLISHED' };
vi.mock('../../components/admin/PeriodsTab', () => ({
    PeriodsTab: ({ scope, onOpen, onCreate }: { scope: string; onOpen: (row: ListItem) => void; onCreate: () => void }) => (
        <div>
            <p>{`periods:${scope}`}</p>
            <button type="button" onClick={onCreate}>Buat Survei</button>
            <button type="button" onClick={() => onOpen(DRAFT_ROW)}>buka draft</button>
            <button type="button" onClick={() => onOpen(PUBLISHED_ROW)}>buka terbit</button>
        </div>
    ),
}));
vi.mock('../../components/admin/PeriodDetail', () => ({
    PeriodDetail: ({ periodId, onEditStep }: { periodId: string; onEditStep: (step: string) => void }) => (
        <div><p>{`detail:${periodId}`}</p><button type="button" onClick={() => onEditStep('departments')}>Ubah departemen</button></div>
    ),
}));
vi.mock('../../components/admin/dashboard/CsiDashboard', () => ({ CsiDashboard: ({ scope }: { scope: string }) => <p>{`dashboard:${scope}`}</p> }));
vi.mock('../../components/admin/MasterDataPanel', () => ({ MasterDataPanel: () => <p>master-data</p> }));
vi.mock('../../components/admin/subjects/SubjectsTab', () => ({ SubjectsTab: ({ scope }: { scope: string }) => <p>{`subjects:${scope}`}</p> }));
vi.mock('../../components/wizard/WizardRoute', () => ({
    WizardRoute: ({ route }: { route: { wizard: string | null; step: string | null; closeAll: () => void } }) => (
        <div><p>{`wizard:${route.wizard ?? 'new'}:${route.step ?? 'resume'}`}</p><button type="button" onClick={route.closeAll}>tutup</button></div>
    ),
}));

const renderAt = (path: string) => render(
    <MemoryRouter initialEntries={[path]}>
        <Routes>
            <Route path="/csi/admin/:scope" element={<CsiAdminPage />} />
            <Route path="/manager/csi/admin/:scope" element={<CsiAdminPage />} />
        </Routes>
    </MemoryRouter>,
);

beforeEach(() => { access.role = 'ADMIN'; access.pageAccess = {}; });
afterEach(cleanup);

describe('CsiAdminPage', () => {
    it('menampilkan scope yang diizinkan dengan judul dan tab', () => {
        access.pageAccess = { csi_admin_ict: true };
        renderAt('/csi/admin/ict');
        expect(screen.getByRole('heading', { name: 'Survei Kepuasan — ICT' })).toBeInTheDocument();
        expect(screen.getAllByRole('button').map((button) => button.textContent).slice(0, 4))
            .toEqual(['Dashboard', 'Survei', 'Subjek & foto', 'Master data']);
        expect(screen.getByText('dashboard:ict')).toBeInTheDocument();
        expect(screen.queryByText('periods:ict')).not.toBeInTheDocument();
    });

    it('tab Survei menampilkan daftar survei', async () => {
        access.pageAccess = { csi_admin_ict: true };
        renderAt('/csi/admin/ict');
        await userEvent.setup().click(screen.getByRole('button', { name: 'Survei' }));
        expect(screen.getByText('periods:ict')).toBeInTheDocument();
        expect(screen.queryByText('dashboard:ict')).not.toBeInTheDocument();
    });

    it('Master data memuat dimensi/departemen/penilai di bagian sekunder', async () => {
        access.pageAccess = { csi_admin_ict: true };
        renderAt('/csi/admin/ict');
        await userEvent.setup().click(screen.getByRole('button', { name: 'Master data' }));
        expect(screen.getByText('master-data')).toBeInTheDocument();
        expect(screen.queryByText('periods:ict')).not.toBeInTheDocument();
    });

    it('Subjek & foto menampilkan tab subjek, lalu membuka survei kembali ke Survei', async () => {
        const actor = userEvent.setup();
        access.pageAccess = { csi_admin_ict: true };
        renderAt('/csi/admin/ict');
        await actor.click(screen.getByRole('button', { name: 'Subjek & foto' }));
        expect(screen.getByText('subjects:ict')).toBeInTheDocument();
        expect(screen.queryByText('periods:ict')).not.toBeInTheDocument();
        await actor.click(screen.getByRole('button', { name: 'Survei' }));
        expect(screen.getByText('periods:ict')).toBeInTheDocument();
    });

    it('Buat Survei membuka wizard baru, draft melanjutkan wizard, terbit membuka detail', async () => {
        const actor = userEvent.setup();
        access.pageAccess = { csi_admin_ict: true };
        renderAt('/csi/admin/ict');
        await actor.click(screen.getByRole('button', { name: 'Survei' }));
        await actor.click(screen.getByRole('button', { name: 'Buat Survei' }));
        expect(screen.getByText('wizard:new:info')).toBeInTheDocument();

        await actor.click(screen.getByRole('button', { name: 'tutup' }));
        await actor.click(screen.getByRole('button', { name: 'buka draft' }));
        expect(screen.getByText('wizard:d1:resume')).toBeInTheDocument();

        await actor.click(screen.getByRole('button', { name: 'tutup' }));
        await actor.click(screen.getByRole('button', { name: 'buka terbit' }));
        expect(screen.getByText('detail:p1')).toBeInTheDocument();
    });

    it('Ubah di detail membuka wizard pada langkah pemilik', async () => {
        access.pageAccess = { csi_admin_ict: true };
        renderAt('/csi/admin/ict?period=p9');
        await userEvent.setup().click(screen.getByRole('button', { name: 'Ubah departemen' }));
        expect(screen.getByText('wizard:p9:departments')).toBeInTheDocument();
    });

    it('membuka wizard dari query ?wizard=&step=', () => {
        access.pageAccess = { csi_admin_ict: true };
        renderAt('/csi/admin/ict?wizard=p3&step=ratees');
        expect(screen.getByText('wizard:p3:ratees')).toBeInTheDocument();
    });

    it('ADMIN tanpa csi_admin_hc dialihkan dari /csi/admin/hc ke scope yang diizinkan', () => {
        access.pageAccess = { csi_admin_ict: true };
        renderAt('/csi/admin/hc');
        expect(screen.getByText('dashboard:ict')).toBeInTheDocument();
    });

    it('scope tidak dikenal dialihkan dalam layout manager', () => {
        access.role = 'MANAGER';
        access.pageAccess = { csi_admin_hc: true };
        renderAt('/manager/csi/admin/xyz');
        expect(screen.getByRole('heading', { name: 'Survei Kepuasan — HC' })).toBeInTheDocument();
    });

    it('tanpa akses apa pun menampilkan keadaan tidak berwenang', () => {
        renderAt('/csi/admin/ict');
        expect(screen.getByText('Anda tidak memiliki akses Admin CSI')).toBeInTheDocument();
    });

    it('membuka detail periode dari query ?period=', () => {
        access.pageAccess = { csi_admin_ict: true };
        renderAt('/csi/admin/ict?period=p9');
        expect(screen.getByText('detail:p9')).toBeInTheDocument();
    });
});
