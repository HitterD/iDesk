import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PeriodDetail } from '../PeriodDetail';
import type { CsiAssignments, CsiPeriodDetail } from '../../../types';

const fx = vi.hoisted(() => ({
    STAMP: { createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' },
    period: null as unknown as CsiPeriodDetail,
    publish: { mutate: vi.fn(), isPending: false },
    unpublish: { mutate: vi.fn(), isPending: false },
    remove: { mutate: vi.fn(), isPending: false },
    cancel: { mutate: vi.fn(), isPending: false, error: null, reset: vi.fn() },
    purge: { mutate: vi.fn(), isPending: false, error: null, reset: vi.fn() },
    restore: { mutate: vi.fn(), isPending: false },
    setMode: { mutate: vi.fn(), isPending: false },
    toast: { success: vi.fn() },
    assignments: {
        raters: [{ periodRaterId: 'r1', userId: 'u1', fullName: 'Andi', department: 'ICT', siteId: 's1' }],
        ratees: [{ periodRateeId: 't1', kind: 'TEAM', name: 'Tim SPJ', siteId: 's1', photoUrl: null }],
        pairs: [],
    } as CsiAssignments,
}));

vi.mock('../../../hooks/useCsi', () => ({
    useCsiPeriod: () => ({ data: fx.period, isLoading: false, isError: false, refetch: () => undefined }),
    usePublishCsiPeriod: () => fx.publish, useUnpublishCsiPeriod: () => fx.unpublish,
    useDeleteCsiPeriod: () => fx.remove,
    useCancelCsiPeriod: () => fx.cancel, usePurgeCsiPeriod: () => fx.purge, useRestoreCsiPeriod: () => fx.restore,
    useSetCsiPairMode: () => fx.setMode,
    useCsiPeriods: () => ({ data: [{ id: 'p1', responseCount: 7 }] }),
    useCsiAssignments: () => ({ data: fx.assignments, isLoading: false, isError: false, refetch: () => undefined }),
    useSaveCsiAssignments: () => ({ mutate: vi.fn(), isPending: false }),
    useSaveCsiTemplate: () => ({ mutate: vi.fn(), isPending: false }),
    useApplyCsiAssignmentTemplate: () => ({ mutate: vi.fn(), isPending: false }),
    useSetCsiRaters: () => ({ mutate: vi.fn(), isPending: false }),
    useCsiUserSearch: () => ({ data: [], isFetching: false }),
    useUpdateCsiPeriodRatee: () => ({ mutate: vi.fn(), isPending: false }),
    useCsiReport: () => ({ data: undefined, isLoading: true, isError: false, refetch: () => undefined }),
    useCsiRespondents: () => ({ data: undefined, isLoading: true, isError: false, refetch: () => undefined }),
    useCsiResponseDetail: () => ({ data: undefined, isLoading: false, isError: false }),
    useSendCsiReminders: () => ({ mutate: vi.fn(), isPending: false }),
    useResetCsiResponse: () => ({ mutate: vi.fn(), isPending: false }),
    useCsiRaterMatrix: () => ({ data: undefined, isLoading: true, isError: false, refetch: () => undefined }),
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
const renderDetail = (initialTab: 'settings' | 'raters' | 'report' | null = 'settings') =>
    render(<PeriodDetail scope="ict" periodId="p1" onBack={onBack} onEditStep={onEditStep} initialTab={initialTab} />);

beforeEach(() => { vi.clearAllMocks(); fx.period = period(); });
afterEach(cleanup);

describe('PeriodDetail', () => {
    it('one state label: a running published survey reads "Berjalan" and opens on its report', () => {
        renderDetail(null);
        const header = screen.getByRole('heading', { name: 'Survei Q4' }).parentElement as HTMLElement;
        expect(within(header).getByText('Berjalan')).toBeInTheDocument();
        expect(within(header).queryByText('Terbit')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Ubah info survei' })).not.toBeInTheDocument();
    });

    it('a draft opens on its publish requirements, with a hint when the dates already started', () => {
        fx.period = period({ publishStatus: 'DRAFT' });
        renderDetail(null);
        expect(screen.getByText('belum terlihat responden')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Ubah info survei' })).toBeInTheDocument();
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
        expect(fx.unpublish.mutate).not.toHaveBeenCalled();
        const buttons = await screen.findAllByRole('button', { name: 'Tarik ke draft' });
        await actor.click(buttons[buttons.length - 1]);
        expect(fx.unpublish.mutate).toHaveBeenCalled();
        expect(fx.toast.success).toHaveBeenCalledWith('Survei ditarik ke draft');
    });

    it('setelah ada jawaban: tanpa Tarik ke draft dan tanpa hapus; hanya Batalkan (dengan konfirmasi ganda)', () => {
        fx.period = period({ locked: true });
        renderDetail();
        expect(screen.queryByRole('button', { name: 'Tarik ke draft' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Ubah: Minimal 1 orang dinilai' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Ubah: Minimal 1 departemen aktif' })).toBeEnabled();
        expect(screen.queryByRole('button', { name: /Hapus/ })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Batalkan survei' })).toBeInTheDocument();
    });

    it('Batalkan survei: dampak disebut, tombol aktif hanya setelah judul diketik ulang dan alasan diisi', async () => {
        const actor = userEvent.setup();
        fx.period = period({ locked: true });
        renderDetail();
        await actor.click(screen.getByRole('button', { name: 'Batalkan survei' }));
        const dialog = await screen.findByRole('dialog');
        expect(dialog).toHaveTextContent('7 jawaban yang sudah masuk tetap disimpan');
        const confirm = within(dialog).getByRole('button', { name: 'Ya, batalkan survei' });
        expect(confirm).toBeDisabled();
        await actor.type(within(dialog).getByLabelText(/Ketik ulang judul survei/), 'survei q4');
        expect(confirm).toBeDisabled();
        await actor.type(within(dialog).getByLabelText(/Alasan/), 'Salah periode');
        expect(confirm).toBeEnabled();
        await actor.click(confirm);
        expect(fx.cancel.mutate).toHaveBeenCalledWith({ confirmTitle: 'survei q4', reason: 'Salah periode' }, expect.anything());
    });

    it('survei dibatalkan: catatan alasan, Aktifkan lagi, dan Hapus permanen (konfirmasi ganda)', async () => {
        const actor = userEvent.setup();
        fx.period = period({ publishStatus: 'CANCELLED', cancelReason: 'Salah periode', status: 'ACTIVE' });
        renderDetail();
        expect(screen.getByText(/Survei ini dibatalkan/)).toBeInTheDocument();
        expect(screen.getByText(/Alasan: Salah periode/)).toBeInTheDocument();
        await actor.click(screen.getByRole('button', { name: 'Aktifkan lagi' }));
        expect(fx.restore.mutate).toHaveBeenCalled();
        await actor.click(screen.getByRole('button', { name: 'Hapus permanen' }));
        const dialog = await screen.findByRole('dialog');
        expect(dialog).toHaveTextContent('7 jawabannya dihapus');
        expect(within(dialog).getByRole('button', { name: 'Hapus permanen' })).toBeDisabled();
    });

    it('Hapus draft (tanpa jawaban) menghapus lalu kembali ke daftar', async () => {
        const actor = userEvent.setup();
        fx.remove.mutate.mockImplementation((_id, options) => options?.onSuccess?.());
        fx.period = period({ publishStatus: 'DRAFT' });
        renderDetail();
        await actor.click(screen.getByRole('button', { name: 'Hapus draft' }));
        await actor.click(await screen.findByRole('button', { name: 'Hapus' }));
        expect(fx.remove.mutate).toHaveBeenCalledWith('p1', expect.anything());
        expect(onBack).toHaveBeenCalled();
    });

    it('draft belum lengkap: Terbitkan nonaktif', () => {
        fx.period = period({ publishStatus: 'DRAFT', readiness: { ready: false, checks: [check('ratees', false, 'Minimal 1 orang dinilai')] } });
        renderDetail();
        expect(screen.getByRole('button', { name: 'Terbitkan' })).toBeDisabled();
        expect(screen.getByText('Draft')).toBeInTheDocument();
        expect(screen.getByText('Lengkapi 1 syarat bertanda ✗ di atas')).toBeInTheDocument();
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

describe('PeriodDetail · tab Siapa menilai siapa', () => {
    it('shows the matrix and confirms before leaving with unsaved pairs', async () => {
        const actor = userEvent.setup();
        fx.period = period({ respondentMode: 'LISTED', pairMode: 'CUSTOM' });
        renderDetail();
        await actor.click(screen.getByRole('button', { name: 'Siapa menilai siapa' }));
        await actor.click(screen.getByRole('checkbox', { name: 'Andi menilai Tim SPJ' }));
        await actor.click(screen.getByRole('button', { name: 'Syarat terbit' }));
        expect(screen.getByText('Perubahan belum disimpan. Tinggalkan?')).toBeInTheDocument();
        await actor.click(screen.getByRole('button', { name: 'Tetap di sini' }));
        expect(screen.getByRole('checkbox', { name: 'Andi menilai Tim SPJ' })).toHaveAttribute('aria-checked', 'true');
        await actor.click(screen.getByRole('button', { name: 'Syarat terbit' }));
        await actor.click(screen.getByRole('button', { name: 'Tinggalkan' }));
        expect(screen.queryByRole('checkbox', { name: 'Andi menilai Tim SPJ' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Ubah info survei' })).toBeInTheDocument();
    });

    it('leaves without asking when nothing changed', async () => {
        const actor = userEvent.setup();
        renderDetail();
        await actor.click(screen.getByRole('button', { name: 'Siapa menilai siapa' }));
        expect(screen.getByText(/terbuka untuk semua user di site/)).toBeInTheDocument();
        await actor.click(screen.getByRole('button', { name: 'Syarat terbit' }));
        expect(screen.queryByText('Perubahan belum disimpan. Tinggalkan?')).not.toBeInTheDocument();
    });
});
