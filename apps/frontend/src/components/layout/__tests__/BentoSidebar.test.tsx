import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BentoSidebar } from '../BentoSidebar';

vi.mock('@/lib/api', () => ({
    default: {
        get: vi.fn((url: string) => {
            if (url.startsWith('/notifications/count')) return Promise.resolve({ data: { count: 5 } });
            return Promise.resolve({ data: {} });
        }),
    },
}));

vi.mock('@/stores/useAuth', () => ({
    useAuth: () => ({
        user: { id: 'admin-1', fullName: 'Bagas Developer', role: 'ADMIN' },
    }),
    performLogout: vi.fn(),
}));

vi.mock('@/features/request-center/api/eform-request.api', () => ({
    usePendingApprovals: () => ({
        data: [{ id: 'req-1' }, { id: 'req-2' }],
    }),
}));

vi.mock('@/hooks/usePermissions', () => ({
    useMyPermissions: () => ({
        data: {
            pageAccess: {
                dashboard: true,
                tickets: true,
                oracle_k2_tickets: true,
                hardware_requests: true,
                eform_access: true,
                lost_items: true,
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
            },
        },
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

        expect(screen.getByText('Dashboard')).toBeInTheDocument();
        expect(screen.getByText('Request Center')).toBeInTheDocument();
        expect(screen.getByText('Resources')).toBeInTheDocument();
        expect(screen.getByText('Management')).toBeInTheDocument();
        expect(screen.getByText('Administration')).toBeInTheDocument();
        expect(screen.getByText('Settings')).toBeInTheDocument();
        expect(screen.getByText('Bagas Developer')).toBeInTheDocument();
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

    it('handles smart multi-group accordion: keeps active group open while toggling secondary groups', async () => {
        renderSidebar('/tickets/list');

        // Initially Request Center is open because /tickets/list is active
        expect(screen.getByText('E-Form Access')).toBeInTheDocument();

        // 1. Click Resources group -> expands Resources WHILE keeping Request Center open!
        const resourcesBtn = screen.getByText('Resources');
        fireEvent.click(resourcesBtn);

        await waitFor(() => {
            expect(screen.getByText('Zoom Calendar')).toBeInTheDocument();
            expect(screen.getByText('E-Form Access')).toBeInTheDocument(); // Request Center remains open
        });

        // 2. Click Management group -> expands Management, closes Resources, but keeps Request Center open!
        const managementBtn = screen.getByText('Management');
        fireEvent.click(managementBtn);

        await waitFor(() => {
            expect(screen.getByText('Reports')).toBeInTheDocument(); // Management is open
            expect(screen.getByText('E-Form Access')).toBeInTheDocument(); // Request Center remains open
            expect(screen.queryByText('Zoom Calendar')).not.toBeInTheDocument(); // Resources is closed
        });
    });

    it('keeps Request Center permanently expanded on /dashboard while allowing max 1 other secondary group', async () => {
        renderSidebar('/dashboard');

        // On /dashboard, Request Center is open by default
        expect(screen.getByText('IT Support Tickets')).toBeInTheDocument();
        expect(screen.getByText('E-Form Access')).toBeInTheDocument();

        // 1. Open Resources -> Resources opens, Request Center remains open (Total = 2)
        const resourcesBtn = screen.getByText('Resources');
        fireEvent.click(resourcesBtn);

        await waitFor(() => {
            expect(screen.getByText('Zoom Calendar')).toBeInTheDocument();
            expect(screen.getByText('IT Support Tickets')).toBeInTheDocument();
        });

        // 2. Open Administration -> Admin opens, Resources closes, Request Center remains open (Total = 2)
        const adminBtn = screen.getByText('Administration');
        fireEvent.click(adminBtn);

        await waitFor(() => {
            expect(screen.getByText('Agents')).toBeInTheDocument();
            expect(screen.queryByText('Zoom Calendar')).not.toBeInTheDocument();
            expect(screen.getByText('IT Support Tickets')).toBeInTheDocument();
        });

        // 3. Click Administration again -> Admin closes, leaving only Request Center (Total = 1)
        fireEvent.click(adminBtn);

        await waitFor(() => {
            expect(screen.queryByText('Agents')).not.toBeInTheDocument();
            expect(screen.getByText('IT Support Tickets')).toBeInTheDocument();
        });
    });

    it('toggles collapse mode and renders icon-only sidebar with new logo', async () => {
        renderSidebar('/dashboard');

        const toggleBtn = screen.getByTitle(/Collapse sidebar/i);
        fireEvent.click(toggleBtn);

        // In collapsed mode, full labels inside main aside should be hidden
        expect(screen.getByTitle(/Expand sidebar/i)).toBeInTheDocument();

        // Ensure logo image uses the new logo asset (/idesk-logo.png)
        const logoImg = screen.getByAltText('iDesk Logo');
        expect(logoImg).toHaveAttribute('src', '/idesk-logo.png');
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
});
