import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ActionRow } from '../ActionRow';
import { ActionItem } from '../types/action-item.types';

describe('ActionRow Component (De-slopped)', () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });

    const renderWithQuery = (ui: React.ReactElement) => {
        return render(
            <QueryClientProvider client={queryClient}>
                {ui}
            </QueryClientProvider>
        );
    };

    const mockItem: ActionItem = {
        id: 'action-1',
        entityType: 'HARDWARE_REQUEST',
        title: 'Hardware Approval Pending',
        description: 'Request HR-2026-0016',
        urgency: 'HIGH',
        entityId: 'hr-123',
        link: '/hardware-requests/123',
        createdAt: new Date().toISOString(),
    };

    it('renders clean metadata without AI slop tells', () => {
        const onClick = vi.fn();
        renderWithQuery(<ActionRow item={mockItem} onClick={onClick} index={0} />);

        // Clean title and description
        expect(screen.getByText('Hardware Approval Pending')).toBeInTheDocument();
        expect(screen.getByText('Request HR-2026-0016')).toBeInTheDocument();
        expect(screen.getByText('Hardware')).toBeInTheDocument();
        expect(screen.getByText('Penting')).toBeInTheDocument();

        // Must NOT render redundant "Klik untuk membuka" text
        expect(screen.queryByText(/klik untuk membuka/i)).not.toBeInTheDocument();

        // Direct action button is clean "Buka" without decorative arrow
        const openBtn = screen.getByRole('button', { name: 'Buka' });
        expect(openBtn).toBeInTheDocument();
        expect(openBtn.textContent).toBe('Buka');

        // Snooze button exists
        expect(screen.getByTitle('Tunda reminder')).toBeInTheDocument();
    });

    it('calls onClick when clicking on row or action button', () => {
        const onClick = vi.fn();
        renderWithQuery(<ActionRow item={mockItem} onClick={onClick} index={0} />);

        const openBtn = screen.getByRole('button', { name: 'Buka' });
        fireEvent.click(openBtn);
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('renders "Join" for Zoom entity items', () => {
        const zoomItem: ActionItem = {
            ...mockItem,
            id: 'zoom-1',
            entityType: 'ZOOM',
            title: 'Weekly Standup Zoom Meeting',
            urgency: 'NORMAL',
        };
        renderWithQuery(<ActionRow item={zoomItem} onClick={vi.fn()} index={0} />);

        expect(screen.getByRole('button', { name: 'Join' })).toBeInTheDocument();
        expect(screen.getByText('Zoom')).toBeInTheDocument();
    });
});
