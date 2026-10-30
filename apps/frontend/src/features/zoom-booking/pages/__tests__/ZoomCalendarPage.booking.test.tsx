import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ZoomCalendarPage } from '../ZoomCalendarPage';

const renderPage = (url = '/zoom-calendar') => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={[url]}>
                <ZoomCalendarPage />
            </MemoryRouter>
        </QueryClientProvider>,
    );
};

const mocks = vi.hoisted(() => ({
    hasAccess: true,
    accountScope: 'gabungan',
    setView: vi.fn(),
    navigatePrev: vi.fn(),
    navigateNext: vi.fn(),
    navigateToDate: vi.fn(),
    navigateToToday: vi.fn(),
    setAccountScope: vi.fn(),
    syncMeetings: vi.fn(),
    calendarAccountIds: [] as Array<string | undefined>,
}));

vi.mock('@/hooks/usePermissions', () => ({
    useHasPageAccess: () => ({ hasAccess: mocks.hasAccess }),
}));

vi.mock('../../hooks', async () => {
    const actual = await vi.importActual<typeof import('../../hooks')>('../../hooks');

    return {
        ...actual,
        useMyUpcomingBookings: () => ({ data: [] }),
        useZoomAccounts: () => ({
            data: [
                {
                    id: 'zoom-1',
                    name: 'Zoom Utama',
                    email: 'zoom@example.com',
                    colorHex: '#3b82f6',
                    isActive: true,
                },
                {
                    id: 'zoom-2',
                    name: 'Zoom Cadangan',
                    email: 'zoom2@example.com',
                    colorHex: '#10b981',
                    isActive: true,
                },
            ],
            isLoading: false,
        }),
        useZoomCalendar: (zoomAccountId: string | undefined) => {
            mocks.calendarAccountIds.push(zoomAccountId);
            return { data: [], isLoading: false };
        },
        useZoomMergedCalendar: () => ({ data: [], isLoading: false }),
        useZoomSocket: () => ({ isConnected: true, subscribeToAccount: vi.fn(), unsubscribeFromAccount: vi.fn() }),
        useSyncMeetings: () => ({ mutateAsync: mocks.syncMeetings }),
        usePublicZoomSettings: () => ({
            data: {
                slotStartTime: '08:00',
                slotEndTime: '18:00',
                slotIntervalMinutes: 30,
            },
        }),
        useCalendarView: () => ({
            view: 'week' as const,
            currentDate: new Date('2026-06-18T09:00:00'),
            dateRange: { start: '2026-06-15', end: '2026-06-21' },
            setView: mocks.setView,
            navigatePrev: mocks.navigatePrev,
            navigateNext: mocks.navigateNext,
            navigateToDate: mocks.navigateToDate,
            navigateToToday: mocks.navigateToToday,
            accountScope: mocks.accountScope as 'gabungan' | string,
            setAccountScope: mocks.setAccountScope,
        }),
    };
});

vi.mock('../../components/ZoomBookingModal', () => ({
    ZoomBookingModal: ({ open, mode, zoomAccountId, preselectedDate, preselectedTime, bookingId }: {
        open: boolean;
        mode: string;
        zoomAccountId?: string;
        preselectedDate?: string;
        preselectedTime?: string;
        bookingId?: string;
    }) => open ? (
        <div data-testid="zoom-booking-modal">
            {mode}:{zoomAccountId}:{preselectedDate}:{preselectedTime}:{bookingId}
        </div>
    ) : null,
}));

describe('ZoomCalendarPage booking actions', () => {
    beforeEach(() => {
        mocks.hasAccess = true;
        mocks.accountScope = 'gabungan';
        mocks.calendarAccountIds = [];
        vi.clearAllMocks();
    });

    it('opens the centered booking modal when Book Meeting is clicked', async () => {
        const user = userEvent.setup();

        renderPage();

        await user.click(screen.getByRole('button', { name: /book meeting/i }));

        expect(screen.getByTestId('zoom-booking-modal')).toHaveTextContent(
            /booking:zoom-1:2026-06-18:\d{2}:00/
        );
    });

    it('uses selected account scope when opening booking from Gabungan switcher state', async () => {
        const user = userEvent.setup();
        mocks.accountScope = 'zoom-2';

        renderPage();

        await user.click(screen.getByRole('button', { name: /book meeting/i }));

        expect(screen.getByTestId('zoom-booking-modal')).toHaveTextContent(
            /booking:zoom-2:2026-06-18:\d{2}:00/
        );
    });

    it('fetches calendar data for selected account scope', () => {
        mocks.accountScope = 'zoom-2';

        renderPage();

        expect(mocks.calendarAccountIds).toContain('zoom-2');
    });

    it('hides Book Meeting button when user lacks booking permission', () => {
        mocks.hasAccess = false;

        renderPage();

        expect(screen.queryByRole('button', { name: /book meeting/i })).not.toBeInTheDocument();
        // Subbar no longer exposes quick book entry points
        expect(screen.queryByRole('button', { name: /1 hour/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /custom/i })).not.toBeInTheDocument();
    });

    it('opens the booking detail from a ?booking= deep link (e.g. iPop calendar)', () => {
        renderPage('/zoom-calendar?booking=b-42');

        expect(screen.getByTestId('zoom-booking-modal')).toHaveTextContent(/^detail:.*:b-42$/);
    });
});

describe('ZoomCalendarPage settings entry', () => {
    it('shows the Zoom settings button only to ADMIN', async () => {
        const { useAuth } = await import('@/stores/useAuth');
        useAuth.setState({ user: { id: 'u', fullName: 'Agent', role: 'AGENT' } as never });
        const { unmount } = renderPage();
        expect(screen.queryByRole('button', { name: 'Pengaturan Zoom' })).not.toBeInTheDocument();
        unmount();

        useAuth.setState({ user: { id: 'a', fullName: 'Admin', role: 'ADMIN' } as never });
        renderPage();
        expect(screen.getByRole('button', { name: 'Pengaturan Zoom' })).toBeInTheDocument();
    });
});
