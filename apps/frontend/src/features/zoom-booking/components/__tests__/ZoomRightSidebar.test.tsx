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
    onSync: vi.fn(),
    lastSyncAt: null as Date | null,
    userName: 'Bagas',
};

describe('ZoomRightSidebar', () => {
    it('renders the 4 remaining sections (Quick Book removed)', () => {
        render(<ZoomRightSidebar {...baseProps} />, { wrapper });
        expect(screen.getAllByText(/account load/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/upcoming/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/my tasks/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/^system$/i).length).toBeGreaterThan(0);
    });

    it('does not render Quick Book section or its buttons', () => {
        render(<ZoomRightSidebar {...baseProps} />, { wrapper });
        expect(screen.queryByText(/quick book/i)).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /1 hour meeting/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /custom/i })).not.toBeInTheDocument();
    });

    it('displays user name in system section', () => {
        render(<ZoomRightSidebar {...baseProps} userName="Bagas" />, { wrapper });
        expect(screen.getAllByText(/Bagas/).length).toBeGreaterThan(0);
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

    it('shows upcoming meeting titles when provided', () => {
        const upcoming: ZoomBooking[] = [
            {
                id: 'b1',
                zoomAccountId: 'a1',
                title: 'Weekly sync',
                bookingDate: '2026-06-20',
                startTime: '09:00',
                endTime: '10:00',
                durationMinutes: 60,
                status: 'CONFIRMED',
                zoomAccount: {
                    id: 'a1',
                    name: 'Marketing',
                    email: 'm@x.com',
                    accountType: 'MASTER',
                    displayOrder: 1,
                    colorHex: '#3b82f6',
                    isActive: true,
                    createdAt: '',
                    updatedAt: '',
                },
                bookedByUserId: 'u1',
                meeting: {
                    id: 'm1',
                    zoomBookingId: 'b1',
                    zoomMeetingId: 'z1',
                    joinUrl: 'https://x',
                    startUrl: 'https://x',
                    hostEmail: 'm@x.com',
                    createdAt: '',
                },
                isExternal: false,
                createdAt: '',
                updatedAt: '',
            },
        ];
        render(<ZoomRightSidebar {...baseProps} upcomingBookings={upcoming} />, { wrapper });
        expect(screen.getByText('Weekly sync')).toBeInTheDocument();
    });
});
