import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CsiAssignments, CsiPeriodDetail, CsiPeriodRatee } from '../../../../types';
import { AssignmentMatrix } from '../AssignmentMatrix';

const fx = vi.hoisted(() => ({
    view: null as unknown as CsiAssignments,
    users: [] as Array<{ id: string; fullName: string; email: string; jobTitle: null; siteId: string; site: { code: string; name: string } }>,
    save: vi.fn(), saveTemplate: vi.fn(), applyTemplate: vi.fn(), setRaters: vi.fn(), updateRatee: vi.fn(),
}));

vi.mock('../../../../hooks/useCsi', () => ({
    useCsiAssignments: () => ({ data: fx.view, isLoading: false, isError: false, refetch: vi.fn() }),
    useSaveCsiAssignments: () => ({ mutate: fx.save, isPending: false }),
    useSaveCsiTemplate: () => ({ mutate: fx.saveTemplate, isPending: false }),
    useApplyCsiAssignmentTemplate: () => ({ mutate: fx.applyTemplate, isPending: false }),
    useSetCsiRaters: () => ({ mutate: fx.setRaters, isPending: false }),
    useCsiUserSearch: () => ({ data: fx.users, isFetching: false }),
    useUpdateCsiPeriodRatee: () => ({ mutate: fx.updateRatee, isPending: false }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));

const STAMP = { createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' };
const ratee = (id: string, userId: string | null, over: Partial<CsiPeriodRatee> = {}): CsiPeriodRatee => ({
    id, periodId: 'p1', kind: userId ? 'PERSON' : 'TEAM', userId, displayName: id, jobTitle: null, sortOrder: 0, dimensions: [], ...STAMP, ...over,
});
const period = (over: Partial<CsiPeriodDetail> = {}): CsiPeriodDetail => ({
    id: 'p1', scope: 'ICT', teamEnabled: true, teamLabel: '', individualEnabled: true, slaTargetPct: 80, title: 'Survei Q4', intro: '', thankYou: '',
    startDate: '2026-10-01', endDate: '2026-10-31', respondentMode: 'LISTED', createdById: 'a1', publishStatus: 'DRAFT', status: 'ACTIVE', locked: false,
    sites: [{ id: 's1', code: 'SPJ', name: 'Sepanjang' }, { id: 's2', code: 'KRW', name: 'Karawang' }],
    readiness: { ready: true, checks: [] }, raters: [], ...STAMP,
    ratees: [ratee('t1', null), ratee('e1', 'u1', { tagline: 'Khusus' }), ratee('e3', 'u9')],
    ...over,
});
const view = (): CsiAssignments => ({
    raters: [
        { periodRaterId: 'r1', userId: 'u1', fullName: 'Andi', department: 'ICT', siteId: 's1' },
        { periodRaterId: 'r2', userId: 'u2', fullName: 'Budi', department: 'Finance', siteId: 's1' },
        { periodRaterId: 'r3', userId: 'u3', fullName: 'Citra', department: 'QC', siteId: 's2' },
    ],
    ratees: [
        { periodRateeId: 't1', kind: 'TEAM', name: 'Tim SPJ', siteId: 's1', photoUrl: null },
        { periodRateeId: 'e1', kind: 'PERSON', name: 'Andi', siteId: 's1', photoUrl: null },
        { periodRateeId: 'e3', kind: 'PERSON', name: 'Dedi', siteId: 's2', photoUrl: null },
    ],
    pairs: [{ periodRaterId: 'r2', periodRateeId: 'e1' }],
});

const renderMatrix = (over: Partial<CsiPeriodDetail> = {}) => render(<AssignmentMatrix scope="ict" period={period(over)} />);
const cell = (rater: string, subject: string) => screen.getByRole('checkbox', { name: `${rater} menilai ${subject}` });

beforeEach(() => { vi.clearAllMocks(); fx.view = view(); fx.users = []; });
afterEach(cleanup);

describe('AssignmentMatrix', () => {
    it('self cell is not clickable', () => {
        renderMatrix();
        expect(screen.queryByRole('checkbox', { name: 'Andi menilai Andi' })).not.toBeInTheDocument();
        expect(screen.getByTitle('Tidak bisa menilai diri sendiri')).toBeInTheDocument();
        expect(cell('Budi', 'Andi')).toHaveAttribute('aria-checked', 'true');
        expect(cell('Citra', 'Andi')).toHaveAttribute('aria-checked', 'false');
    });

    it('clicking a rater name toggles the whole row', async () => {
        const actor = userEvent.setup();
        renderMatrix();
        await actor.click(screen.getByRole('button', { name: /^Pilih baris Andi/ }));
        expect(cell('Andi', 'Tim SPJ')).toHaveAttribute('aria-checked', 'true');
        expect(cell('Andi', 'Dedi')).toHaveAttribute('aria-checked', 'true');
        await actor.click(screen.getByRole('button', { name: /^Pilih baris Andi/ }));
        expect(cell('Andi', 'Tim SPJ')).toHaveAttribute('aria-checked', 'false');
    });

    it('Simpan sends the pairs', async () => {
        const actor = userEvent.setup();
        renderMatrix();
        const save = screen.getByRole('button', { name: 'Simpan' });
        expect(save).toBeDisabled();
        await actor.click(cell('Citra', 'Andi'));
        expect(save).toBeEnabled();
        await actor.click(save);
        expect(fx.save).toHaveBeenCalledWith(
            [{ periodRaterId: 'r2', periodRateeId: 'e1' }, { periodRaterId: 'r3', periodRateeId: 'e1' }], expect.anything());
    });

    it('search filters raters by department', async () => {
        const actor = userEvent.setup();
        renderMatrix();
        await actor.type(screen.getByRole('searchbox', { name: 'Cari penilai' }), 'finance');
        expect(screen.getByRole('button', { name: /^Pilih baris Budi/ })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /^Pilih baris Andi/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /^Pilih baris Citra/ })).not.toBeInTheDocument();
    });

    it('stat cards count pairs and cross-site pairs; site button fills its own site', async () => {
        const actor = userEvent.setup();
        renderMatrix();
        await actor.click(screen.getByRole('button', { name: 'Penilai KRW' }));
        expect(cell('Citra', 'Dedi')).toHaveAttribute('aria-checked', 'true');
        await actor.click(cell('Citra', 'Andi'));
        const cross = screen.getByRole('group', { name: 'Lintas site' });
        expect(within(cross).getByText('1')).toBeInTheDocument();
        expect(within(screen.getByRole('group', { name: 'Pasangan penilaian' })).getByText('3')).toBeInTheDocument();
    });

    it('shows the period override pill and opens the period edit sheet', async () => {
        const actor = userEvent.setup();
        renderMatrix();
        expect(screen.getAllByText('Khusus periode')).toHaveLength(1);
        await actor.click(screen.getByRole('button', { name: 'Ubah tampilan Andi untuk periode ini' }));
        const sheet = await screen.findByRole('dialog');
        expect(within(sheet).queryByLabelText('Pilih foto')).not.toBeInTheDocument();
        await actor.click(within(sheet).getByRole('button', { name: 'Simpan' }));
        expect(fx.updateRatee).toHaveBeenCalledWith({ periodRateeId: 'e1', payload: { tagline: 'Khusus' } }, expect.anything());
    });

    it('OPEN mode: info callout and a read-only matrix', () => {
        renderMatrix({ respondentMode: 'OPEN' });
        expect(screen.getByText(/Mode terbuka: semua user aktif di site dapat mengisi dan menilai semua subjek\./)).toBeInTheDocument();
        expect(cell('Citra', 'Andi')).toBeDisabled();
        expect(screen.queryByRole('button', { name: 'Simpan' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Isi otomatis/ })).not.toBeInTheDocument();
    });

    it('search offers active users who are not raters yet and adds them', async () => {
        const actor = userEvent.setup();
        fx.users = [
            { id: 'u2', fullName: 'Budi', email: 'b@x', jobTitle: null, siteId: 's1', site: { code: 'SPJ', name: 'Sepanjang' } },
            { id: 'u7', fullName: 'Budiman', email: 'bm@x', jobTitle: null, siteId: 's2', site: { code: 'KRW', name: 'Karawang' } },
        ];
        renderMatrix();
        await actor.type(screen.getByRole('searchbox', { name: 'Cari penilai' }), 'budi');
        await actor.click(await screen.findByRole('button', { name: 'Tambah Budiman sebagai penilai' }));
        expect(screen.queryByRole('button', { name: 'Tambah Budi sebagai penilai' })).not.toBeInTheDocument();
        expect(fx.setRaters).toHaveBeenCalledWith({ userIds: ['u1', 'u2', 'u3', 'u7'] });
    });
});
