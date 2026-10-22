import { act, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { InstallationCalendarPage } from '../../components/calendar/InstallationCalendarPage';
import { fetchCalendarEvents } from '../../api/installation.api';

vi.mock('../../api/installation.api', () => ({
    fetchCalendarEvents: vi.fn(async () => []),
    fetchMyTodaySchedules: vi.fn(async () => []),
    fetchUnscheduledRequests: vi.fn(async () => []),
    rescheduleSchedule: vi.fn(),
}));
vi.mock('../../hooks/usePermissions', () => ({ usePermissions: () => ({ isIctRole: true, isIctStaff: true }) }));
vi.mock('../../components/calendar/TechnicianFilter', () => ({ TechnicianPop: () => null }));
vi.mock('../../components/calendar/AgendaBottomDrawer', () => ({ AgendaBottomDrawer: () => null }));
vi.mock('../../components/calendar/RescheduleConfirmModal', () => ({ RescheduleConfirmModal: () => null }));

const localRange = (day: number) => ({
    from: new Date(2026, 9, day).toISOString(),
    to: new Date(2026, 9, day + 6, 23, 59, 59, 999).toISOString(),
    technicianIds: [],
});
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

it.each(['midnight', 'focus', 'visibilitychange'])('refreshes the actual page projection query on %s', async (wake) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 21, 23, 59, 59));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    const view = render(<QueryClientProvider client={client}><MemoryRouter><InstallationCalendarPage /></MemoryRouter></QueryClientProvider>);
    await act(async () => {});
    expect(fetchCalendarEvents).toHaveBeenCalledWith(localRange(21));
    await act(async () => {
        if (wake === 'midnight') vi.advanceTimersByTime(1000);
        else {
            vi.setSystemTime(new Date(2026, 9, 22, 8));
            (wake === 'focus' ? window : document).dispatchEvent(new Event(wake));
        }
    });
    expect(fetchCalendarEvents).toHaveBeenCalledWith(localRange(22));
    expect(screen.getByRole('region', { name: 'Proyeksi 7 hari ke depan' })).toBeInTheDocument();
    view.unmount();
    client.clear();
});
