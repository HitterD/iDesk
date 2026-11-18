import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CsiHcRater } from '../../../../hcTypes';
import type { CsiPeriodDetail } from '../../../../types';
import { renderWithQuery } from '../../__tests__/renderWithQuery';
import { HcPairsPanel } from '../HcPairsPanel';

const fx = vi.hoisted(() => ({
    setRater: vi.fn(),
    assignRatersToPics: vi.fn(),
    raters: [] as CsiHcRater[],
}));
vi.mock('../../../../api/csiHc.api', () => ({
    CsiHcApi: {
        raters: vi.fn(async () => fx.raters),
        templates: vi.fn(async () => ({ templates: [], bundledAvailable: [] })),
        setRater: fx.setRater,
        assignRatersToPics: fx.assignRatersToPics,
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
        fx.raters = [{
            userId: 'u-1', nik: '00020767', fullName: 'ADITYA KURNIAWAN SUHARGO', siteCode: 'SPJ',
            division: 'Human Capital', department: 'HC Development', bagian: null,
            periodRateeIds: ['r-team', 'r-pic'],
        }];
        fx.setRater.mockResolvedValue([]);
        renderWithQuery(<HcPairsPanel scope="hc" period={PERIOD} />);

        expect(await screen.findByText(/2 subjek: Tim Layanan HC \(Tim\), Ratna Sri Tanjung/)).toBeInTheDocument();
        expect(screen.queryByText(/\?/)).not.toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', { name: /Ubah PIC untuk ADITYA KURNIAWAN SUHARGO/ }));
        expect(screen.getByText('Tim layanan · 1')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'Simpan' }));

        expect(fx.setRater).toHaveBeenCalledWith('hc', 'p-1', 'u-1', ['r-team', 'r-pic']);
    });

    it('when locked & active: keeps search-to-add open, locks already-rated PICs on answered raters while allowing follow-up PIC additions and bulk assign', async () => {
        fx.raters = [
            {
                userId: 'u-done', nik: '0001', fullName: 'SUDAH ISI', siteCode: 'SPJ',
                division: 'OPS', department: 'PROD', bagian: null, periodRateeIds: ['r-pic'], ratedRateeIds: ['r-pic'], answered: true,
            },
            {
                userId: 'u-wait', nik: '0002', fullName: 'BELUM ISI', siteCode: 'SPJ',
                division: 'OPS', department: 'PROD', bagian: null, periodRateeIds: ['r-pic'], ratedRateeIds: [], answered: false,
            },
        ];
        fx.setRater.mockResolvedValue(fx.raters);
        fx.assignRatersToPics.mockResolvedValue({ addedPairs: 1, addedRaters: 0, reopenedRaters: 1, skippedAnswered: 0, skippedSelf: 0 });
        renderWithQuery(<HcPairsPanel scope="hc" period={{ ...PERIOD, locked: true, publishStatus: 'PUBLISHED', status: 'ACTIVE' }} />);

        expect(await screen.findByText('Sudah mengisi')).toBeInTheDocument();
        expect(screen.getByText(/1\. Cari penilai dari master karyawan/i)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Hapus BELUM ISI/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Hapus SUDAH ISI/i })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Ubah PIC untuk BELUM ISI/i })).toBeEnabled();

        // Answered rater can open editor: already-rated PIC is disabled, newly added subject can be ticked.
        await userEvent.click(screen.getByRole('button', { name: /Ubah PIC untuk SUDAH ISI/i }));
        expect(screen.getByRole('checkbox', { name: /Ratna Sri Tanjung/i })).toBeDisabled();
        const teamBox = screen.getByRole('checkbox', { name: /Tim Layanan HC/i });
        expect(teamBox).toBeEnabled();
        await userEvent.click(teamBox);
        await userEvent.click(screen.getByRole('button', { name: 'Simpan' }));
        expect(fx.setRater).toHaveBeenCalledWith('hc', 'p-1', 'u-done', ['r-pic', 'r-team']);

        // Bulk assign / copy panel works and sends includeAnswered toggle when ticked, and offers Template lokasi option.
        await userEvent.click(screen.getByRole('button', { name: /Atur penilai PIC baru|Atur \/ Salin penilai ke PIC/i }));
        expect(screen.getByRole('button', { name: /Dari Template lokasi/i })).toBeInTheDocument();
        await userEvent.click(screen.getByRole('checkbox', { name: /Sertakan penilai yang sudah terlanjur mengisi/i }));
        await userEvent.click(screen.getByRole('button', { name: /Terapkan ke 1 PIC/i }));
        expect(fx.assignRatersToPics).toHaveBeenCalledWith('hc', 'p-1', expect.objectContaining({
            targetRateeIds: ['r-team'],
            sourceRateeId: 'r-pic',
            includeAnswered: true,
        }));
    });
});
