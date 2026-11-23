import { render, cleanup, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClientLayout } from '../ClientLayout';

vi.mock('@/stores/useAuth', () => ({
    useAuth: () => ({ user: { id: 'u1', role: 'USER', fullName: 'Client' }, justLoggedIn: false, setJustLoggedIn: vi.fn() }),
    performLogout: vi.fn(),
}));
vi.mock('@/hooks/usePermissions', () => ({
    useMyPermissions: () => ({ data: { pageAccess: {} } }),
}));
vi.mock('@/features/csi/hooks/useCsi', () => ({
    useCsiActive: () => ({ data: [] }),
    useCsiMyResults: () => ({ data: [] }),
}));
vi.mock('@/features/csi/hooks/useCsiHc', () => ({
    useCsiOwnerReportAccess: () => false,
}));
vi.mock('@/features/client/components/UserGuidebookModal', () => ({ UserGuidebookModal: () => null }));
vi.mock('@/features/csi/components/CsiStartupPopup', () => ({ CsiStartupPopup: () => null }));
vi.mock('@/components/notifications/InAppNotificationToast', () => ({ InAppNotificationToast: () => null }));
vi.mock('@/components/notifications/ActionCommandCenter', () => ({ ActionCommandCenter: () => null }));
let approvalsWaiting = 0;
vi.mock('@/features/client/pages/ApprovalsPage', () => ({ useApprovals: () => ({ data: Array.from({ length: approvalsWaiting }, (_, i) => ({ ticketId: `t-${i}` })) }) }));
vi.mock('../ClientTopbar', () => ({
    ClientTopbar: ({ navItems }: { navItems: Array<{ path: string; label: string; badge?: number }> }) => (
        <header data-testid="client-topbar">{navItems.map((item) => <a key={item.path} href={item.path}>{item.label}{item.badge ? ` (${item.badge})` : ''}</a>)}</header>
    ),
}));
vi.mock('../ClientBottomNav', () => ({ ClientBottomNav: () => <nav data-testid="client-bottom-nav" /> }));

afterEach(cleanup);

describe('ClientLayout', () => {
    it('locks the client portal shell and sheet with h-dvh and overflow-clip and resets window scroll', () => {
        const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
        const { container } = render(
            <MemoryRouter initialEntries={['/client/csi/p1']}>
                <Routes>
                    <Route element={<ClientLayout />}>
                        <Route path="*" element={<div>Survey</div>} />
                    </Route>
                </Routes>
            </MemoryRouter>,
        );

        const shell = container.querySelector('.idesk-shell');
        const sheet = container.querySelector('.idesk-sheet');
        expect(shell).toHaveClass('h-dvh', 'overflow-clip');
        expect(sheet).toHaveClass('overflow-clip');
        expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' });
        scrollToSpy.mockRestore();
    });

    const renderAt = (path = '/client/my-tickets') => render(
        <MemoryRouter initialEntries={[path]}>
            <Routes><Route element={<ClientLayout />}><Route path="*" element={<div>Halaman</div>} /></Route></Routes>
        </MemoryRouter>,
    );

    it('the old Hardware and E-Form menu items are gone: those requests live in My Tickets now', () => {
        approvalsWaiting = 0;
        renderAt();
        expect(screen.queryByText('Hardware Requests')).toBeNull();
        expect(screen.queryByText('E-Form Access')).toBeNull();
        expect(screen.getByText('My Tickets')).toBeInTheDocument();
    });

    it('"Persetujuan" appears, with how many wait, only when something waits for my signature', () => {
        approvalsWaiting = 0;
        const { unmount } = renderAt();
        expect(screen.queryByText(/Persetujuan/)).toBeNull();
        unmount();
        approvalsWaiting = 3;
        renderAt();
        expect(screen.getByText('Persetujuan (3)')).toHaveAttribute('href', '/client/approvals');
    });
});
