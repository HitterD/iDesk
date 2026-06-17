import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useCalendarView } from '../useCalendarView';

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={['/zoom-calendar']}>{children}</MemoryRouter>
);

describe('useCalendarView accountScope', () => {
    beforeEach(() => {
        localStorage.clear();
        window.history.replaceState({}, '', '/zoom-calendar');
    });

    it('defaults account scope to "gabungan"', () => {
        const { result } = renderHook(() => useCalendarView(), { wrapper });
        expect(result.current.accountScope).toBe('gabungan');
    });

    it('setAccountScope updates the scope', () => {
        const { result } = renderHook(() => useCalendarView(), { wrapper });
        act(() => result.current.setAccountScope('acc-123'));
        expect(result.current.accountScope).toBe('acc-123');
    });

    it('persists account scope to localStorage', () => {
        const { result } = renderHook(() => useCalendarView(), { wrapper });
        act(() => result.current.setAccountScope('acc-456'));
        expect(localStorage.getItem('zoom-calendar-account')).toBe('acc-456');
    });

    it('reads initial scope from localStorage if no URL param', () => {
        localStorage.setItem('zoom-calendar-account', 'acc-stored');
        const { result } = renderHook(() => useCalendarView(), { wrapper });
        expect(result.current.accountScope).toBe('acc-stored');
    });
});
