import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/lib/api';
import { toast } from 'sonner';
import { LegacyRequestRedirect } from '../LegacyRequestRedirect';

let currentUser: { id: string; role: string } | null = { id: 'u-1', role: 'USER' };
vi.mock('@/stores/useAuth', () => ({ useAuth: () => ({ user: currentUser, isAuthenticated: Boolean(currentUser) }) }));
vi.mock('@/lib/api', () => ({ default: { get: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

afterEach(cleanup);

const OLD = '4db3ff1a-1ba2-4a64-bd77-3312f9a4dcc9';
function Where() { return <span data-testid="where">{useLocation().pathname}</span>; }
function renderAt(path: string) {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="/client/eform-access/:id" element={<LegacyRequestRedirect kind="eform" />} />
                <Route path="/hardware-requests/:id" element={<LegacyRequestRedirect kind="hardware" />} />
                <Route path="/eform/:id" element={<LegacyRequestRedirect kind="eform" />} />
                <Route path="*" element={<Where />} />
            </Routes>
        </MemoryRouter>,
    );
}

describe('LegacyRequestRedirect', () => {
    beforeEach(() => { currentUser = { id: 'u-1', role: 'USER' }; vi.mocked(api.get).mockReset(); vi.mocked(toast.error).mockReset(); });

    it('a requester following an old e-form link lands on the ticket in the client portal', async () => {
        vi.mocked(api.get).mockResolvedValue({ data: { ticketId: 't-1' } });
        renderAt(`/client/eform-access/${OLD}`);
        await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/client/tickets/t-1'));
        expect(api.get).toHaveBeenCalledWith(`/request-flow/by-legacy/eform/${OLD}`);
    });

    it('IT following an old hardware link lands on the ticket in the agent app', async () => {
        currentUser = { id: 'it-1', role: 'AGENT_OPERATIONAL_SUPPORT' };
        vi.mocked(api.get).mockResolvedValue({ data: { ticketId: 't-2' } });
        renderAt(`/hardware-requests/${OLD}`);
        await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/tickets/t-2'));
        expect(api.get).toHaveBeenCalledWith(`/request-flow/by-legacy/hardware/${OLD}`);
    });

    it('a manager opens the ticket in the staff app; the portal-agnostic /eform/:id link works too', async () => {
        currentUser = { id: 'm-1', role: 'MANAGER' };
        vi.mocked(api.get).mockResolvedValue({ data: { ticketId: 't-3' } });
        renderAt(`/eform/${OLD}`);
        await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/tickets/t-3'));
    });

    it('an old sub-page such as /hardware-requests/calendar is not an id: IT goes to Perangkat & Akses without asking the server', async () => {
        currentUser = { id: 'it-1', role: 'AGENT_OPERATIONAL_SUPPORT' };
        renderAt('/hardware-requests/calendar');
        await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/devices-access'));
        expect(api.get).not.toHaveBeenCalled();
        expect(toast.error).not.toHaveBeenCalled();
    });

    it('a requester following an old sub-page goes home quietly', async () => {
        renderAt('/hardware-requests/new');
        await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/client/my-tickets'));
        expect(api.get).not.toHaveBeenCalled();
    });

    it('an unknown request goes home with a message, not to an error page', async () => {
        vi.mocked(api.get).mockImplementation(async () => { throw { response: { status: 404 } }; });
        renderAt(`/client/eform-access/${OLD}`);
        await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/client/my-tickets'));
        expect(toast.error).toHaveBeenCalledWith('Permintaan tidak ditemukan');
    });

    it('someone who is not logged in is sent to the login page and back afterwards', async () => {
        currentUser = null;
        renderAt(`/client/eform-access/${OLD}`);
        await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/login'));
        expect(api.get).not.toHaveBeenCalled();
    });
});
