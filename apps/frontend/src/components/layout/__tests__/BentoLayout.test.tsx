import { render, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BentoLayout } from '../BentoLayout';

vi.mock('../BentoSidebar', () => ({ BentoSidebar: () => <nav data-testid="sidebar" /> }));
vi.mock('../SidebarNavigation', () => ({ ShellBrand: () => <div data-testid="brand" /> }));
vi.mock('../BentoTopbar', () => ({ BentoTopbar: () => <header data-testid="topbar" /> }));
vi.mock('../MobileBottomNav', () => ({ MobileBottomNav: () => <nav data-testid="bottom-nav" /> }));
vi.mock('@/hooks/useKeyboardShortcuts', () => ({
    useKeyboardShortcuts: () => ({ helpOpen: false, setHelpOpen: vi.fn() }),
    KeyboardShortcutsHelp: () => null,
}));
vi.mock('@/components/ui/CommandPalette', () => ({
    CommandPalette: () => null,
    useCommandPalette: () => ({ isOpen: false, close: vi.fn() }),
}));
vi.mock('@/components/notifications/InAppNotificationToast', () => ({ InAppNotificationToast: () => null }));
vi.mock('@/components/notifications/CriticalNotificationBanner', () => ({ CriticalNotificationBanner: () => null }));
vi.mock('@/features/csi/components/CsiStartupPopup', () => ({ CsiStartupPopup: () => null }));
vi.mock('@/stores/useAuth', () => ({
    useAuth: () => ({ user: { id: 'u1', role: 'ADMIN', fullName: 'Admin' } }),
}));

afterEach(cleanup);

describe('BentoLayout', () => {
    it('locks the shell and main sheet with overflow-clip and h-dvh and resets window scroll on mount', () => {
        const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
        const { container } = render(
            <MemoryRouter initialEntries={['/csi/admin/ict']}>
                <Routes>
                    <Route element={<BentoLayout />}>
                        <Route path="*" element={<div data-testid="outlet">Content</div>} />
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
