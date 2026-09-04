import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ZoomWeekView } from '../ZoomWeekView';
import type { CalendarDay } from '../../types';

vi.mock('../../hooks/useZoomSettings', () => ({
    useZoomSettings: () => ({
        data: { workingDays: [1, 2, 3, 4, 5] },
        isLoading: false,
    }),
    isWorkingDay: () => true,
}));

function createTestQueryClient() {
    return new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
}

describe('ZoomWeekView', () => {
    const mockAccounts = [
        { id: 'acc-1', name: 'Zoom Admin 1', colorHex: '#3b82f6', isOperational: true, isActive: true },
        { id: 'acc-2', name: 'Zoom Admin 2', colorHex: '#10b981', isOperational: true, isActive: true },
    ];

    const mockCalendar: CalendarDay[] = [
        {
            date: '2026-09-03',
            dayOfWeek: 4,
            isWorkingDay: true,
            isBlocked: false,
            slots: [
                {
                    date: '2026-09-03',
                    time: '08:00',
                    endTime: '08:30',
                    status: 'booked',
                    booking: {
                        id: 'b-1',
                        title: 'Team Standup',
                        bookedBy: 'John Doe',
                        durationMinutes: 30,
                        startTime: '08:00',
                        endTime: '08:30',
                    },
                },
                {
                    date: '2026-09-03',
                    time: '08:30',
                    endTime: '09:00',
                    status: 'available',
                },
            ],
        },
    ];

    const timeLabels = ['08:00', '08:30', '09:00', '09:30', '10:00'];

    it('renders week view with toolbar and day headers', () => {
        const queryClient = createTestQueryClient();
        render(
            <QueryClientProvider client={queryClient}>
                <ZoomWeekView
                    currentDate={new Date('2026-09-03')}
                    calendar={mockCalendar}
                    timeLabels={timeLabels}
                    currentTime={new Date('2026-09-03T08:15:00')}
                    canBook={true}
                    accounts={mockAccounts as any}
                    onSlotClick={vi.fn()}
                    onBookingClick={vi.fn()}
                />
            </QueryClientProvider>
        );

        expect(screen.getByTestId('zoom-week-view')).toBeInTheDocument();
        expect(screen.getByText('Hanya Meeting Saya')).toBeInTheDocument();
        expect(screen.getByText('Team Standup')).toBeInTheDocument();
    });

    it('allows toggling Hanya Meeting Saya filter', () => {
        const queryClient = createTestQueryClient();
        render(
            <QueryClientProvider client={queryClient}>
                <ZoomWeekView
                    currentDate={new Date('2026-09-03')}
                    calendar={mockCalendar}
                    timeLabels={timeLabels}
                    currentTime={new Date('2026-09-03T08:15:00')}
                    canBook={true}
                    accounts={mockAccounts as any}
                    onSlotClick={vi.fn()}
                    onBookingClick={vi.fn()}
                />
            </QueryClientProvider>
        );

        const filterBtn = screen.getByText('Hanya Meeting Saya');
        fireEvent.click(filterBtn);
        // Meeting is not user's booking, so it should be filtered out
        expect(screen.queryByText('Team Standup')).not.toBeInTheDocument();
    });

    it('calls onBookingClick when a card is clicked', () => {
        const onBookingClick = vi.fn();
        const queryClient = createTestQueryClient();
        render(
            <QueryClientProvider client={queryClient}>
                <ZoomWeekView
                    currentDate={new Date('2026-09-03')}
                    calendar={mockCalendar}
                    timeLabels={timeLabels}
                    currentTime={new Date('2026-09-03T08:15:00')}
                    canBook={true}
                    accounts={mockAccounts as any}
                    onSlotClick={vi.fn()}
                    onBookingClick={onBookingClick}
                />
            </QueryClientProvider>
        );

        const card = screen.getByText('Team Standup');
        fireEvent.click(card);
        expect(onBookingClick).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'b-1', title: 'Team Standup' })
        );
    });
});
