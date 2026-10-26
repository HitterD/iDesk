import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PeriodDetail } from '../PeriodDetail';
import type { CsiDimension, CsiPeriodDetail, CsiUserSearchResult } from '../../../types';

const fx = vi.hoisted(() => {
    const STAMP = { createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' };
    return {
        STAMP,
        state: { period: null as unknown as CsiPeriodDetail },
        idle: () => ({ mutate: () => undefined, isPending: false }),
        dimensions: [{ id: 'd1', name: 'Kecepatan', sortOrder: 1, scope: 'ICT', isActive: true, description: null, ...STAMP }] as CsiDimension[],
        users: [{ id: 'u1', fullName: 'Andi Saputra', jobTitle: null, email: 'andi@idesk.test', siteId: 's1', site: null }] as CsiUserSearchResult[],
    };
});
const { STAMP, state } = fx;

vi.mock('../../../hooks/useCsi', () => ({
    useCsiPeriod: () => ({ data: fx.state.period, isLoading: false, isError: false, refetch: () => undefined }),
    useCsiDimensions: () => ({ data: fx.dimensions }),
    useCsiUserSearch: () => ({ data: fx.users, isFetching: false }),
    useCsiRaters: () => ({ data: [], isLoading: false }),
    useSetCsiRatees: fx.idle, useSetCsiRaters: fx.idle, useDeleteCsiPeriod: fx.idle,
    useCreateCsiPeriod: fx.idle, useUpdateCsiPeriod: fx.idle,
}));
vi.mock('@/components/site/useActiveSites', () => ({ useActiveSites: () => ({ data: [] }) }));

const period = (over: Partial<CsiPeriodDetail> = {}): CsiPeriodDetail => ({
    id: 'p1', scope: 'ICT', siteId: 's1', title: 'Survei Q4', intro: '', thankYou: '', startDate: '2026-10-01', endDate: '2026-10-31',
    respondentMode: 'OPEN', createdById: 'a1', site: { id: 's1', code: 'SPJ', name: 'Sidoarjo' }, status: 'ACTIVE',
    publishStatus: 'PUBLISHED', readiness: { ready: false, checks: [] },
    locked: false, ratees: [], raters: [], ...STAMP, ...over,
});

const renderDetail = () => {
    const client = new QueryClient();
    const ui = () => <QueryClientProvider client={client}><PeriodDetail scope="ict" periodId="p1" onBack={vi.fn()} /></QueryClientProvider>;
    const view = render(ui());
    return { rerender: () => view.rerender(ui()) };
};

beforeEach(() => { state.period = period(); });
afterEach(cleanup);

describe('PeriodDetail', () => {
    it('tidak menghapus draft penugasan saat pengaturan tersimpan (updatedAt baru)', async () => {
        const actor = userEvent.setup();
        const view = renderDetail();
        await actor.click(screen.getByRole('button', { name: 'Pilih orang yang dinilai' }));
        await actor.click(await screen.findByRole('option', { name: /Andi Saputra/ }));
        await actor.keyboard('{Escape}');
        await actor.click(screen.getByRole('checkbox', { name: 'Kecepatan' }));
        await actor.click(screen.getByRole('button', { name: 'Pasang ke yang dipilih' }));

        state.period = period({ title: 'Survei Q4 (revisi)', updatedAt: '2026-10-26T01:00:00Z' });
        view.rerender();

        expect(screen.getByRole('table', { name: 'Orang yang dinilai' })).toHaveTextContent('Andi Saputra');
        expect(screen.getByText('Ada perubahan yang belum disimpan')).toBeInTheDocument();
    });

    it('mengunci mode responden saat periode sudah memiliki jawaban', () => {
        state.period = period({ locked: true });
        renderDetail();
        expect(screen.getByRole('button', { name: 'Hanya penilai terdaftar' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Semua user di site' })).toBeDisabled();
    });
});
