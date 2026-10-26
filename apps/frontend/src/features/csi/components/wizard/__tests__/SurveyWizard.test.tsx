import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SurveyWizard } from '../SurveyWizard';
import type { WizardStepKey } from '../../../lib/wizard';
import type { CsiDimension, CsiPeriodDetail, CsiPeriodListItem, CsiUserSearchResult } from '../../../types';

const fx = vi.hoisted(() => {
    const STAMP = { createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' };
    const mutation = () => ({ mutate: vi.fn(), isPending: false });
    return {
        STAMP,
        period: null as unknown as CsiPeriodDetail,
        periods: [] as CsiPeriodListItem[],
        create: mutation(), update: mutation(), publish: mutation(),
        idle: () => ({ mutate: vi.fn(), isPending: false }),
        dimension: { id: 'd1', name: 'Kecepatan', sortOrder: 1, scope: 'ICT', isActive: true, description: null, ...STAMP } as CsiDimension,
        dimensions: [] as CsiDimension[],
        users: [{ id: 'u1', fullName: 'Andi Saputra', jobTitle: null, email: 'andi@idesk.test', siteId: 's1', site: null }] as CsiUserSearchResult[],
        toast: { success: vi.fn() },
    };
});

vi.mock('../../../hooks/useCsi', () => ({
    useCsiPeriod: () => ({ data: fx.period, isLoading: false, isError: false, refetch: () => undefined }),
    useCsiPeriods: () => ({ data: fx.periods }),
    useCreateCsiPeriod: () => fx.create, useUpdateCsiPeriod: () => fx.update, usePublishCsiPeriod: () => fx.publish,
    useCsiDimensions: () => ({ data: fx.dimensions, isLoading: false, isError: false }),
    useCsiDepartments: () => ({ data: [], isLoading: false, isError: false }),
    useCsiUserSearch: () => ({ data: fx.users, isFetching: false }),
    useCsiRaters: () => ({ data: [], isLoading: false }),
    useCreateCsiDimension: fx.idle, useUpdateCsiDimension: fx.idle, useDeactivateCsiDimension: fx.idle,
    useCreateCsiDepartment: fx.idle, useUpdateCsiDepartment: fx.idle, useDeactivateCsiDepartment: fx.idle, useAddCsiRaters: fx.idle,
    useSetCsiRatees: fx.idle, useSetCsiRaters: fx.idle, useDeleteCsiPeriod: fx.idle,
}));
vi.mock('@/components/site/useActiveSites', () => ({ useActiveSites: () => ({ data: [{ id: 's1', code: 'SPJ', name: 'Sidoarjo' }] }) }));
vi.mock('sonner', () => ({ toast: fx.toast }));

type Check = CsiPeriodDetail['readiness']['checks'][number];
const check = (key: Check['key'], ok: boolean, label: string): Check => ({ key, ok, label });
const period = (over: Partial<CsiPeriodDetail> = {}): CsiPeriodDetail => ({
    id: 'p1', scope: 'ICT', siteId: 's1', title: 'Survei Q4', intro: '', thankYou: '', startDate: '2026-10-01', endDate: '2026-10-31',
    respondentMode: 'OPEN', createdById: 'a1', site: { id: 's1', code: 'SPJ', name: 'Sidoarjo' }, status: 'ACTIVE',
    publishStatus: 'DRAFT', locked: false, ratees: [], raters: [], ...fx.STAMP,
    readiness: { ready: true, checks: [check('ratees', true, 'Minimal 1 orang dinilai')] }, ...over,
});
const listItem = (): CsiPeriodListItem => ({ ...period({ title: 'Survei Q3' }), id: 'old', publishStatus: 'PUBLISHED', responseCount: 4 });

const props = { onStepChange: vi.fn(), onClose: vi.fn(), onCreated: vi.fn(), onPublished: vi.fn() };
const renderWizard = (periodId: string | null, step: WizardStepKey) =>
    render(<SurveyWizard scope="ict" periodId={periodId} step={step} {...props} />);
const stepper = () => within(screen.getByRole('navigation', { name: 'Langkah pembuatan survei' }));
const setDates = (start: string, end: string) => {
    fireEvent.change(screen.getByLabelText('Tanggal mulai'), { target: { value: start } });
    fireEvent.change(screen.getByLabelText('Tanggal selesai'), { target: { value: end } });
};

beforeEach(() => {
    vi.clearAllMocks();
    fx.period = period();
    fx.periods = [listItem()];
    fx.dimensions = [fx.dimension];
});
afterEach(cleanup);

describe('SurveyWizard', () => {
    it('new wizard shows only info step and creates draft on Lanjut', async () => {
        const actor = userEvent.setup();
        fx.create.mutate.mockImplementation((_payload, options) => options?.onSuccess?.({ ...period(), id: 'p-new' }));
        renderWizard(null, 'info');

        expect(stepper().getByRole('button', { name: /Info survei/ })).toHaveAttribute('aria-current', 'step');
        expect(stepper().getByRole('button', { name: /Dimensi/ })).toBeDisabled();
        expect(screen.queryByRole('button', { name: 'Kembali' })).not.toBeInTheDocument();

        await actor.click(screen.getByRole('button', { name: 'Site' }));
        await actor.click(await screen.findByRole('option', { name: /SPJ · Sidoarjo/ }));
        await actor.type(screen.getByLabelText('Judul'), 'Survei Q4');
        setDates('2026-11-01', '2026-11-30');
        await actor.click(screen.getByRole('button', { name: 'Lanjut' }));

        expect(fx.create.mutate).toHaveBeenCalledWith(
            expect.objectContaining({ siteId: 's1', title: 'Survei Q4', startDate: '2026-11-01', endDate: '2026-11-30' }), expect.anything());
        expect(props.onCreated).toHaveBeenCalledWith('p-new');
    });

    it('copy requires dates before continue', async () => {
        const actor = userEvent.setup();
        renderWizard(null, 'info');
        await actor.click(screen.getByRole('button', { name: 'Site' }));
        await actor.click(await screen.findByRole('option', { name: /SPJ · Sidoarjo/ }));
        setDates('2026-11-01', '2026-11-30');

        await actor.click(screen.getByRole('button', { name: 'Salin dari survei sebelumnya' }));
        await actor.click(screen.getByRole('button', { name: 'Salin dari survei' }));
        await actor.click(await screen.findByRole('option', { name: /Survei Q3/ }));

        expect(screen.getByLabelText('Tanggal mulai')).toHaveValue('');
        expect(screen.getByLabelText('Tanggal selesai')).toHaveValue('');
        expect(screen.getByLabelText('Judul')).toHaveValue('Survei Q3');
        expect(screen.getByText('Tanggal mulai dan selesai wajib diisi')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Lanjut' })).toBeDisabled();

        setDates('2026-12-01', '2026-12-31');
        expect(screen.getByRole('button', { name: 'Lanjut' })).toBeEnabled();
    });

    it('raters step hidden for OPEN mode', () => {
        renderWizard('p1', 'dimensions');
        expect(stepper().queryByRole('button', { name: /Penilai/ })).not.toBeInTheDocument();
        cleanup();
        fx.period = period({ respondentMode: 'LISTED' });
        renderWizard('p1', 'dimensions');
        expect(stepper().getByRole('button', { name: /Penilai/ })).toBeEnabled();
    });

    it('review disables Terbitkan when not ready and lists failing checks', async () => {
        const actor = userEvent.setup();
        fx.period = period({ readiness: { ready: false, checks: [
            check('ratees', false, 'Minimal 1 orang dinilai'), check('departments', true, 'Minimal 1 departemen aktif'),
        ] } });
        renderWizard('p1', 'review');

        expect(screen.getByRole('button', { name: 'Terbitkan' })).toBeDisabled();
        const failing = screen.getByText('Minimal 1 orang dinilai').closest('li') as HTMLElement;
        expect(within(failing).getByText('belum terpenuhi')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Kembali' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Lanjut' })).not.toBeInTheDocument();

        await actor.click(within(failing).getByRole('button', { name: /Ubah/ }));
        expect(props.onStepChange).toHaveBeenCalledWith('ratees');
    });

    it('Terbitkan calls publish and closes to detail', async () => {
        const actor = userEvent.setup();
        fx.publish.mutate.mockImplementation((_vars, options) => options?.onSuccess?.(period({ publishStatus: 'PUBLISHED' })));
        renderWizard('p1', 'review');

        await actor.click(screen.getByRole('button', { name: 'Terbitkan' }));

        expect(fx.publish.mutate).toHaveBeenCalled();
        expect(fx.toast.success).toHaveBeenCalledWith('Survei diterbitkan');
        expect(props.onPublished).toHaveBeenCalledWith('p1');
    });

    it("Lanjut blocked with 'Simpan perubahan dulu' when ratee draft is dirty", async () => {
        const actor = userEvent.setup();
        renderWizard('p1', 'ratees');
        expect(screen.getByRole('button', { name: 'Lanjut' })).toBeEnabled();

        await actor.click(screen.getByRole('button', { name: 'Pilih orang yang dinilai' }));
        await actor.click(await screen.findByRole('option', { name: /Andi Saputra/ }));
        await actor.keyboard('{Escape}');
        await actor.click(screen.getByRole('checkbox', { name: 'Kecepatan' }));
        await actor.click(screen.getByRole('button', { name: 'Pasang ke yang dipilih' }));

        expect(screen.getByText('Simpan perubahan dulu')).toHaveAttribute('role', 'status');
        expect(screen.getByRole('button', { name: 'Lanjut' })).toBeDisabled();
        expect(stepper().getByRole('button', { name: /Departemen/ })).toBeDisabled();
    });

    it('Lanjut on an unchanged info step advances without saving', async () => {
        const actor = userEvent.setup();
        renderWizard('p1', 'info');
        await actor.click(screen.getByRole('button', { name: 'Lanjut' }));
        expect(fx.update.mutate).not.toHaveBeenCalled();
        expect(props.onStepChange).toHaveBeenCalledWith('dimensions');
    });

    it('locks the respondent mode once the survey has answers', () => {
        fx.period = period({ locked: true });
        renderWizard('p1', 'info');
        expect(screen.getByRole('button', { name: 'Hanya penilai terdaftar' })).toBeDisabled();
    });
});
