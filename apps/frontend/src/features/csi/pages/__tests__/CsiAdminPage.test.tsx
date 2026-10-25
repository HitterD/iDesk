import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CsiAdminPage } from '../CsiAdminPage';

const access = vi.hoisted(() => ({ role: 'ADMIN', pageAccess: {} as Record<string, boolean> }));

vi.mock('@/stores/useAuth', () => ({ useAuth: () => ({ user: { id: 'a1', role: access.role } }) }));
vi.mock('@/hooks/usePermissions', () => ({
    useMyPermissions: () => ({ data: { pageAccess: access.pageAccess }, isLoading: false, isError: false }),
}));
// Tab content is covered by its own tests; keep the page test about routing and access.
vi.mock('../../components/admin/PeriodsTab', () => ({ PeriodsTab: ({ scope }: { scope: string }) => <p>{`periods:${scope}`}</p> }));
vi.mock('../../components/admin/PeriodDetail', () => ({ PeriodDetail: ({ periodId }: { periodId: string }) => <p>{`detail:${periodId}`}</p> }));

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
        expect(screen.getByRole('button', { name: 'Penilai' })).toBeInTheDocument();
        expect(screen.getByText('periods:ict')).toBeInTheDocument();
    });

    it('ADMIN tanpa csi_admin_hc dialihkan dari /csi/admin/hc ke scope yang diizinkan', () => {
        access.pageAccess = { csi_admin_ict: true };
        renderAt('/csi/admin/hc');
        expect(screen.getByText('periods:ict')).toBeInTheDocument();
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
