import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ZoomRightSidebar } from '../ZoomRightSidebar';
import type { AccountLoad } from '../../utils/autoPickAccount';
import type { ZoomBooking } from '../../types';

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter>{children}</MemoryRouter>
);

const baseProps = {
    accounts: [] as AccountLoad[],
    upcomingBookings: [] as ZoomBooking[],
    onBook1Hour: vi.fn(),
    onBookCustom: vi.fn(),
    onSync: vi.fn(),
    lastSyncAt: null as Date | null,
    userName: 'Bagas',
};

describe('ZoomRightSidebar', () => {
    it('renders all 5 sections', () => {
        render(<ZoomRightSidebar {...baseProps} />, { wrapper });
        expect(screen.getAllByText(/account load/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/upcoming/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/quick book/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/my tasks/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/^system$/i).length).toBeGreaterThan(0);
    });

    it('displays user name in system section', () => {
        render(<ZoomRightSidebar {...baseProps} userName="Bagas" />, { wrapper });
        expect(screen.getAllByText(/Bagas/).length).toBeGreaterThan(0);
    });

    it('renders 1-hour and Custom buttons in quick book section', () => {
        render(<ZoomRightSidebar {...baseProps} />, { wrapper });
        expect(screen.getByRole('button', { name: /1 hour meeting/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /custom/i })).toBeInTheDocument();
    });

    it('calls onBook1Hour when 1-hour button clicked', async () => {
        const onBook1Hour = vi.fn();
        render(<ZoomRightSidebar {...baseProps} onBook1Hour={onBook1Hour} />, { wrapper });
        screen.getByRole('button', { name: /1 hour meeting/i }).click();
        expect(onBook1Hour).toHaveBeenCalledOnce();
    });

    it('shows empty state for accounts when none', () => {
        render(<ZoomRightSidebar {...baseProps} />, { wrapper });
        expect(screen.getByText(/no accounts/i)).toBeInTheDocument();
    });

    it('shows empty state for tasks when none', () => {
        render(<ZoomRightSidebar {...baseProps} />, { wrapper });
        expect(screen.getByText(/no tasks yet/i)).toBeInTheDocument();
    });

    it('adds a task via input + Enter', async () => {
        const user = userEvent.setup();
        render(<ZoomRightSidebar {...baseProps} />, { wrapper });
        const input = screen.getByLabelText('New task text');
        await user.type(input, 'Test task{enter}');
        expect(screen.getAllByText(/test task/i).length).toBeGreaterThan(0);
    });

    it('renders account rows when accounts provided', () => {
        const accounts: AccountLoad[] = [
            { id: 'a1', name: 'Marketing', colorHex: '#3b82f6', meetingsAtTime: 3 },
            { id: 'a2', name: 'Sales', colorHex: '#10b981', meetingsAtTime: 1 },
        ];
        render(<ZoomRightSidebar {...baseProps} accounts={accounts} />, { wrapper });
        expect(screen.getByText(/Marketing/)).toBeInTheDocument();
        expect(screen.getByText(/Sales/)).toBeInTheDocument();
    });
});
