import { render, cleanup } from '@testing-library/react';
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
vi.mock('../ClientTopbar', () => ({ ClientTopbar: () => <header data-testid="client-topbar" /> }));
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
});
