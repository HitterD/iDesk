import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BentoSidebar } from '../BentoSidebar';

const csiActive = vi.hoisted(() => ({ current: [] as Array<{ id: string; scope: string; title: string; submitted: boolean }> }));
const ticketModules = vi.hoisted(() => ({ current: [] as Array<{ slug: string; name: string; icon?: string }> }));
vi.mock('@/lib/api', () => ({
    default: {
        get: vi.fn((url: string) => {
            if (url.startsWith('/notifications/count')) return Promise.resolve({ data: { count: 5 } });
            if (url.startsWith('/ticket-modules')) return Promise.resolve({ data: ticketModules.current });
            if (url.startsWith('/csi/me/active')) return Promise.resolve({ data: csiActive.current });
            return Promise.resolve({ data: {} });
        }),
    },
}));

const authUser = vi.hoisted(() => ({ current: { id: 'admin-1', fullName: 'Bagas Developer', role: 'ADMIN' } }));
vi.mock('@/stores/useAuth', () => ({
    useAuth: () => ({ user: authUser.current }),
    performLogout: vi.fn(),
}));

vi.mock('@/features/request-center/api/eform-request.api', () => ({
    usePendingApprovals: () => ({
        data: [{ id: 'req-1' }, { id: 'req-2' }],
    }),
}));

const pageAccess = vi.hoisted(() => ({
    defaults: {
        my_dashboard: true,
        dashboard: true,
        tickets: true,
        oracle_k2_tickets: true,
        hardware_requests: true,
        eform_access: true,
        zoom_calendar: true,
        knowledge_base: true,
        notifications: true,
        reports: true,
        renewal: true,
        agents: true,
        workloads: true,
        automation: true,
        audit_logs: true,
        system_health: true,
        settings: true,
    } as Record<string, boolean>,
    current: null as Record<string, boolean> | null,
}));
vi.mock('@/hooks/usePermissions', () => ({
    useMyPermissions: () => ({
        data: { pageAccess: pageAccess.current ?? pageAccess.defaults },
        isLoading: false,
    }),
}));

vi.mock('@/features/hardware-request/hooks/usePermissions', () => ({
    usePermissions: () => ({
        isIctRole: true,
        isIctLead: true,
    }),
}));

describe('BentoSidebar', () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        });
        localStorage.clear();
        pageAccess.current = null;
        ticketModules.current = [];
        csiActive.current = [];
        authUser.current = { id: 'admin-1', fullName: 'Bagas Developer', role: 'ADMIN' };
    });

    const renderSidebar = (initialPath = '/dashboard') => {
        return render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={[initialPath]}>
                    <BentoSidebar />
                </MemoryRouter>
            </QueryClientProvider>
        );
    };

    it('renders dashboard, navigation groups, and pinned settings', async () => {
        renderSidebar('/dashboard');

        expect(screen.getByText('Dashboard Tim')).toBeInTheDocument();
        // ADMIN is not an agent, so no personal dashboard entry
        expect(screen.queryByText('Dashboard Saya')).not.toBeInTheDocument();
        expect(screen.getByText('Request Center')).toBeInTheDocument();
        expect(screen.getByText('Resources')).toBeInTheDocument();
        expect(screen.getByText('Management')).toBeInTheDocument();
        expect(screen.getByText('Administration')).toBeInTheDocument();
        expect(screen.getByText('Settings')).toBeInTheDocument();
        expect(screen.getByText('Bagas Developer')).toBeInTheDocument();
    });

    it('hides Survei Kepuasan when no survey is active', async () => {
        renderSidebar('/dashboard');
        await waitFor(() => expect(screen.getByText('Dashboard Tim')).toBeInTheDocument());
        expect(screen.queryByRole('link', { name: 'Survei Kepuasan' })).not.toBeInTheDocument();
    });

    it('shows Survei Kepuasan at /csi when an active survey exists', async () => {
        csiActive.current = [{ id: 'p1', scope: 'ICT', title: 'Survei ICT', submitted: false }];
        renderSidebar('/dashboard');
        expect(await screen.findByRole('link', { name: 'Survei Kepuasan' })).toHaveAttribute('href', '/csi');
    });

    it('points Survei Kepuasan to the manager layout for managers', async () => {
        csiActive.current = [{ id: 'p1', scope: 'ICT', title: 'Survei ICT', submitted: true }];
        authUser.current = { id: 'mgr-1', fullName: 'Manager', role: 'MANAGER' };
        renderSidebar('/manager/dashboard');
        expect(await screen.findByRole('link', { name: 'Survei Kepuasan' })).toHaveAttribute('href', '/manager/csi');
    });

    it('shows Admin CSI HC for ADMIN only when csi_admin_hc is granted (no ADMIN bypass)', () => {
        pageAccess.current = { ...pageAccess.defaults, csi_admin_ict: true };
        const { unmount } = renderSidebar('/dashboard');
        expect(screen.getByRole('link', { name: 'Admin CSI ICT' })).toHaveAttribute('href', '/csi/admin/ict');
        expect(screen.queryByRole('link', { name: 'Admin CSI HC' })).not.toBeInTheDocument();
        unmount();

        pageAccess.current = { ...pageAccess.defaults, csi_admin_hc: true };
        renderSidebar('/dashboard');
        expect(screen.getByRole('link', { name: 'Admin CSI HC' })).toHaveAttribute('href', '/csi/admin/hc');
        expect(screen.queryByRole('link', { name: 'Admin CSI ICT' })).not.toBeInTheDocument();
    });

    it('points Admin CSI to the manager layout and hides it from non-admin roles', () => {
        authUser.current = { id: 'mgr-1', fullName: 'Manager', role: 'MANAGER' };
        pageAccess.current = { ...pageAccess.defaults, csi_admin_hc: true };
        const { unmount } = renderSidebar('/manager/dashboard');
        expect(screen.getByRole('link', { name: 'Admin CSI HC' })).toHaveAttribute('href', '/manager/csi/admin/hc');
        unmount();

        authUser.current = { id: 'agent-1', fullName: 'Agent', role: 'AGENT' };
        pageAccess.current = { ...pageAccess.defaults, csi_admin_ict: true, csi_admin_hc: true };
        renderSidebar('/dashboard');
        expect(screen.queryByRole('link', { name: /Admin CSI/ })).not.toBeInTheDocument();
    });

    it('highlights only Dashboard Saya on /dashboard/me, not Dashboard Tim too', async () => {
        authUser.current = { id: 'agent-1', fullName: 'Ops Agent', role: 'AGENT_OPERATIONAL_SUPPORT' };
        renderSidebar('/dashboard/me');

        expect(screen.getByRole('link', { name: 'Dashboard Saya' })).toHaveAttribute('aria-current', 'page');
        expect(screen.getByRole('link', { name: 'Dashboard Tim' })).not.toHaveAttribute('aria-current');
    });

    it('displays notification badges correctly without rendering 0 text', async () => {
        renderSidebar('/tickets/list');

        // E-Form Access has 2 pending approvals -> badge '2'
        const eformItem = await screen.findByText('E-Form Access');
        expect(eformItem).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument();

        // Check that literal "0" is not rendered as text
        expect(screen.queryByText('0')).not.toBeInTheDocument();
    });

    it('expands every group by default when the user has no saved choice', () => {
        renderSidebar('/dashboard');

        expect(screen.getByText('IT Support Tickets')).toBeInTheDocument();
        expect(screen.getByText('Zoom Calendar')).toBeInTheDocument();
        expect(screen.getByText('Reports')).toBeInTheDocument();
        expect(screen.getByText('Agents')).toBeInTheDocument();
        ['Request Center', 'Resources', 'Management', 'Administration'].forEach((label) => {
            expect(screen.getByRole('button', { name: label })).toHaveAttribute('aria-expanded', 'true');
        });
    });

    it('collapses groups independently and persists the choice', async () => {
        renderSidebar('/dashboard');

        fireEvent.click(screen.getByText('Resources'));
        await waitFor(() => expect(screen.queryByText('Zoom Calendar')).not.toBeInTheDocument());
        // Collapsing one group no longer closes the others.
        expect(screen.getByText('Reports')).toBeInTheDocument();
        expect(screen.getByText('Agents')).toBeInTheDocument();
        expect(JSON.parse(localStorage.getItem('sidebar-expanded-groups-v2') ?? '{}')).toMatchObject({ resources: false });

        fireEvent.click(screen.getByText('Resources'));
        await waitFor(() => expect(screen.getByText('Zoom Calendar')).toBeInTheDocument());
    });

    it('respects a saved collapsed group while defaulting unsaved groups to open', () => {
        localStorage.setItem('sidebar-expanded-groups-v2', JSON.stringify({ request_center: true, management: false }));
        renderSidebar('/dashboard');

        expect(screen.queryByText('Reports')).not.toBeInTheDocument();
        expect(screen.getByText('Zoom Calendar')).toBeInTheDocument();
        expect(screen.getByText('Agents')).toBeInTheDocument();
    });

    it('re-opens a saved collapsed group when navigating to one of its routes, keeping other choices', () => {
        localStorage.setItem('sidebar-expanded-groups-v2', JSON.stringify({ management: false, resources: false }));
        renderSidebar('/reports');

        expect(screen.getByText('Reports')).toBeInTheDocument();
        expect(screen.queryByText('Zoom Calendar')).not.toBeInTheDocument();
    });

    it('keeps Request Center permanently expanded', async () => {
        renderSidebar('/dashboard');
        fireEvent.click(screen.getByText('Request Center'));
        await waitFor(() => expect(screen.getByText('IT Support Tickets')).toBeInTheDocument());
    });

    it('toggles collapse mode and renders icon-only sidebar with new logo', async () => {
        renderSidebar('/dashboard');

        const toggleBtn = screen.getByTitle(/Collapse sidebar/i);
        fireEvent.click(toggleBtn);

        // In collapsed mode, full labels inside main aside should be hidden
        expect(screen.getByTitle(/Expand sidebar/i)).toBeInTheDocument();

        // Ensure logo image uses the dedicated icon asset (/idesk-icon.png) in collapsed mode
        const logoImg = screen.getByAltText('iDesk Icon');
        expect(logoImg).toHaveAttribute('src', '/idesk-icon.png');
    });

    it('keeps sidebar expanded by default on /tickets/web-developer', async () => {
        renderSidebar('/tickets/web-developer');
        expect(screen.getByText('Web Developer Request')).toBeInTheDocument();
        expect(screen.getByTitle(/Collapse sidebar/i)).toBeInTheDocument();
    });

    it('keeps sidebar expanded by default on /tickets/mobile-developer', async () => {
        renderSidebar('/tickets/mobile-developer');
        expect(screen.getByText('Mobile Developer Request')).toBeInTheDocument();
        expect(screen.getByTitle(/Collapse sidebar/i)).toBeInTheDocument();
    });

    describe('sapphire shell contract', () => {
        it('renders an authorised custom ticket module route and hides a denied one', async () => {
            authUser.current = { id: 'agent-1', fullName: 'Ops Agent', role: 'AGENT' };
            pageAccess.current = { tickets: true, 'module_network-ops': true, 'module_secret-ops': false };
            ticketModules.current = [
                { slug: 'it-support', name: 'IT Support Tickets' },
                { slug: 'network-ops', name: 'Network Operations', icon: 'Network' },
                { slug: 'secret-ops', name: 'Secret Operations' },
            ];
            renderSidebar('/dashboard');

            const moduleLink = await screen.findByRole('link', { name: 'Network Operations' });
            expect(moduleLink).toHaveAttribute('href', '/tickets/queue/network-ops');
            expect(screen.queryByText('Secret Operations')).not.toBeInTheDocument();
        });

        it('falls back to the default tile for admin-supplied icon names on Object.prototype', async () => {
            ticketModules.current = [
                { slug: 'it-support', name: 'IT Support Tickets' },
                { slug: 'proto-ops', name: 'Proto Operations', icon: 'constructor' },
                { slug: 'string-ops', name: 'String Operations', icon: 'toString' },
            ];
            renderSidebar('/dashboard');

            const proto = await screen.findByRole('link', { name: 'Proto Operations' });
            expect(proto.querySelector('[data-tone]')).toHaveAttribute('data-tone', 'blue');
            expect(screen.getByRole('link', { name: 'String Operations' })).toHaveAttribute('href', '/tickets/queue/string-ops');
        });

        it('does not keep an opened group clipped, so the active tab curves can overflow', async () => {
            renderSidebar('/tickets/list');
            // Resources is open by default; close and re-open it so the height animation runs.
            fireEvent.click(screen.getByText('Resources'));
            await waitFor(() => expect(screen.queryByTestId('nav-group-items-resources')).toBeNull());
            fireEvent.click(screen.getByText('Resources'));

            const opened = await screen.findByTestId('nav-group-items-resources');
            await waitFor(() => expect(opened.style.overflow).toBe('visible'));
            await waitFor(() => expect(screen.getByTestId('nav-group-items-request_center').style.overflow).not.toBe('hidden'));
        });

        it('still hides menus denied by the applied preset', () => {
            authUser.current = { id: 'agent-1', fullName: 'Ops Agent', role: 'AGENT' };
            pageAccess.current = { dashboard: true, tickets: true, notifications: true };
            renderSidebar('/dashboard');

            expect(screen.getByText('IT Support Tickets')).toBeInTheDocument();
            expect(screen.queryByText('Resources')).not.toBeInTheDocument();
            expect(screen.queryByText('Administration')).not.toBeInTheDocument();
            expect(screen.queryByText('Hardware Requests')).not.toBeInTheDocument();
            expect(screen.queryByText('Reports')).not.toBeInTheDocument();
        });

        it('marks the active tab with aria-current and keeps distinct non-purple tiles', () => {
            renderSidebar('/tickets/oracle-k2');

            const active = screen.getByRole('link', { name: 'Oracle K2 Request' });
            expect(active).toHaveAttribute('aria-current', 'page');
            expect(active.querySelector('[data-tone]')).toHaveAttribute('data-tone', 'red');
            expect(screen.getByRole('link', { name: 'IT Support Tickets' })).not.toHaveAttribute('aria-current');

            const mobile = screen.getByRole('link', { name: 'Mobile Developer Request' });
            expect(mobile.querySelector('[data-tone]')).toHaveAttribute('data-tone', 'teal-deep');

            const tones = Array.from(document.querySelectorAll('[data-tone]')).map((el) => el.getAttribute('data-tone'));
            expect(new Set(tones).size).toBeGreaterThan(5);
            expect(tones.join(' ')).not.toMatch(/purple|violet|fuchsia/);
            expect(document.body.innerHTML).not.toMatch(/purple|violet|fuchsia/);
        });

        it('keeps collapsed items accessibly named', () => {
            renderSidebar('/dashboard');
            fireEvent.click(screen.getByTitle(/Collapse sidebar/i));

            expect(screen.getByRole('link', { name: 'Dashboard Tim' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Request Center' })).toBeInTheDocument();
            expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument();
        });

        it.each([false, true])('keeps profile and logout reachable bottom-left (collapsed=%s)', (collapsed) => {
            renderSidebar('/dashboard');
            if (collapsed) fireEvent.click(screen.getByTitle(/Collapse sidebar/i));

            const profile = screen.getByRole('link', { name: /Bagas Developer/ });
            expect(profile).toHaveAttribute('href', '/settings');
            expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument();
        });
    });
});
