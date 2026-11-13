import { cleanup, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ClientLayout } from '../ClientLayout';

const authState = vi.hoisted(() => ({
    user: { id: 'u-7', role: 'USER', fullName: 'Rina Pemohon', email: 'rina@example.com' },
    justLoggedIn: false,
    setJustLoggedIn: () => {},
}));
const performLogout = vi.hoisted(() => vi.fn(() => Promise.resolve()));
vi.mock('@/stores/useAuth', () => ({
    useAuth: () => authState,
    performLogout,
}));

const permissions = vi.hoisted(() => ({
    current: { pageAccess: { hardware_requests: false, eform_access: true, zoom_calendar: false, knowledge_base: true } } as
        { pageAccess?: Record<string, boolean> } | undefined,
}));
vi.mock('@/hooks/usePermissions', () => ({
    useMyPermissions: () => ({ data: permissions.current }),
}));

const csiActive = vi.hoisted(() => ({ current: undefined as Array<{ id: string; scope: string; title: string; submitted: boolean }> | undefined }));
const csiOwnerReport = vi.hoisted(() => ({ current: false }));
vi.mock('@/features/csi/hooks/useCsi', () => ({
    useCsiActive: () => ({ data: csiActive.current }),
}));
vi.mock('@/features/csi/hooks/useCsiHc', () => ({
    useCsiOwnerReportAccess: () => csiOwnerReport.current,
}));

// Real implementations are untouched by this task; stub them to isolate the shell.
vi.mock('../../notifications/NotificationPopover', () => ({
    NotificationPopover: () => <button type="button">Notifikasi</button>,
}));
vi.mock('../../notifications/ActionCommandCenter', () => ({
    ActionCommandCenter: () => <button type="button">Action Command Center</button>,
}));
vi.mock('../../ui/ThemeToggle', () => ({
    ThemeToggle: () => <button type="button">Switch theme</button>,
}));
vi.mock('../../notifications/InAppNotificationToast', () => ({
    InAppNotificationToast: () => null,
}));
vi.mock('@/features/client/components/UserGuidebookModal', () => ({
    UserGuidebookModal: () => null,
}));
vi.mock('@/features/csi/components/CsiStartupPopup', () => ({
    CsiStartupPopup: () => null,
}));

const renderPortal = (path = '/client/my-tickets') =>
    render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="/client" element={<ClientLayout />}>
                    <Route path="my-tickets" element={<p>My tickets page</p>} />
                    <Route path="eform-access" element={<p>E-form page</p>} />
                    <Route path="tickets/:id" element={<p>Detail page</p>} />
                </Route>
                <Route path="/login" element={<p>Login page</p>} />
            </Routes>
        </MemoryRouter>,
    );

const portalNav = () => screen.getByRole('navigation', { name: 'Navigasi portal' });
const bottomNav = () => screen.getByRole('navigation', { name: 'Navigasi bawah' });

describe('ClientLayout requester shell', () => {
    beforeEach(() => {
        performLogout.mockClear();
        permissions.current = { pageAccess: { hardware_requests: false, eform_access: true, zoom_calendar: false, knowledge_base: true } };
        csiActive.current = undefined;
        csiOwnerReport.current = false;
    });

    it('keeps the preset-limited navigation in the portal segment', () => {
        renderPortal();
        // Short labels in the segment; profile lives in the account menu, not the segment.
        const labels = within(portalNav()).getAllByRole('link').map((link) => link.textContent?.trim());
        expect(labels).toEqual(['Tiket Saya', 'E-Form', 'Bantuan']);
        expect(within(portalNav()).queryByRole('link', { name: /Profile|Akun/ })).not.toBeInTheDocument();
        expect(within(portalNav()).queryByText('Hardware Requests')).not.toBeInTheDocument();
        expect(within(portalNav()).queryByText('Zoom Calendar')).not.toBeInTheDocument();
    });

    it('hides the survey tab while the active-survey list is loading or empty', () => {
        renderPortal();
        expect(within(portalNav()).queryByRole('link', { name: /Survei CSI/ })).not.toBeInTheDocument();
        csiActive.current = [];
        cleanup();
        renderPortal();
        expect(within(portalNav()).queryByRole('link', { name: /Survei CSI/ })).not.toBeInTheDocument();
    });

    it('adds the Survei CSI tab with pending count badge before Profile when an active survey exists', () => {
        csiActive.current = [{ id: 'p1', scope: 'ICT', title: 'Survei ICT', submitted: false }];
        renderPortal();
        const labels = within(portalNav()).getAllByRole('link').map((link) => link.textContent?.trim());
        expect(labels).toEqual(['Tiket Saya', 'E-Form', 'Bantuan', 'Survei CSI1']);
        expect(within(portalNav()).getByRole('link', { name: /Survei CSI/ })).toHaveAttribute('href', '/client/csi');
        expect(within(portalNav()).getByRole('link', { name: /Survei CSI/ })).toHaveAttribute('data-tone', 'teal');
    });

    it('shows Report CSI tab for report owners when no active survey exists, and avoids duplicate when active', () => {
        csiActive.current = [];
        csiOwnerReport.current = true;
        renderPortal();
        expect(within(portalNav()).getByRole('link', { name: 'Report CSI' })).toHaveAttribute('href', '/client/csi/report');
        expect(within(portalNav()).queryByRole('link', { name: /Survei CSI/ })).not.toBeInTheDocument();

        cleanup();
        csiActive.current = [{ id: 'p1', scope: 'HC', title: 'Survei HC', submitted: true }];
        renderPortal();
        expect(within(portalNav()).getByRole('link', { name: 'Survei CSI' })).toHaveAttribute('href', '/client/csi');
        expect(within(portalNav()).queryByRole('link', { name: 'Report CSI' })).not.toBeInTheDocument();
    });

    it('shows every item while the preset is still loading', () => {
        permissions.current = undefined;
        renderPortal();
        expect(within(portalNav()).getAllByRole('link')).toHaveLength(5);
    });

    it('marks the selected route with aria-current', () => {
        renderPortal('/client/eform-access');
        expect(within(portalNav()).getByRole('link', { name: 'E-Form' })).toHaveAttribute('aria-current', 'page');
        expect(within(portalNav()).getByRole('link', { name: 'Tiket Saya' })).not.toHaveAttribute('aria-current');
    });

    it('always shows every tab label beside its module-coloured tile, without an aria-label that hides it', () => {
        renderPortal();
        const tones = within(portalNav()).getAllByRole('link').map((link) => {
            expect(link).not.toHaveAttribute('aria-label');
            const [tile, label] = Array.from(link.children);
            expect(tile).toHaveClass('nav-tile');
            expect(label).not.toHaveClass('hidden');
            expect(label.textContent).not.toBe('');
            return tile.getAttribute('data-tone');
        });
        // Each module keeps its own colour.
        expect(new Set(tones).size).toBe(tones.length);
    });

    it('renders the sapphire chrome and a rounded content sheet', () => {
        const { container } = renderPortal();
        expect(container.querySelector('.idesk-shell')).not.toBeNull();
        expect(container.querySelector('.idesk-sheet')).toHaveTextContent('My tickets page');
    });

    it('links the amber create action to the client create route', () => {
        renderPortal();
        const banner = screen.getByRole('banner');
        const cta = within(banner).getByRole('link', { name: 'Buat Tiket Baru' });
        expect(cta).toHaveAttribute('href', '/client/create');
        expect(cta).toHaveClass('idesk-cta');
        // Hidden below lg, where the bottom nav carries the create action instead.
        expect(cta).toHaveClass('hidden');
    });

    it('keeps theme, action center and notifications utilities', () => {
        renderPortal();
        const banner = screen.getByRole('banner');
        expect(within(banner).getByRole('button', { name: 'Switch theme' })).toBeInTheDocument();
        expect(within(banner).getByRole('button', { name: 'Action Command Center' })).toBeInTheDocument();
        expect(within(banner).getByRole('button', { name: 'Notifikasi' })).toBeInTheDocument();
    });

    it('shows the real user in the account menu and wires real logout', async () => {
        const user = userEvent.setup();
        renderPortal();
        expect(screen.queryByText('User SPJ')).not.toBeInTheDocument();

        const account = screen.getByRole('button', { name: 'Akun Rina Pemohon' });
        await user.click(account);
        const menu = await screen.findByRole('menu');
        expect(within(menu).getByText('rina@example.com')).toBeInTheDocument();
        expect(within(menu).getByRole('menuitem', { name: 'Akun' })).toHaveAttribute('href', '/client/profile');

        await user.click(within(menu).getByRole('menuitem', { name: /Keluar/ }));
        expect(performLogout).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(screen.getByText('Login page')).toBeInTheDocument());
    });

    it('offers a mobile bottom nav with a labelled raised create action', () => {
        renderPortal();
        const nav = bottomNav();
        const create = within(nav).getByRole('link', { name: 'Buat Tiket Baru' });
        expect(create).toHaveAttribute('href', '/client/create');
        expect(create).toHaveTextContent('Tiket Baru');
        expect(create.querySelector('.idesk-cta')).not.toBeNull();
        // Accessible name equals the visible label (WCAG 2.5.3).
        expect(within(nav).getByRole('link', { name: 'Tiket Saya' })).toHaveAttribute('aria-current', 'page');
        expect(within(nav).getByRole('link', { name: 'Akun' })).toHaveAttribute('href', '/client/profile');
        within(nav).getAllByRole('link').filter((link) => link !== create)
            .forEach((link) => expect(link).not.toHaveAttribute('aria-label'));
        // Bottom nav only uses authorised items.
        expect(within(nav).queryByRole('link', { name: /Hardware/ })).not.toBeInTheDocument();
    });

    it('puts a pending survey first in the bottom nav without reordering the topbar', () => {
        csiActive.current = [{ id: 'p1', scope: 'ICT', title: 'Survei ICT', submitted: false }];
        renderPortal();
        const bottomLabels = within(bottomNav()).getAllByRole('link').map((link) => link.textContent?.trim());
        expect(bottomLabels).toEqual(['Survei CSI', 'Tiket Saya', 'Tiket Baru', 'E-Form', 'Akun']);
        const topLabels = within(portalNav()).getAllByRole('link').map((link) => link.textContent?.trim());
        expect(topLabels).toEqual(['Tiket Saya', 'E-Form', 'Bantuan', 'Survei CSI1']);
    });

    it('keeps the survey after the sections in the bottom nav once every survey is submitted', () => {
        csiActive.current = [{ id: 'p1', scope: 'ICT', title: 'Survei ICT', submitted: true }];
        renderPortal();
        const bottomLabels = within(bottomNav()).getAllByRole('link').map((link) => link.textContent?.trim());
        expect(bottomLabels).toEqual(['Tiket Saya', 'E-Form', 'Tiket Baru', 'Bantuan', 'Akun']);
    });

    it('hides the bottom nav and keeps the full-height layout on ticket detail', () => {
        const { container } = renderPortal('/client/tickets/abc-123');
        expect(screen.queryByRole('navigation', { name: 'Navigasi bawah' })).not.toBeInTheDocument();
        expect(screen.getByText('Detail page')).toBeInTheDocument();
        expect(container.querySelector('#main-content')).toHaveClass('overflow-hidden');
    });
});
