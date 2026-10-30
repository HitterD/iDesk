import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RateeAssignment } from '../RateeAssignment';
import type { CsiDimension, CsiPeriodDetail, CsiUserSearchResult } from '../../../types';

const hooks = vi.hoisted(() => ({
    mutate: vi.fn(),
    dimensions: [] as CsiDimension[],
    users: [] as CsiUserSearchResult[],
}));

vi.mock('../../../hooks/useCsi', () => ({
    useCsiDimensions: () => ({ data: hooks.dimensions, isLoading: false }),
    useCsiUserSearch: () => ({ data: hooks.users, isLoading: false, isFetching: false }),
    useSetCsiRatees: () => ({ mutate: hooks.mutate, isPending: false }),
}));

const STAMP = { createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' };
const dimension = (id: string, name: string, sortOrder: number): CsiDimension => ({
    id, name, sortOrder, scope: 'ICT', isActive: true, description: null, type: 'STAR', required: true, options: [], ...STAMP,
});
const user = (id: string, fullName: string, jobTitle: string): CsiUserSearchResult => ({
    id, fullName, jobTitle, email: `${id}@idesk.test`, siteId: 's1', site: { code: 'SPJ', name: 'Sidoarjo' },
});

const period = (locked: boolean, over: Partial<CsiPeriodDetail> = {}): CsiPeriodDetail => ({
    id: 'p1', scope: 'ICT', teamEnabled: true, teamLabel: 'Tim IT Support', individualEnabled: true, slaTargetPct: 80, title: 'Survei Q4', intro: '', thankYou: '',
    startDate: '2026-10-01', endDate: '2026-10-31', respondentMode: 'OPEN', createdById: 'a1',
    publishStatus: 'PUBLISHED', readiness: { ready: false, checks: [] },
    sites: [{ id: 's1', code: 'SPJ', name: 'Sidoarjo' }], status: 'ACTIVE', locked, ratees: [], raters: [], ...STAMP, ...over,
});

const pickUsers = async (actor: ReturnType<typeof userEvent.setup>, names: string[]) => {
    await actor.click(screen.getByRole('button', { name: 'Pilih orang yang dinilai' }));
    for (const name of names) await actor.click(await screen.findByRole('option', { name: new RegExp(name) }));
    await actor.keyboard('{Escape}');
};

beforeEach(() => {
    hooks.mutate.mockReset();
    hooks.dimensions = [dimension('d1', 'Kecepatan', 1), dimension('d2', 'Keramahan', 2)];
    hooks.users = [user('u1', 'Andi Saputra', 'IT Support'), user('u2', 'Budi Santoso', 'Network')];
});
afterEach(cleanup);

const savedRatee = (userId: string, name: string, dimensionIds: string[], sortOrder = 0): CsiPeriodDetail['ratees'][number] => ({
    id: `pr-${userId}`, periodId: 'p1', kind: 'PERSON', userId, displayName: name, jobTitle: null, sortOrder, ...STAMP,
    dimensions: dimensionIds.map((dimensionId, index) => ({ id: `${userId}-${dimensionId}`, periodRateeId: `pr-${userId}`, dimensionId, dimensionName: dimensionId, type: 'STAR', required: true, options: [], sortOrder: index, ...STAMP })),
});

const assignAndi = async (actor: ReturnType<typeof userEvent.setup>) => {
    await pickUsers(actor, ['Andi Saputra']);
    await actor.click(screen.getByRole('checkbox', { name: 'Kecepatan' }));
    await actor.click(screen.getByRole('button', { name: 'Pasang ke yang dipilih' }));
};

describe('RateeAssignment', () => {
    it('memasang 2 dimensi ke 2 user lalu menyimpan payload setRatees berisi keduanya', async () => {
        const actor = userEvent.setup();
        render(<RateeAssignment scope="ict" period={period(false)} />);

        await pickUsers(actor, ['Andi Saputra', 'Budi Santoso']);
        await actor.click(screen.getByRole('checkbox', { name: 'Kecepatan' }));
        await actor.click(screen.getByRole('checkbox', { name: 'Keramahan' }));
        await actor.click(screen.getByRole('button', { name: 'Pasang ke yang dipilih' }));

        const table = screen.getByRole('region', { name: 'Daftar orang yang dinilai' });
        expect(table).toHaveTextContent('Andi Saputra');
        expect(table).toHaveTextContent('Budi Santoso');
        expect(screen.getByText('Ada perubahan yang belum disimpan')).toBeInTheDocument();

        await actor.click(screen.getByRole('button', { name: 'Simpan penugasan' }));
        expect(hooks.mutate).toHaveBeenCalledTimes(1);
        expect(hooks.mutate.mock.calls[0][0]).toEqual({
            ratees: [
                { userId: 'u1', dimensionIds: ['d1', 'd2'] },
                { userId: 'u2', dimensionIds: ['d1', 'd2'] },
            ],
        });
    });

    it('mengganti dimensi user yang sudah ada di draft saat dipasang ulang', async () => {
        const actor = userEvent.setup();
        render(<RateeAssignment scope="ict" period={period(false)} />);

        await pickUsers(actor, ['Andi Saputra']);
        await actor.click(screen.getByRole('checkbox', { name: 'Kecepatan' }));
        await actor.click(screen.getByRole('button', { name: 'Pasang ke yang dipilih' }));
        await pickUsers(actor, ['Andi Saputra']);
        await actor.click(screen.getByRole('checkbox', { name: 'Keramahan' }));
        await actor.click(screen.getByRole('button', { name: 'Pasang ke yang dipilih' }));
        await actor.click(screen.getByRole('button', { name: 'Simpan penugasan' }));

        expect(hooks.mutate.mock.calls[0][0]).toEqual({ ratees: [{ userId: 'u1', dimensionIds: ['d2'] }] });
    });

    it('mode locked men-disable tombol pasang dan menampilkan keterangan terkunci', () => {
        render(<RateeAssignment scope="ict" period={period(true)} />);

        expect(screen.getByRole('button', { name: 'Pasang ke yang dipilih' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Pilih orang yang dinilai' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Simpan penugasan' })).toBeDisabled();
        expect(screen.getByText('Terkunci karena sudah ada jawaban')).toBeInTheDocument();
    });

    it('mempertahankan draft yang belum disimpan saat periode di-refetch dengan updatedAt baru', async () => {
        const actor = userEvent.setup();
        const { rerender } = render(<RateeAssignment scope="ict" period={period(false)} />);
        await assignAndi(actor);

        rerender(<RateeAssignment scope="ict" period={period(false, { title: 'Judul baru', updatedAt: '2026-10-26T01:00:00Z' })} />);

        expect(screen.getByRole('region', { name: 'Daftar orang yang dinilai' })).toHaveTextContent('Andi Saputra');
        expect(screen.getByText('Ada perubahan yang belum disimpan')).toBeInTheDocument();
    });

    it('menyelaraskan draft dengan server setelah penugasan tersimpan', async () => {
        const actor = userEvent.setup();
        const { rerender } = render(<RateeAssignment scope="ict" period={period(false)} />);
        await assignAndi(actor);
        await actor.click(screen.getByRole('button', { name: 'Simpan penugasan' }));

        rerender(<RateeAssignment scope="ict" period={period(false, { ratees: [savedRatee('u2', 'Budi Santoso', ['d2'])] })} />);

        const table = screen.getByRole('region', { name: 'Daftar orang yang dinilai' });
        expect(table).toHaveTextContent('Budi Santoso');
        expect(table).not.toHaveTextContent('Andi Saputra');
        expect(screen.queryByText('Ada perubahan yang belum disimpan')).not.toBeInTheDocument();
    });

    it('membuang draft dan mengunci kontrol saat periode berubah menjadi locked', async () => {
        const actor = userEvent.setup();
        const { rerender } = render(<RateeAssignment scope="ict" period={period(false)} />);
        await assignAndi(actor);

        rerender(<RateeAssignment scope="ict" period={period(true)} />);

        expect(screen.queryByRole('region', { name: 'Daftar orang yang dinilai' })).not.toBeInTheDocument();
        expect(screen.getByText('Terkunci karena sudah ada jawaban')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Simpan penugasan' })).toBeDisabled();
    });

    it('melaporkan perubahan draft lewat onDirtyChange', async () => {
        const actor = userEvent.setup();
        const onDirtyChange = vi.fn();
        render(<RateeAssignment scope="ict" period={period(false)} onDirtyChange={onDirtyChange} />);
        expect(onDirtyChange).toHaveBeenLastCalledWith(false);

        await assignAndi(actor);
        expect(onDirtyChange).toHaveBeenLastCalledWith(true);

        await actor.click(screen.getByRole('button', { name: 'Hapus Andi Saputra' }));
        expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    });

    it('ratee order can be changed by drag and is sent in setRatees order', async () => {
        const rows = [savedRatee('u1', 'Andi Saputra', ['d1'], 0), savedRatee('u2', 'Budi Santoso', ['d1'], 1)];
        const rect = (node: Element) => {
            const index = rows.findIndex((row) => `${row.userId}` === node.getAttribute('data-sortable-id'));
            const top = Math.max(index, 0) * 60;
            return { x: 0, y: top, top, left: 0, width: 300, height: 50, right: 300, bottom: top + 50, toJSON: () => ({}) };
        };
        vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function mock(this: Element) { return rect(this); });
        const actor = userEvent.setup();
        render(<RateeAssignment scope="ict" period={period(false, { ratees: rows })} />);

        const handles = screen.getAllByRole('button', { name: 'Ubah urutan orang' });
        handles[0].focus();
        await actor.keyboard(' ');
        await actor.keyboard('{ArrowDown}');
        await actor.keyboard(' ');
        await actor.click(screen.getByRole('button', { name: 'Simpan penugasan' }));

        expect(hooks.mutate.mock.calls[0][0]).toEqual({
            ratees: [{ userId: 'u2', dimensionIds: ['d1'] }, { userId: 'u1', dimensionIds: ['d1'] }],
        });
        vi.restoreAllMocks();
    });

    it('shows only PERSON rows and never sends the TEAM ratee', () => {
        const team = { ...savedRatee('', 'Tim IT Support', ['d1'], 0), kind: 'TEAM' as const, userId: null };
        render(<RateeAssignment scope="ict" period={period(false, { ratees: [team, savedRatee('u2', 'Budi Santoso', ['d1'], 1)] })} />);
        const list = screen.getByRole('region', { name: 'Daftar orang yang dinilai' });
        expect(list).toHaveTextContent('Budi Santoso');
        expect(list).not.toHaveTextContent('Tim IT Support');
    });

    it('lists active questions of all types with a type chip in the picker', () => {
        hooks.dimensions = [{ ...dimension('d1', 'Kecepatan', 1) }, { ...dimension('d3', 'Masukan', 3), type: 'TEXT' }];
        render(<RateeAssignment scope="ict" period={period(false)} />);
        expect(screen.getByRole('checkbox', { name: 'Masukan' })).toBeInTheDocument();
        expect(screen.getByText('Jawaban teks')).toBeInTheDocument();
    });
});
