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
