import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PeriodDetail } from '../PeriodDetail';
import type { CsiPeriodDetail } from '../../../types';

const fx = vi.hoisted(() => ({
    STAMP: { createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' },
    period: null as unknown as CsiPeriodDetail,
    publish: { mutate: vi.fn(), isPending: false },
    unpublish: { mutate: vi.fn(), isPending: false },
    remove: { mutate: vi.fn(), isPending: false },
    toast: { success: vi.fn() },
}));

vi.mock('../../../hooks/useCsi', () => ({
    useCsiPeriod: () => ({ data: fx.period, isLoading: false, isError: false, refetch: () => undefined }),
    usePublishCsiPeriod: () => fx.publish, useUnpublishCsiPeriod: () => fx.unpublish,
    useDeleteCsiPeriod: () => fx.remove,
}));
vi.mock('sonner', () => ({ toast: fx.toast }));

type Check = CsiPeriodDetail['readiness']['checks'][number];
const check = (key: Check['key'], ok: boolean, label: string): Check => ({ key, ok, label });
const period = (over: Partial<CsiPeriodDetail> = {}): CsiPeriodDetail => ({
    id: 'p1', scope: 'ICT', teamEnabled: false, teamLabel: 'Tim IT Support', individualEnabled: true, slaTargetPct: 80, title: 'Survei Q4', intro: '', thankYou: '', startDate: '2026-10-01', endDate: '2026-10-31',
    respondentMode: 'OPEN', createdById: 'a1', sites: [{ id: 's1', code: 'SPJ', name: 'Sidoarjo' }], status: 'ACTIVE',
    publishStatus: 'PUBLISHED', locked: false, ratees: [], raters: [], ...fx.STAMP,
    readiness: { ready: true, checks: [check('ratees', true, 'Minimal 1 orang dinilai'), check('departments', true, 'Minimal 1 departemen aktif')] },
    ...over,
});

const onEditStep = vi.fn();
const onBack = vi.fn();
const renderDetail = () => render(<PeriodDetail scope="ict" periodId="p1" onBack={onBack} onEditStep={onEditStep} />);

beforeEach(() => { vi.clearAllMocks(); fx.period = period(); });
afterEach(cleanup);

describe('PeriodDetail', () => {
    it('menampilkan pill Terbit di samping status waktu', () => {
        renderDetail();
        const header = screen.getByRole('heading', { name: 'Survei Q4' }).parentElement as HTMLElement;
        expect(within(header).getByText('Terbit')).toBeInTheDocument();
        expect(within(header).getByText('Aktif')).toBeInTheDocument();
    });

    it('Ubah pada kelengkapan membuka wizard di langkah pemilik', async () => {
        const actor = userEvent.setup();
        renderDetail();
        await actor.click(screen.getByRole('button', { name: 'Ubah: Minimal 1 departemen aktif' }));
        expect(onEditStep).toHaveBeenCalledWith('departments');
        await actor.click(screen.getByRole('button', { name: 'Ubah info survei' }));
        expect(onEditStep).toHaveBeenCalledWith('info');
    });

    it('Tarik ke draft untuk survei terbit tanpa jawaban', async () => {
        const actor = userEvent.setup();
        fx.unpublish.mutate.mockImplementation((_vars, options) => options?.onSuccess?.());
        renderDetail();
        await actor.click(screen.getByRole('button', { name: 'Tarik ke draft' }));
        expect(fx.unpublish.mutate).toHaveBeenCalled();
        expect(fx.toast.success).toHaveBeenCalledWith('Survei ditarik ke draft');
    });

    it('setelah ada jawaban: tanpa Tarik ke draft, Ubah penugasan dan hapus nonaktif, Ubah departemen tetap aktif', () => {
        fx.period = period({ locked: true });
        renderDetail();
        expect(screen.queryByRole('button', { name: 'Tarik ke draft' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Ubah: Minimal 1 orang dinilai' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Ubah: Minimal 1 departemen aktif' })).toBeEnabled();
        expect(screen.getByRole('button', { name: /Hapus survei/ })).toBeDisabled();
    });

    it('Hapus survei menghapus lalu kembali ke daftar', async () => {
        const actor = userEvent.setup();
        fx.remove.mutate.mockImplementation((_id, options) => options?.onSuccess?.());
        renderDetail();
        await actor.click(screen.getByRole('button', { name: /Hapus survei/ }));
        await actor.click(await screen.findByRole('button', { name: 'Hapus' }));
        expect(fx.remove.mutate).toHaveBeenCalledWith('p1', expect.anything());
        expect(onBack).toHaveBeenCalled();
    });

    it('draft belum lengkap: Terbitkan nonaktif', () => {
        fx.period = period({ publishStatus: 'DRAFT', readiness: { ready: false, checks: [check('ratees', false, 'Minimal 1 orang dinilai')] } });
        renderDetail();
        expect(screen.getByRole('button', { name: 'Terbitkan' })).toBeDisabled();
        expect(screen.getByText('Draft')).toBeInTheDocument();
    });

    it('draft lengkap: Terbitkan memanggil publish dan memberi toast', async () => {
        const actor = userEvent.setup();
        fx.publish.mutate.mockImplementation((_vars, options) => options?.onSuccess?.());
        fx.period = period({ publishStatus: 'DRAFT' });
        renderDetail();
        await actor.click(screen.getByRole('button', { name: 'Terbitkan' }));
        expect(fx.toast.success).toHaveBeenCalledWith('Survei diterbitkan');
    });

    it('terbit tetapi checklist merah: banner peringatan (role status)', () => {
        fx.period = period({ readiness: { ready: false, checks: [check('departments', false, 'Minimal 1 departemen aktif')] } });
        renderDetail();
        expect(screen.getByText('Survei terbit tetapi belum lengkap — responden tidak dapat mengisi sampai checklist terpenuhi.')).toHaveAttribute('role', 'status');
    });

    it.each([
        ['terbit dan lengkap', {}],
        ['draft belum lengkap', { publishStatus: 'DRAFT', readiness: { ready: false, checks: [] } }],
    ] as const)('tanpa banner peringatan bila %s', (_case, over) => {
        fx.period = period(over);
        renderDetail();
        expect(screen.queryByText('Survei terbit tetapi belum lengkap — responden tidak dapat mengisi sampai checklist terpenuhi.')).not.toBeInTheDocument();
    });
});
