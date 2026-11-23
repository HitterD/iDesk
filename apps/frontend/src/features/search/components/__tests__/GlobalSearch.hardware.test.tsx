import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GlobalSearch } from '../GlobalSearch';

let role = 'USER';
vi.mock('@/stores/useAuth', () => ({ useAuth: () => ({ user: { id: 'u-1', role } }) }));
vi.mock('../../hooks/useSearch', () => ({
    useSearch: () => ({
        isLoading: false,
        data: {
            tickets: [], users: [], articles: [], total: 1,
            hardwareRequests: [{ id: '4db3ff1a-1ba2-4a64-bd77-3312f9a4dcc9', ticketNumber: 'HR-2026-0042', status: 'UNDER_REVIEW', budgetCategory: 'NON_BUDGET', title: 'Laptop Design', userName: 'Leony' }],
        },
    }),
    useSearchSuggestions: () => ({ data: [] }),
    useSavedSearches: () => ({ data: [] }),
}));

afterEach(cleanup);
function Where() { return <span data-testid="where">{useLocation().pathname}</span>; }
function renderSearch() {
    return render(
        <MemoryRouter initialEntries={['/x']}>
            <Routes><Route path="*" element={<><GlobalSearch onClose={vi.fn()} /><Where /></>} /></Routes>
        </MemoryRouter>,
    );
}

describe('GlobalSearch hardware request results', () => {
    it('a requester opens the result through the old request id, which the legacy redirect turns into the ticket', () => {
        role = 'USER';
        renderSearch();
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'laptop' } });
        fireEvent.click(screen.getByText('Laptop Design'));
        expect(screen.getByTestId('where')).toHaveTextContent('/client/hardware-requests/4db3ff1a-1ba2-4a64-bd77-3312f9a4dcc9');
    });

    it('is labelled as a ticket type, not a separate module', () => {
        role = 'AGENT';
        renderSearch();
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'laptop' } });
        expect(screen.getByText(/Hardware Request \(1\)/)).toBeInTheDocument();
        expect(screen.queryByText(/HW Requests/)).toBeNull();
    });
});
