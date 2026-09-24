import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ActionCommandCenter } from '../ActionCommandCenter';

// Mock hooks using alias path
vi.mock('@/features/notifications/hooks/useActionItems', () => ({
    useActionItems: () => ({
        items: [
            {
                id: 'action-1',
                entityType: 'HARDWARE_REQUEST',
                title: 'Hardware Approval Pending',
                description: 'Request HR-2026-0016',
                urgency: 'HIGH',
                entityId: 'hr-123',
                link: '/hardware/123',
                createdAt: new Date().toISOString(),
            },
        ],
        activeItems: [
            {
                id: 'action-1',
                entityType: 'HARDWARE_REQUEST',
                title: 'Hardware Approval Pending',
                description: 'Request HR-2026-0016',
                urgency: 'HIGH',
                entityId: 'hr-123',
                link: '/hardware/123',
                createdAt: new Date().toISOString(),
            },
        ],
        counts: {
            critical: 0,
            high: 1,
            normal: 0,
            total: 1,
        },
        isLoading: false,
        refetch: vi.fn(),
    }),
}));

// Also mock relative paths to be safe
vi.mock('../../../features/notifications/hooks/useActionItems', () => ({
    useActionItems: () => ({
        items: [
            {
                id: 'action-1',
                entityType: 'HARDWARE_REQUEST',
                title: 'Hardware Approval Pending',
                description: 'Request HR-2026-0016',
                urgency: 'HIGH',
                entityId: 'hr-123',
                link: '/hardware/123',
                createdAt: new Date().toISOString(),
            },
        ],
        activeItems: [
            {
                id: 'action-1',
                entityType: 'HARDWARE_REQUEST',
                title: 'Hardware Approval Pending',
                description: 'Request HR-2026-0016',
                urgency: 'HIGH',
                entityId: 'hr-123',
                link: '/hardware/123',
                createdAt: new Date().toISOString(),
            },
        ],
        counts: {
            critical: 0,
            high: 1,
            normal: 0,
            total: 1,
        },
        isLoading: false,
        refetch: vi.fn(),
    }),
}));

vi.mock('../../../features/notifications/hooks/useReminderEngine', () => ({
    useReminderEngine: vi.fn(),
}));

vi.mock('../../../features/notifications/hooks/useCategorySettings', () => ({
    useCategorySettings: () => ({
        settings: { TICKET: true, HARDWARE_REQUEST: true },
        updateSettings: vi.fn(),
        isUpdating: false,
    }),
}));

vi.mock('@/stores/useAuth', () => ({
    useAuth: () => ({
        user: { role: 'ADMIN' },
    }),
}));

describe('ActionCommandCenter (De-slopped Panel)', () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        });
    });

    const renderComponent = () => {
        return render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter>
                    <ActionCommandCenter />
                </MemoryRouter>
            </QueryClientProvider>
        );
    };

    it('opens popover on clicking trigger and shows clean tabs and rows', async () => {
        renderComponent();

        const triggerBtn = screen.getByRole('button', { name: /Action Command Center/i });
        expect(triggerBtn).toBeInTheDocument();

        // Open popover
        fireEvent.click(triggerBtn);

        // Header shows clean title and high urgency badge
        expect(screen.getByText('Action Items')).toBeInTheDocument();
        expect(screen.getByText('1 penting')).toBeInTheDocument();

        // Tabs show counts in clean (n) format
        expect(screen.getByText('Semua')).toBeInTheDocument();
        expect(screen.getAllByText('Hardware')).toHaveLength(2); // In tab and in row
        expect(screen.getAllByText('(1)')).toHaveLength(2); // In Semua and in Hardware tab

        // Row item renders cleanly
        expect(screen.getByText('Hardware Approval Pending')).toBeInTheDocument();
        expect(screen.getByText('Request HR-2026-0016')).toBeInTheDocument();

        // Slop tells must not exist
        expect(screen.queryByText(/klik untuk membuka/i)).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Buka' })).toBeInTheDocument();
    });
});
