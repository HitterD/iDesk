import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
    it('renders the 2 core sections (Account Load and Upcoming Meetings)', () => {
        render(<ZoomRightSidebar {...baseProps} />, { wrapper });
        expect(screen.getAllByText(/account load/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/upcoming/i).length).toBeGreaterThan(0);
    });

    it('does not render Quick Book, My Tasks, or System sections (removed for clean UI)', () => {
        render(<ZoomRightSidebar {...baseProps} />, { wrapper });
        expect(screen.queryByText(/quick book/i)).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /1 hour meeting/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /custom/i })).not.toBeInTheDocument();
        expect(screen.queryByText(/my tasks/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/^system$/i)).not.toBeInTheDocument();
    });

    it('shows empty state for accounts when none', () => {
        render(<ZoomRightSidebar {...baseProps} />, { wrapper });
        expect(screen.getByText(/no accounts/i)).toBeInTheDocument();
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

    it('highlights the account with lowest load with a Senggang badge', () => {
        const accounts: AccountLoad[] = [
            { id: 'a1', name: 'Marketing', colorHex: '#3b82f6', meetingsAtTime: 5 },
            { id: 'a2', name: 'Sales', colorHex: '#10b981', meetingsAtTime: 1 },
        ];
        render(<ZoomRightSidebar {...baseProps} accounts={accounts} />, { wrapper });
        expect(screen.getByText('Senggang')).toBeInTheDocument();
    });

    it('renders Join Zoom and Copy buttons when joinUrl is provided', () => {
        const upcomingWithJoin: ZoomBooking[] = [
            {
                id: 'b1',
                zoomAccountId: 'a1',
                title: 'Review Project',
                bookingDate: '2026-06-20',
                startTime: '10:00',
                endTime: '11:00',
                durationMinutes: 60,
                status: 'CONFIRMED',
                joinUrl: 'https://zoom.us/j/123456789',
                bookedByUserId: 'u1',
                isExternal: false,
                createdAt: '',
                updatedAt: '',
            },
        ];
        render(<ZoomRightSidebar {...baseProps} upcomingBookings={upcomingWithJoin} />, { wrapper });
        expect(screen.getByRole('button', { name: /join zoom/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /salin link zoom/i })).toBeInTheDocument();
    });
});
