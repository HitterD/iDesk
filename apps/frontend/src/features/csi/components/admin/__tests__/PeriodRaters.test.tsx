import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CsiPeriodDetail, CsiRater } from '../../../types';
import { PeriodRaters } from '../PeriodRaters';

const fx = vi.hoisted(() => ({
    raters: [] as CsiRater[],
    save: vi.fn(),
}));

vi.mock('../../../hooks/useCsi', () => ({
    useCsiRaters: () => ({ data: fx.raters, isLoading: false }),
    useSetCsiRaters: () => ({ mutate: fx.save, isPending: false }),
}));

const rater = (id: string, name: string, siteId: string | null, siteCode: string | null): CsiRater => ({
    id, scope: 'ICT', userId: `u-${id}`, createdAt: '', updatedAt: '',
    user: {
        id: `u-${id}`, fullName: name, email: `${id}@x.id`, jobTitle: 'Staff', siteId,
        site: siteCode ? { id: siteId ?? undefined, code: siteCode, name: siteCode } : null,
    },
});

const SPJ = { id: 's-spj', code: 'SPJ', name: 'Sepanjang' };
const SKD = { id: 's-skd', code: 'SKD', name: 'Sukodono', handledBySiteId: SPJ.id };
const KRW = { id: 's-krw', code: 'KRW', name: 'Karawang' };

const period = (): CsiPeriodDetail => ({
    id: 'p1', scope: 'ICT', sites: [SPJ, SKD, KRW], title: 'CSI ICT', intro: '', thankYou: '',
    startDate: '2026-10-01', endDate: '2026-10-31', respondentMode: 'LISTED', publishStatus: 'DRAFT',
    teamEnabled: true, teamLabel: 'Tim IT Support', individualEnabled: true, slaTargetPct: 90,
    createdById: 'admin', status: 'ACTIVE', locked: false, readiness: { ready: false, checks: [] },
    raters: [], ratees: [], createdAt: '', updatedAt: '',
});

beforeEach(() => {
    fx.save.mockReset();
    fx.raters = [
        rater('r1', 'Budi Sepanjang', SPJ.id, 'SPJ'),
        rater('r2', 'Dina Sukodono', SKD.id, 'SKD'),
        rater('r3', 'Abizar Jatibarang', 's-jtb', 'JTB'),
    ];
});
afterEach(cleanup);

describe('PeriodRaters', () => {
    it('filters by site, flags out-of-period and SKD->SPJ raters, and selects only period sites cleanly', async () => {
        const actor = userEvent.setup();
        render(<PeriodRaters scope="ict" period={period()} />);
        expect(screen.getByText('Gabung SPJ')).toBeInTheDocument();
        expect(screen.getByText('Di luar site survei')).toBeInTheDocument();

        await actor.click(screen.getByRole('button', { name: 'SKD (1)' }));
        expect(screen.getByText('Dina Sukodono')).toBeInTheDocument();
        expect(screen.queryByText('Budi Sepanjang')).not.toBeInTheDocument();

        await actor.click(screen.getByRole('button', { name: 'Pilih sesuai site survei (2)' }));
        await actor.click(screen.getByRole('button', { name: 'Simpan penilai' }));
        expect(fx.save).toHaveBeenCalledWith({ userIds: ['u-r1', 'u-r2'] });
    });

    it('filters visible raters by search text and toggles only visible rows', async () => {
        const actor = userEvent.setup();
        render(<PeriodRaters scope="ict" period={period()} />);
        await actor.type(screen.getByRole('textbox', { name: 'Cari penilai' }), 'budi');
        expect(screen.getByText('Budi Sepanjang')).toBeInTheDocument();
        expect(screen.queryByText('Dina Sukodono')).not.toBeInTheDocument();

        await actor.click(screen.getByRole('checkbox', { name: 'Pilih semua yang tampil (1)' }));
        await actor.click(screen.getByRole('button', { name: 'Simpan penilai' }));
        expect(fx.save).toHaveBeenCalledWith({ userIds: ['u-r1'] });
    });
});
