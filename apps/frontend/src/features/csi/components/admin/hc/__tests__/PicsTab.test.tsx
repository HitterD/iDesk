import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CsiPicView } from '../../../../hcTypes';
import { renderWithQuery } from '../../__tests__/renderWithQuery';
import { PicsTab } from '../PicsTab';

const fx = vi.hoisted(() => ({ update: vi.fn() }));
const PIC: CsiPicView = {
    id: 'pic-1', nik: '1001', fullName: 'RARA KURNIA MAHARANI PONGDATU', jobTitle: 'PEOPLE & ORGANIZATION DEVELOPMENT STAFF',
    serviceCode: 'HCD', serviceName: 'HC Development', serviceFunction: null, bagian: 'HC DEVELOPMENT', workLocation: 'SJA SMG',
    siteId: null, userId: null, photoUrl: null, isActive: true,
};
vi.mock('../../../../api/csiHc.api', () => ({
    CsiHcApi: {
        pics: vi.fn(async () => [PIC]),
        directory: vi.fn(async () => ({ people: 0 })),
        updatePic: fx.update,
        picAccountSuggestions: vi.fn(async () => [
            { id: 'u-1', fullName: 'Budi Santoso', email: 'budi@santos.co.id', score: 0.9, reason: 'Nama mirip' },
        ]),
    },
}));

afterEach(cleanup);

describe('PicsTab service function', () => {
    it('saves an edited service function for a PIC', async () => {
        fx.update.mockResolvedValue({ ...PIC, serviceFunction: 'People & Organization Development' });
        renderWithQuery(<PicsTab scope="hc" />);
        await userEvent.click(await screen.findByRole('button', { name: /ubah fungsi pelayanan rara/i }));
        const input = screen.getByRole('textbox', { name: /fungsi pelayanan/i });
        await userEvent.type(input, 'People & Organization Development{Enter}');
        expect(fx.update).toHaveBeenCalledWith('hc', 'pic-1', { serviceFunction: 'People & Organization Development' });
    });

    it('shows the saved service function', async () => {
        const { CsiHcApi } = await import('../../../../api/csiHc.api');
        vi.mocked(CsiHcApi.pics).mockResolvedValueOnce([{ ...PIC, serviceFunction: 'Talent Acquisition & Assessment' }]);
        renderWithQuery(<PicsTab scope="hc" />);
        expect(await screen.findByText('Talent Acquisition & Assessment')).toBeTruthy();
    });
});

describe('PicsTab PICs without bagian', () => {
    it('warns how many active PICs have no bagian and filters to them', async () => {
        const { CsiHcApi } = await import('../../../../api/csiHc.api');
        vi.mocked(CsiHcApi.pics).mockResolvedValueOnce([
            PIC,
            { ...PIC, id: 'pic-2', fullName: 'TANPA SATU', bagian: null },
            { ...PIC, id: 'pic-3', fullName: 'TANPA DUA', bagian: '  ' },
            { ...PIC, id: 'pic-4', fullName: 'NONAKTIF', bagian: null, isActive: false },
        ]);
        renderWithQuery(<PicsTab scope="hc" />);
        const alert = await screen.findByRole('status', { name: /pic belum punya bagian/i });
        expect(alert.textContent).toContain('2 PIC belum punya bagian');
        await userEvent.click(screen.getByRole('button', { name: /tampilkan pic tanpa bagian/i }));
        expect(screen.getByText('Tanpa Satu')).toBeTruthy();
        expect(screen.getByText('Tanpa Dua')).toBeTruthy();
        expect(screen.queryByText('Rara Kurnia Maharani Pongdatu')).toBeNull();
        expect(screen.getByText(/Tanpa bagian · 2/i)).toBeTruthy();
        await userEvent.click(screen.getByRole('button', { name: /tampilkan semua pic/i }));
        expect(screen.getByText('Rara Kurnia Maharani Pongdatu')).toBeTruthy();
    });

    it('shows no warning when every active PIC has a bagian', async () => {
        renderWithQuery(<PicsTab scope="hc" />);
        await screen.findByText('Rara Kurnia Maharani Pongdatu');
        expect(screen.queryByText(/belum punya bagian/i)).toBeNull();
    });
});

describe('PicsTab rename', () => {
    it('renames a PIC from its row', async () => {
        fx.update.mockResolvedValue({ ...PIC, fullName: 'Rara Pongdatu' });
        renderWithQuery(<PicsTab scope="hc" />);
        await userEvent.click(await screen.findByRole('button', { name: 'Ubah nama Rara Kurnia Maharani Pongdatu' }));
        const input = screen.getByRole('textbox', { name: 'Nama PIC' });
        await userEvent.clear(input);
        await userEvent.type(input, 'Rara Pongdatu');
        await userEvent.click(screen.getByRole('button', { name: 'Simpan nama' }));
        expect(fx.update).toHaveBeenCalledWith('hc', 'pic-1', { fullName: 'Rara Pongdatu' });
    });
});

describe('PicsTab account picker & filter', () => {
    it('picks and unlinks an iDesk account on a PIC row', async () => {
        fx.update.mockClear();
        const { CsiHcApi } = await import('../../../../api/csiHc.api');
        vi.mocked(CsiHcApi.pics).mockResolvedValueOnce([
            { ...PIC, userId: null, user: null },
        ]);
        fx.update.mockResolvedValue({ ...PIC, userId: 'u-1', user: { id: 'u-1', fullName: 'Budi Santoso', email: 'budi@santos.co.id' } });
        renderWithQuery(<PicsTab scope="hc" />);
        await userEvent.click(await screen.findByRole('button', { name: 'Pilih akun iDesk Rara Kurnia Maharani Pongdatu' }));
        await userEvent.click(await screen.findByRole('option', { name: /Budi Santoso/ }));
        expect(fx.update).toHaveBeenCalledWith('hc', 'pic-1', { userId: 'u-1' });

        vi.mocked(CsiHcApi.pics).mockResolvedValueOnce([
            { ...PIC, userId: 'u-1', user: { id: 'u-1', fullName: 'Budi Santoso', email: 'budi@santos.co.id' } },
        ]);
        cleanup();
        renderWithQuery(<PicsTab scope="hc" />);
        await userEvent.click(await screen.findByRole('button', { name: 'Ubah akun iDesk Rara Kurnia Maharani Pongdatu' }));
        await userEvent.click(await screen.findByRole('button', { name: 'Lepas akun' }));
        expect(fx.update).toHaveBeenCalledWith('hc', 'pic-1', { userId: null });
    });

    it('filters active PICs without an iDesk account', async () => {
        const { CsiHcApi } = await import('../../../../api/csiHc.api');
        vi.mocked(CsiHcApi.pics).mockResolvedValueOnce([
            { ...PIC, userId: 'u-1', user: { id: 'u-1', fullName: 'Rara', email: 'rara@santos.co.id' } },
            { ...PIC, id: 'pic-2', fullName: 'TANPA AKUN', userId: null, user: null },
        ]);
        renderWithQuery(<PicsTab scope="hc" />);
        const btn = await screen.findByRole('button', { name: /belum punya akun/i });
        expect(btn.textContent).toContain('Filter: Belum punya akun · 1');
        await userEvent.click(btn);
        expect(screen.getByText('Tanpa Akun')).toBeTruthy();
        expect(screen.queryByText('Rara Kurnia Maharani Pongdatu')).toBeNull();
    });

    it('counts unlinked PICs within the active tanpa-bagian and service filters', async () => {
        const { CsiHcApi } = await import('../../../../api/csiHc.api');
        vi.mocked(CsiHcApi.pics).mockResolvedValueOnce([
            { ...PIC, id: 'pic-a', fullName: 'ADA BAGIAN TANPA AKUN', serviceCode: 'HCD', bagian: 'HCD', userId: null, user: null },
            { ...PIC, id: 'pic-b', fullName: 'TANPA BAGIAN PUNYA AKUN', serviceCode: 'HCS', bagian: null, userId: 'u-1', user: { id: 'u-1', fullName: 'Budi', email: 'budi@santos.co.id' } },
            { ...PIC, id: 'pic-c', fullName: 'TANPA BAGIAN BELUM AKUN', serviceCode: 'HCS', bagian: null, userId: null, user: null },
        ]);
        renderWithQuery(<PicsTab scope="hc" />);
        // Globally 2 PICs lack accounts.
        expect((await screen.findByRole('button', { name: /belum punya akun/i })).textContent).toContain('Filter: Belum punya akun · 2');
        // Narrowing to PICs without bagian shows only the 1 unlinked PIC in that subset.
        await userEvent.click(screen.getByRole('button', { name: /tampilkan pic tanpa bagian/i }));
        expect(screen.getByRole('button', { name: /belum punya akun/i }).textContent).toContain('Filter: Belum punya akun · 1');
    });
});
