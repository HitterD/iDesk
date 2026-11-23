import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/lib/api';
import { DevicesAccessPage } from '../pages/DevicesAccessPage';

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('@/features/hardware-request/api/http', () => ({ hrHttp: { get: vi.fn(async () => ({ data: { success: true, data: [] } })), post: vi.fn(), patch: vi.fn() } }));

afterEach(cleanup);

function Where() { return <span data-testid="where">{useLocation().pathname}</span>; }
function renderAt(path: string) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={[path]}>
                <Routes><Route path="/devices-access/:tab?" element={<><DevicesAccessPage today="2026-11-23" /><Where /></>} /></Routes>
            </MemoryRouter>
        </QueryClientProvider>,
    );
}

describe('DevicesAccessPage', () => {
    beforeEach(() => {
        vi.mocked(api.get).mockReset();
        vi.mocked(api.get).mockImplementation(async (url: string) => {
            if (url.includes('/summary')) return { data: { activeHardware: 9, inProcurement: 3, waitingInstall: 4, doneThisMonth: 12, byPhase: [{ phase: 'PROCUREMENT', count: 3 }, { phase: 'INSTALLATION', count: 4 }] } };
            if (url.includes('/access')) return { data: { group: 'soon', counts: { soon: 0, expired: 0, active: 0, permanent: 0 }, items: [] } };
            return { data: { weekStart: '2026-11-23', events: [], load: [] } };
        });
    });

    it('is one menu with four tabs, opening on the install schedule', async () => {
        renderAt('/devices-access');
        for (const name of ['Jadwal Pemasangan', 'Masa Berlaku Akses', 'Katalog Hardware', 'Ringkasan']) expect(screen.getByRole('tab', { name })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Jadwal Pemasangan' })).toHaveAttribute('aria-selected', 'true');
    });

    it('the tab is part of the address, so a link opens that tab', async () => {
        renderAt('/devices-access/akses');
        expect(screen.getByRole('tab', { name: 'Masa Berlaku Akses' })).toHaveAttribute('aria-selected', 'true');
        fireEvent.click(screen.getByRole('tab', { name: 'Ringkasan' }));
        expect(screen.getByTestId('where')).toHaveTextContent('/devices-access/ringkasan');
    });

    it('the summary tab shows how many hardware requests are where', async () => {
        renderAt('/devices-access/ringkasan');
        expect(await screen.findByText('Request hardware aktif')).toBeInTheDocument();
        expect(await screen.findByLabelText('Request hardware aktif')).toHaveTextContent('9');
        expect(screen.getByLabelText('Selesai bulan ini')).toHaveTextContent('12');
    });

    it('an unknown tab falls back to the schedule', () => {
        renderAt('/devices-access/entah');
        expect(screen.getByRole('tab', { name: 'Jadwal Pemasangan' })).toHaveAttribute('aria-selected', 'true');
    });
});
