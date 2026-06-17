import { useState, useCallback, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addMonths, addWeeks, addDays } from 'date-fns';

export type CalendarView = 'month' | 'week' | 'day' | 'my-bookings';

/** Special 'gabungan' value = combined/all accounts; otherwise an account id */
export type AccountScope = 'gabungan' | string;

const ACCOUNT_STORAGE_KEY = 'zoom-calendar-account';

export interface CalendarViewState {
    view: CalendarView;
    currentDate: Date;
    dateRange: { start: string; end: string };
    setView: (view: CalendarView) => void;
    navigatePrev: () => void;
    navigateNext: () => void;
    navigateToDate: (date: Date) => void;
    navigateToToday: () => void;
    accountScope: AccountScope;
    setAccountScope: (scope: AccountScope) => void;
}

function parseDateParam(param: string | null): Date {
    if (!param) return new Date();
    const parsed = new Date(param);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
}

function readInitialScope(searchParams: URLSearchParams): AccountScope {
    const fromUrl = searchParams.get('account');
    if (fromUrl) return fromUrl;
    if (typeof window !== 'undefined') {
        const stored = window.localStorage.getItem(ACCOUNT_STORAGE_KEY);
        if (stored) return stored;
    }
    return 'gabungan';
}

function getDateRange(view: CalendarView, date: Date): { start: string; end: string } {
    switch (view) {
        case 'month': {
            const monthStart = startOfMonth(date);
            const monthEnd = endOfMonth(date);
            const start = startOfWeek(monthStart, { weekStartsOn: 1 });
            const end = endOfWeek(monthEnd, { weekStartsOn: 1 });
            return {
                start: format(start, 'yyyy-MM-dd'),
                end: format(end, 'yyyy-MM-dd'),
            };
        }
        case 'week': {
            const weekStart = startOfWeek(date, { weekStartsOn: 1 });
            const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
            return {
                start: format(weekStart, 'yyyy-MM-dd'),
                end: format(weekEnd, 'yyyy-MM-dd'),
            };
        }
        case 'day': {
            const day = format(date, 'yyyy-MM-dd');
            return { start: day, end: day };
        }
        case 'my-bookings': {
            const today = format(new Date(), 'yyyy-MM-dd');
            return { start: today, end: today };
        }
    }
}

export function useCalendarView(): CalendarViewState {
    const [searchParams, setSearchParams] = useSearchParams();
    const [accountScope, setAccountScopeState] = useState<AccountScope>(() =>
        readInitialScope(searchParams),
    );

    const view = (searchParams.get('view') as CalendarView) || 'month';
    const currentDate = parseDateParam(searchParams.get('date'));

    const updateParams = useCallback((newView: CalendarView, newDate: Date) => {
        setSearchParams(
            (prev) => {
                const next = new Map(prev);
                next.set('view', newView);
                next.set('date', format(newDate, 'yyyy-MM-dd'));
                return Object.fromEntries(next);
            },
            { replace: true }
        );
    }, [setSearchParams]);

    const setView = useCallback((newView: CalendarView) => {
        updateParams(newView, currentDate);
    }, [updateParams, currentDate]);

    const navigatePrev = useCallback(() => {
        if (view === 'my-bookings') return;
        let newDate: Date;
        switch (view) {
            case 'month':
                newDate = addMonths(currentDate, -1);
                break;
            case 'week':
                newDate = addWeeks(currentDate, -1);
                break;
            case 'day':
                newDate = addDays(currentDate, -1);
                break;
        }
        updateParams(view, newDate);
    }, [view, currentDate, updateParams]);

    const navigateNext = useCallback(() => {
        if (view === 'my-bookings') return;
        let newDate: Date;
        switch (view) {
            case 'month':
                newDate = addMonths(currentDate, 1);
                break;
            case 'week':
                newDate = addWeeks(currentDate, 1);
                break;
            case 'day':
                newDate = addDays(currentDate, 1);
                break;
        }
        updateParams(view, newDate);
    }, [view, currentDate, updateParams]);

    const navigateToDate = useCallback((date: Date) => {
        updateParams(view, date);
    }, [view, updateParams]);

    const navigateToToday = useCallback(() => {
        updateParams(view, new Date());
    }, [view, updateParams]);

    const dateRange = useMemo(() => getDateRange(view, currentDate), [view, currentDate]);

    // Sync accountScope → URL params + localStorage
    useEffect(() => {
        setSearchParams(
            (prev) => {
                const next = new Map(prev);
                if (accountScope === 'gabungan') {
                    next.delete('account');
                } else {
                    next.set('account', accountScope);
                }
                return Object.fromEntries(next);
            },
            { replace: true }
        );
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(ACCOUNT_STORAGE_KEY, accountScope);
        }
    }, [accountScope, setSearchParams]);

    return {
        view,
        currentDate,
        dateRange,
        setView,
        navigatePrev,
        navigateNext,
        navigateToDate,
        navigateToToday,
        accountScope,
        setAccountScope: setAccountScopeState,
    };
}

