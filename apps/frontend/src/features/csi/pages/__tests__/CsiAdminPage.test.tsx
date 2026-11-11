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
    PeriodsTab: ({ scope, onOpen, onCreate, onCreated }: { scope: string; onOpen: (row: ListItem) => void; onCreate: () => void; onCreated?: (id: string) => void }) => (
        <div>
            <p>{`periods:${scope}`}</p>
            <button type="button" onClick={onCreate}>Buat Survei</button>
            <button type="button" onClick={() => onCreated?.('hc-new')}>survei HC dibuat</button>
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
const settings = vi.hoisted(() => ({ pending: 0 }));
vi.mock('../../components/admin/SettingsPanel', () => ({
    SettingsPanel: ({ scope }: { scope: string }) => <p>{`settings:${scope}`}</p>,
    useSettingsStatus: () => Array.from({ length: 4 }, (_, index) => ({ key: `k${index}`, done: index >= settings.pending })),
}));
vi.mock('../../components/wizard/WizardRoute', () => ({
    WizardRoute: ({ route }: { route: { wizard: string | null; step: string | null; closeAll: () => void } }) => (
        <div><p>{`wizard:${route.wizard ?? 'new'}:${route.step ?? 'resume'}`}</p><button type="button" onClick={route.closeAll}>tutup</button></div>
    ),
}));

vi.mock('../../components/admin/hc/templates/HcSurveyWizard', () => ({
    HcSurveyWizard: ({ onOpenChange, onCreated }: { onOpenChange: (open: boolean) => void; onCreated?: (id: string) => void }) => (
        <div><p>hc-wizard</p><button type="button" onClick={() => onCreated?.('hc-made')}>buat dari template</button>
            <button type="button" onClick={() => onOpenChange(false)}>batal hc</button></div>
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

beforeEach(() => { access.role = 'ADMIN'; access.pageAccess = {}; settings.pending = 0; });
afterEach(cleanup);

describe('CsiAdminPage', () => {
    it('menampilkan scope yang diizinkan dengan judul dan tab', () => {
        access.pageAccess = { csi_admin_ict: true };
        renderAt('/csi/admin/ict');
        expect(screen.getByRole('heading', { name: 'Survei Kepuasan — ICT' })).toBeInTheDocument();
        expect(screen.getAllByRole('button').map((button) => button.textContent).slice(0, 4))
            .toEqual(['Dashboard', 'Survei', 'Pengaturan']);
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

    it('Pengaturan menggabungkan subjek, pertanyaan, penilai, departemen dan menyebut yang belum lengkap', async () => {
        const actor = userEvent.setup();
        settings.pending = 2;
        access.pageAccess = { csi_admin_ict: true };
        renderAt('/csi/admin/ict');
        await actor.click(screen.getByRole('button', { name: 'Pengaturan · 2 perlu dilengkapi' }));
        expect(screen.getByText('settings:ict')).toBeInTheDocument();
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

    it('survei HC dari template langsung membuka draft barunya (lanjut di langkah pertama yang belum lengkap)', async () => {
        const actor = userEvent.setup();
        renderAt('/csi/admin/hc');
        await actor.click(screen.getByRole('button', { name: 'Survei' }));
        expect(screen.getByText('periods:hc')).toBeInTheDocument();
        await actor.click(screen.getByRole('button', { name: 'survei HC dibuat' }));
        expect(screen.getByText('wizard:hc-new:resume')).toBeInTheDocument();
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

    it('?wizard=new untuk HC membuka wizard template HC, bukan wizard generik', async () => {
        const actor = userEvent.setup();
        renderAt('/csi/admin/hc?wizard=new&step=info');
        expect(screen.getByText('hc-wizard')).toBeInTheDocument();
        expect(screen.queryByText(/^wizard:/)).not.toBeInTheDocument();
        await actor.click(screen.getByRole('button', { name: 'buat dari template' }));
        expect(screen.getByText('wizard:hc-made:resume')).toBeInTheDocument();
    });

    it('menutup wizard template HC dari ?wizard=new menutup rute wizard', async () => {
        renderAt('/csi/admin/hc?wizard=new');
        await userEvent.setup().click(screen.getByRole('button', { name: 'batal hc' }));
        expect(screen.queryByText('hc-wizard')).not.toBeInTheDocument();
        expect(screen.getByText('dashboard:hc')).toBeInTheDocument();
    });

    it('?wizard=new untuk ICT dan salinan HC tetap memakai wizard generik', () => {
        const { unmount } = renderAt('/csi/admin/hc?wizard=new&copy=p0');
        expect(screen.getByText('wizard:new:resume')).toBeInTheDocument();
        unmount();
        access.pageAccess = { csi_admin_ict: true };
        renderAt('/csi/admin/ict?wizard=new');
        expect(screen.queryByText('hc-wizard')).not.toBeInTheDocument();
    });

    it('ADMIN selalu bisa membuka Admin HC; ICT tanpa key dialihkan ke HC', () => {
        const { unmount } = renderAt('/csi/admin/hc');
        expect(screen.getByText('dashboard:hc')).toBeInTheDocument();
        unmount();
        renderAt('/csi/admin/ict');
        expect(screen.getByText('dashboard:hc')).toBeInTheDocument();
    });

    it('HC_ADMIN hanya HC, walau preset memberi key ICT', () => {
        access.role = 'HC_ADMIN';
        access.pageAccess = { csi_admin_ict: true };
        renderAt('/csi/admin/ict');
        expect(screen.getByText('dashboard:hc')).toBeInTheDocument();
    });

    it('scope tidak dikenal dialihkan dalam layout manager', () => {
        access.role = 'MANAGER';
        access.pageAccess = { csi_admin_hc: true };
        renderAt('/manager/csi/admin/xyz');
        expect(screen.getByRole('heading', { name: 'Survei Kepuasan — HC' })).toBeInTheDocument();
    });

    it('tanpa akses apa pun menampilkan keadaan tidak berwenang', () => {
        access.role = 'MANAGER';
        renderAt('/csi/admin/ict');
        expect(screen.getByText('Anda tidak memiliki akses Admin CSI')).toBeInTheDocument();
    });

    it('membuka detail periode dari query ?period=', () => {
        access.pageAccess = { csi_admin_ict: true };
        renderAt('/csi/admin/ict?period=p9');
        expect(screen.getByText('detail:p9')).toBeInTheDocument();
    });
});
