import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ZoomDayView } from '../ZoomDayView';
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

describe('ZoomDayView', () => {
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
                    time: '09:00',
                    endTime: '09:30',
                    status: 'booked',
                    booking: {
                        id: 'b-day-1',
                        title: 'Executive Sync',
                        bookedBy: 'Alice',
                        durationMinutes: 30,
                        startTime: '09:00',
                        endTime: '09:30',
                        zoomAccountId: 'acc-1',
                        zoomAccount: { id: 'acc-1', name: 'Zoom Admin 1', colorHex: '#3b82f6' },
                    },
                },
            ],
        },
    ];

    const timeLabels = ['08:00', '08:30', '09:00', '09:30', '10:00'];

    it('renders multi-account Resource Grid when multiple accounts provided', () => {
        const queryClient = createTestQueryClient();
        render(
            <QueryClientProvider client={queryClient}>
                <ZoomDayView
                    currentDate={new Date('2026-09-03')}
                    calendar={mockCalendar}
                    timeLabels={timeLabels}
                    currentTime={new Date('2026-09-03T09:15:00')}
                    canBook={true}
                    accounts={mockAccounts as any}
                    onSlotClick={vi.fn()}
                    onBookingClick={vi.fn()}
                    onNavigateDay={vi.fn()}
                />
            </QueryClientProvider>
        );

        // Account headers
        expect(screen.getByText('Zoom Admin 1')).toBeInTheDocument();
        expect(screen.getByText('Zoom Admin 2')).toBeInTheDocument();
        expect(screen.getByText('Executive Sync')).toBeInTheDocument();
    });

    it('triggers onNavigateDay when navigation arrows are clicked', () => {
        const onNavigateDay = vi.fn();
        const queryClient = createTestQueryClient();
        render(
            <QueryClientProvider client={queryClient}>
                <ZoomDayView
                    currentDate={new Date('2026-09-03')}
                    calendar={mockCalendar}
                    timeLabels={timeLabels}
                    currentTime={new Date('2026-09-03T09:15:00')}
                    canBook={true}
                    accounts={mockAccounts as any}
                    onSlotClick={vi.fn()}
                    onBookingClick={vi.fn()}
                    onNavigateDay={onNavigateDay}
                />
            </QueryClientProvider>
        );

        const prevBtn = screen.getByTitle('Hari sebelumnya');
        fireEvent.click(prevBtn);
        expect(onNavigateDay).toHaveBeenCalledWith(-1);

        const nextBtn = screen.getByTitle('Hari berikutnya');
        fireEvent.click(nextBtn);
        expect(onNavigateDay).toHaveBeenCalledWith(1);
    });

    it('calls onSlotClick with account ID when a cell is clicked', () => {
        const onSlotClick = vi.fn();
        const queryClient = createTestQueryClient();
        render(
            <QueryClientProvider client={queryClient}>
                <ZoomDayView
                    currentDate={new Date('2026-09-03')}
                    calendar={mockCalendar}
                    timeLabels={timeLabels}
                    currentTime={new Date('2026-09-03T09:15:00')}
                    canBook={true}
                    accounts={mockAccounts as any}
                    onSlotClick={onSlotClick}
                    onBookingClick={vi.fn()}
                    onNavigateDay={vi.fn()}
                />
            </QueryClientProvider>
        );

        // Click slot
        const bookButtons = screen.getAllByText(/Book 08:00/);
        expect(bookButtons.length).toBeGreaterThan(0);
        fireEvent.click(bookButtons[0]);
        expect(onSlotClick).toHaveBeenCalledWith(
            expect.objectContaining({ date: '2026-09-03' }),
            0,
            'acc-1'
        );
    });
});
