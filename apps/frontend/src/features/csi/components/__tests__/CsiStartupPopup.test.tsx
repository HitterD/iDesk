import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CsiActivePeriod } from '../../types';
import { CSI_POPUP_DISMISSED_KEY_PREFIX, CsiStartupPopup } from '../CsiStartupPopup';

const authState = vi.hoisted(() => ({ user: { id: 'u1', role: 'USER', fullName: 'Rina' } as { id: string; role: string; fullName: string } | null }));
const activeState = vi.hoisted(() => ({ data: undefined as CsiActivePeriod[] | undefined }));

vi.mock('@/stores/useAuth', () => ({ useAuth: () => authState }));
vi.mock('../../hooks/useCsi', () => ({ useCsiActive: () => ({ data: activeState.data }) }));

const renderPopup = (path = '/client/my-tickets') =>
    render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="*" element={<CsiStartupPopup />} />
            </Routes>
        </MemoryRouter>,
    );

describe('CsiStartupPopup', () => {
    beforeEach(() => {
        sessionStorage.clear();
        authState.user = { id: 'u1', role: 'USER', fullName: 'Rina' };
        activeState.data = undefined;
    });
    afterEach(cleanup);

    it('opens when user has an unfilled active survey and closes with X for this session', async () => {
        const user = userEvent.setup();
        activeState.data = [{ id: 'p1', scope: 'ICT', title: 'Survei Layanan ICT Q4', endDate: '2026-12-01', submitted: false }];
        const { unmount } = renderPopup();

        expect(await screen.findByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Ada Survei CSI untuk Anda')).toBeInTheDocument();
        expect(screen.getByText('Survei Layanan ICT Q4')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Tutup' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(sessionStorage.getItem(`${CSI_POPUP_DISMISSED_KEY_PREFIX}:u1`)).toBe('["p1"]');

        // Stays closed in the same session.
        unmount();
        renderPopup('/client/eform-access');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('reopens in a new session if still unfilled, and opens for a newly published period in the same session', async () => {
        activeState.data = [{ id: 'p1', scope: 'ICT', title: 'Survei Layanan ICT Q4', submitted: false }];
        sessionStorage.setItem(`${CSI_POPUP_DISMISSED_KEY_PREFIX}:u1`, JSON.stringify(['p1']));

        // Still dismissed for p1 alone.
        const view = renderPopup();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        // A new period p2 appears in the same session: opens again.
        activeState.data = [
            { id: 'p1', scope: 'ICT', title: 'Survei Layanan ICT Q4', submitted: false },
            { id: 'p2', scope: 'HC', title: 'Survei Layanan HC Q4', submitted: false },
        ];
        view.rerender(
            <MemoryRouter initialEntries={['/client/my-tickets']}>
                <Routes><Route path="*" element={<CsiStartupPopup />} /></Routes>
            </MemoryRouter>,
        );
        expect(await screen.findByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('2 Survei CSI Belum Diisi')).toBeInTheDocument();

        // New session (storage cleared) with unfilled survey opens again.
        cleanup();
        sessionStorage.clear();
        activeState.data = [{ id: 'p1', scope: 'ICT', title: 'Survei Layanan ICT Q4', submitted: false }];
        renderPopup();
        expect(await screen.findByRole('dialog')).toBeInTheDocument();
    });

    it('stays hidden when all surveys are submitted or when already on a CSI route', () => {
        activeState.data = [{ id: 'p1', scope: 'ICT', title: 'Survei ICT', submitted: true }];
        renderPopup('/client/my-tickets');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        cleanup();
        activeState.data = [{ id: 'p1', scope: 'ICT', title: 'Survei ICT', submitted: false }];
        renderPopup('/client/csi');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        cleanup();
        renderPopup('/client/csi/p1');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});
