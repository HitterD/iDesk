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
    id, name, sortOrder, scope: 'ICT', isActive: true, description: null, ...STAMP,
});
const user = (id: string, fullName: string, jobTitle: string): CsiUserSearchResult => ({
    id, fullName, jobTitle, email: `${id}@idesk.test`, siteId: 's1', site: { code: 'SPJ', name: 'Sidoarjo' },
});

const period = (locked: boolean, over: Partial<CsiPeriodDetail> = {}): CsiPeriodDetail => ({
    id: 'p1', scope: 'ICT', siteId: 's1', title: 'Survei Q4', intro: '', thankYou: '',
    startDate: '2026-10-01', endDate: '2026-10-31', respondentMode: 'OPEN', createdById: 'a1',
    publishStatus: 'PUBLISHED', readiness: { ready: false, checks: [] },
    site: { id: 's1', code: 'SPJ', name: 'Sidoarjo' }, status: 'ACTIVE', locked, ratees: [], raters: [], ...STAMP, ...over,
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

const savedRatee = (userId: string, name: string, dimensionIds: string[]): CsiPeriodDetail['ratees'][number] => ({
    id: `pr-${userId}`, periodId: 'p1', userId, displayName: name, jobTitle: null, sortOrder: 0, ...STAMP,
    dimensions: dimensionIds.map((dimensionId, index) => ({ id: `${userId}-${dimensionId}`, periodRateeId: `pr-${userId}`, dimensionId, dimensionName: dimensionId, sortOrder: index, ...STAMP })),
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

        const table = screen.getByRole('table', { name: 'Orang yang dinilai' });
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

        expect(screen.getByRole('table', { name: 'Orang yang dinilai' })).toHaveTextContent('Andi Saputra');
        expect(screen.getByText('Ada perubahan yang belum disimpan')).toBeInTheDocument();
    });

    it('menyelaraskan draft dengan server setelah penugasan tersimpan', async () => {
        const actor = userEvent.setup();
        const { rerender } = render(<RateeAssignment scope="ict" period={period(false)} />);
        await assignAndi(actor);
        await actor.click(screen.getByRole('button', { name: 'Simpan penugasan' }));

        rerender(<RateeAssignment scope="ict" period={period(false, { ratees: [savedRatee('u2', 'Budi Santoso', ['d2'])] })} />);

        const table = screen.getByRole('table', { name: 'Orang yang dinilai' });
        expect(table).toHaveTextContent('Budi Santoso');
        expect(table).not.toHaveTextContent('Andi Saputra');
        expect(screen.queryByText('Ada perubahan yang belum disimpan')).not.toBeInTheDocument();
    });

    it('membuang draft dan mengunci kontrol saat periode berubah menjadi locked', async () => {
        const actor = userEvent.setup();
        const { rerender } = render(<RateeAssignment scope="ict" period={period(false)} />);
        await assignAndi(actor);

        rerender(<RateeAssignment scope="ict" period={period(true)} />);

        expect(screen.queryByRole('table', { name: 'Orang yang dinilai' })).not.toBeInTheDocument();
        expect(screen.getByText('Terkunci karena sudah ada jawaban')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Simpan penugasan' })).toBeDisabled();
    });
});
