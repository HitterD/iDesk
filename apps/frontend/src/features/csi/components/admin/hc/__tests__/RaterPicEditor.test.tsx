import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CsiPeriodDetail } from '../../../../types';
import { renderWithQuery } from '../../__tests__/renderWithQuery';
import { HcPairsPanel } from '../HcPairsPanel';

const fx = vi.hoisted(() => ({ setRater: vi.fn() }));
vi.mock('../../../../api/csiHc.api', () => ({
    CsiHcApi: {
        raters: vi.fn(async () => [{
            userId: 'u-1', nik: '00020767', fullName: 'ADITYA KURNIAWAN SUHARGO', siteCode: 'SPJ',
            division: 'Human Capital', department: 'HC Development', bagian: null,
            periodRateeIds: ['r-team', 'r-pic'],
        }]),
        setRater: fx.setRater,
    },
}));
vi.mock('../../../../api/csi.api', () => ({
    CsiApi: { userSearch: vi.fn(async () => []) },
}));

afterEach(cleanup);

const PERIOD = {
    id: 'p-1', scope: 'HC', title: 'CSI HC', intro: '', thankYou: '', startDate: '2026-01-01', endDate: '2026-12-31',
    publishStatus: 'DRAFT', status: 'DRAFT', respondentMode: 'LISTED', pairMode: 'CUSTOM',
    individualEnabled: true, teamEnabled: true, teamLabel: 'Tim HC',
    locked: false, cancelledAt: null, unitRules: null, sites: [], raters: [{ userId: 'u-1' } as any],
    ratees: [
        { id: 'r-team', kind: 'TEAM', teamId: 't-1', userId: null, picId: null, displayName: 'Tim Layanan HC', sortOrder: 0 },
        { id: 'r-pic', kind: 'PERSON', teamId: null, userId: 'u-pic', picId: 'pic-1', serviceCode: 'HCD', bagian: 'DEVELOPMENT', displayName: 'RATNA SRI TANJUNG', sortOrder: 1 },
    ],
} as unknown as CsiPeriodDetail;

describe('HcPairsPanel & RaterPicEditor subjects', () => {
    it('renders team ratee names instead of "?" and preserves team selection when saving', async () => {
        fx.setRater.mockResolvedValue([]);
        renderWithQuery(<HcPairsPanel scope="hc" period={PERIOD} />);

        expect(await screen.findByText(/2 subjek: Tim Layanan HC \(Tim\), Ratna Sri Tanjung/)).toBeInTheDocument();
        expect(screen.queryByText(/\?/)).not.toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', { name: /Ubah PIC untuk ADITYA KURNIAWAN SUHARGO/ }));
        expect(screen.getByText('Tim layanan · 1')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'Simpan' }));

        expect(fx.setRater).toHaveBeenCalledWith('hc', 'p-1', 'u-1', ['r-team', 'r-pic']);
    });
});
