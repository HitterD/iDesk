import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useOperationalDay } from '../../components/calendar/InstallationCalendarPage';

afterEach(() => { vi.useRealTimers(); });

it('updates at local midnight and removes the boundary timer on unmount', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 21, 23, 59, 59));
    const { result, unmount } = renderHook(() => useOperationalDay());
    expect(result.current.getDate()).toBe(21);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current.getDate()).toBe(22);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
});

it.each(['focus', 'visibilitychange'])('refreshes on %s after a suspended tab wakes', (event) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 21, 12));
    const { result, unmount } = renderHook(() => useOperationalDay());
    vi.setSystemTime(new Date(2026, 9, 23, 8));
    act(() => { (event === 'focus' ? window : document).dispatchEvent(new Event(event)); });
    expect(result.current.getDate()).toBe(23);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
});
