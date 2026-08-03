import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RoleDropdown } from './RoleDropdown';

describe('RoleDropdown', () => {
    const mockUser = {
        id: 'user-1',
        fullName: 'Test User',
        email: 'test@example.com',
        role: 'USER',
        createdAt: '2026-07-21T00:00:00.000Z',
    };

    it('renders user current role pill badge', () => {
        render(
            <RoleDropdown
                user={mockUser}
                onApplyRole={vi.fn()}
            />
        );

        // Human label, not the raw enum — uppercasing is presentational only.
        expect(screen.getByRole('button', { name: /User/ })).toHaveAttribute('aria-expanded', 'false');
    });

    it('opens dropdown portal when clicked and triggers onApplyRole when role selected', () => {
        const handleApplyRole = vi.fn();
        render(
            <RoleDropdown
                user={mockUser}
                onApplyRole={handleApplyRole}
            />
        );

        const badge = screen.getByRole('button', { name: /User/ });
        fireEvent.click(badge);

        // Check if role options popover is displayed
        expect(screen.getByText('PILIH ROLE USER')).toBeInTheDocument();
        expect(screen.getByText('Agent Admin')).toBeInTheDocument();
        expect(screen.getByText('Manager')).toBeInTheDocument();

        // Click on Agent role option
        fireEvent.click(screen.getByText('Agent Admin'));

        expect(handleApplyRole).toHaveBeenCalledWith('user-1', 'AGENT_ADMIN');
    });

    it('renders updating state spinner when isApplying is true', () => {
        render(
            <RoleDropdown
                user={mockUser}
                onApplyRole={vi.fn()}
                isApplying={true}
            />
        );

        expect(screen.getByText('Updating…')).toBeInTheDocument();
    });
});
