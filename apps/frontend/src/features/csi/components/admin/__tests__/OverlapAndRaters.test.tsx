import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CsiPeriodOverlap, CsiRater } from '../../../types';
import { nextFreeRange, OverlapNotice } from '../OverlapNotice';
import { RatersTab } from '../RatersTab';
import { parseRaterKeys } from '../raters/raterImport';

const fx = vi.hoisted(() => ({
    overlaps: [] as CsiPeriodOverlap[],
    raters: [] as CsiRater[],
    preview: null as null | { total: number; alreadyRegistered: number; toAdd: number; sample: string[] },
    addGroup: vi.fn(), importRaters: vi.fn(), removeRaters: vi.fn(),
}));
vi.mock('@/hooks/useDebounce', () => ({ useDebounce: (value: unknown) => value }));
vi.mock('@/components/site/useActiveSites', () => ({ useActiveSites: () => ({ data: [{ id: 's1', code: 'SPJ', name: 'Sepanjang' }] }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));
vi.mock('../../../hooks/useCsi', () => ({
    useCsiPeriodOverlaps: () => ({ data: fx.overlaps }),
    useCsiRaters: () => ({ data: fx.raters, isLoading: false, isError: false, refetch: vi.fn() }),
    useRemoveCsiRaters: () => ({ mutate: fx.removeRaters, isPending: false }),
    useCsiRaterDepartments: () => ({ data: [{ id: 'd1', name: 'HC SERVICES', userCount: 4 }] }),
    useCsiRaterGroupPreview: () => ({ data: fx.preview, isFetching: false }),
    useAddCsiRaterGroup: () => ({ mutate: fx.addGroup, isPending: false }),
    useImportCsiRaters: () => ({ mutate: fx.importRaters, isPending: false }),
    useAddCsiRaters: () => ({ mutate: vi.fn(), isPending: false }),
    useCsiUserSearch: () => ({ data: [], isFetching: false }),
}));

const rater = (id: string, name: string, site: string | null): CsiRater => ({
    id, scope: 'ICT', userId: `u-${id}`, createdAt: '', updatedAt: '',
    user: { id: `u-${id}`, fullName: name, email: `${id}@x.id`, jobTitle: null, site: site ? { code: site, name: site === 'SPJ' ? 'Sepanjang' : 'Karawang' } : null },
});

beforeEach(() => {
    fx.overlaps = []; fx.raters = []; fx.preview = null;
    fx.addGroup.mockReset(); fx.importRaters.mockReset(); fx.removeRaters.mockReset();
});
afterEach(cleanup);

describe('OverlapNotice', () => {
    const clash: CsiPeriodOverlap = { id: 'p1', title: 'CSI ICT', startDate: '2026-11-04', endDate: '2026-11-06', sites: [{ id: 's1', code: 'SPJ', name: 'Sepanjang' }] };

    it('suggests the same length right after the last clashing survey', () => {
        expect(nextFreeRange('2026-11-04', '2026-11-06', [clash])).toEqual({ startDate: '2026-11-07', endDate: '2026-11-09' });
        expect(nextFreeRange('2026-11-04', '2026-11-06', [])).toBeNull();
    });

    it('names the clashing survey, keeps draft saving possible and applies the suggested dates', async () => {
        fx.overlaps = [clash];
        const onUseDates = vi.fn();
        render(<OverlapNotice scope="ict" siteIds={['s1']} startDate="2026-11-04" endDate="2026-11-06" onUseDates={onUseDates} />);
        const alert = screen.getByRole('alert');
        expect(alert).toHaveTextContent('"CSI ICT" (SPJ, 04 Nov 2026 – 06 Nov 2026)');
        expect(alert).toHaveTextContent('tetap bisa disimpan sebagai draft');
        await userEvent.setup().click(within(alert).getByRole('button', { name: /^Pakai 07 Nov 2026/ }));
        expect(onUseDates).toHaveBeenCalledWith({ startDate: '2026-11-07', endDate: '2026-11-09' });
    });

    it('stays silent without a clash', () => {
        render(<OverlapNotice scope="ict" siteIds={['s1']} startDate="2026-12-01" endDate="2026-12-03" onUseDates={vi.fn()} />);
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
});

describe('parseRaterKeys', () => {
    it('splits lines, commas and tabs, drops headers and duplicates', () => {
        expect(parseRaterKeys('Email\nandi@x.id, budi@x.id\n\n"00012"\tandi@x.id')).toEqual(['andi@x.id', 'budi@x.id', '00012']);
    });
});

describe('RatersTab', () => {
    it('lists raters grouped per site with a per-site count, and removes several at once', async () => {
        fx.raters = [rater('a', 'Andi', 'SPJ'), rater('b', 'Budi', 'SPJ'), rater('c', 'Citra', 'KRW')];
        const actor = userEvent.setup();
        render(<RatersTab scope="ict" />);
        expect(screen.getByRole('heading', { name: 'Penilai terdaftar · 3' })).toBeInTheDocument();
        const spj = screen.getByRole('region', { name: 'Penilai Sepanjang' });
        await actor.click(within(spj).getByRole('checkbox', { name: 'Pilih semua penilai Sepanjang' }));
        await actor.click(screen.getByRole('button', { name: 'Hapus 2 terpilih' }));
        await actor.click(screen.getByRole('button', { name: 'Hapus' }));
        expect(fx.removeRaters).toHaveBeenCalledWith(['a', 'b'], expect.anything());
    });

    it('adds a whole site after previewing how many people it covers', async () => {
        fx.preview = { total: 23, alreadyRegistered: 2, toAdd: 21, sample: ['Bingson', 'Ridho'] };
        render(<RatersTab scope="ict" />);
        expect(screen.getByText(/Pilih site atau departemen/)).toBeInTheDocument();
    });

    it('import checks the pasted list before adding', async () => {
        const actor = userEvent.setup();
        render(<RatersTab scope="ict" />);
        await actor.click(screen.getByRole('button', { name: 'Impor daftar' }));
        await actor.type(screen.getByRole('textbox', { name: /Tempel email atau NIK/ }), 'andi@x.id{enter}tidak@x.id');
        await actor.click(screen.getByRole('button', { name: 'Cek 2 baris' }));
        expect(fx.importRaters).toHaveBeenCalledWith({ keys: ['andi@x.id', 'tidak@x.id'], commit: false }, expect.anything());
    });
});
