import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CsiTemplate } from '../../../../../hcTypes';
import { renderWithQuery } from '../../../__tests__/renderWithQuery';
import { TemplatesTab } from '../TemplatesTab';

const TEMPLATE: CsiTemplate = {
    id: 't1', scope: 'HC', locationCode: 'SMG', name: 'CSI HC 2026 – Semarang', updatedAt: null,
    summary: { pics: 2, picsUnmatched: 0, picsWithoutRaters: 1, raters: 3, ratersConfirmed: 0, ratersOk: 1, ratersNoAccount: 1, ratersAmbiguous: 1 },
    pics: [
        {
            id: 'tp-rara', area: 'HC Development', serviceCode: 'HCD', picName: 'RARA KURNIA MAHARANI PONGDATU', jobTitle: 'PEOPLE & ORGANIZATION DEVELOPMENT STAFF',
            serviceFunction: 'People & Organization Development', picId: 'pic-rara', teamId: null, raterCount: 3,
            raters: [
                { id: 'a', raterName: 'ELVI CYNTHIA', raterNik: null, confirmed: false, raterJobTitle: 'PLANT MANAGER 1', userId: 'u1', status: 'ok' },
                { id: 'b', raterName: 'ARIEF NOEGROHO', raterNik: null, confirmed: false, raterJobTitle: null, userId: null, status: 'no-account' },
                { id: 'c', raterName: 'AGUS SUBEKTI', raterNik: null, confirmed: false, raterJobTitle: null, userId: null, status: 'ambiguous' },
            ],
        },
        { id: 'tp-jingga', area: 'HC Services', serviceCode: 'HCS', picName: 'JINGGA FERDASIWI', jobTitle: 'RECEPTIONIST', serviceFunction: null, picId: null, teamId: null, raterCount: 0, raters: [] },
    ],
};
const REPORT = {
    format: 'matrix', committed: false, services: ['HCC', 'HCS'],
    pics: { added: ['BUDI'], changed: ['RARA'], removed: [] as string[] }, raters: { added: 4, removed: 0 },
    teams: { added: ['Tim Payroll'] }, newMasterPics: ['BUDI'],
    unresolved: [{ name: 'Tim Rekrut', suggestions: ['TIM REKRUTMEN', 'RARA'] }],
    problems: [] as Array<{ row: number; message: string }>,
};
const fx = vi.hoisted(() => ({
    list: { templates: [] as unknown[], bundledAvailable: ['SMG'] }, blocked: null as string | null, report: null as unknown as typeof REPORT, failPrune: false,
}));
vi.mock('../../../../../lib/csiAdmin', async (importOriginal) => ({ ...(await importOriginal<object>()), downloadBlob: vi.fn() }));
vi.mock('../../../../../api/csiHc.api', () => ({
    CsiHcApi: {
        templates: vi.fn(async () => fx.list),
        importTemplate: vi.fn(async (_scope: string, _location: string, _file: File, options: { commit?: boolean; prune?: boolean }) => {
            if (options.prune && fx.failPrune) throw new Error('network');
            return { ...fx.report, committed: !!options.commit, pics: { ...fx.report.pics, removed: options.prune ? ['LAMA'] : [] } };
        }),
        downloadBlankTemplate: vi.fn(async () => new Blob(['x'])),
        loadBundledTemplate: vi.fn(async () => TEMPLATE),
        updateTemplatePic: vi.fn(async () => TEMPLATE),
        addTemplateRater: vi.fn(async () => TEMPLATE),
        templateAccountSuggestions: vi.fn(async () => []),
        removeTemplateRater: vi.fn(async () => TEMPLATE),
        applyTemplate: vi.fn(async (_scope: string, _id: string, _period: string, commit: boolean) => ({
            picsAdded: 1, ratersAdded: 1, pairsAdded: 1, picsSkippedNoRaters: ['JINGGA FERDASIWI'], picsUnmatched: [],
            ratersNoAccount: ['ARIEF NOEGROHO'], ratersAmbiguous: ['AGUS SUBEKTI'], blockedReason: fx.blocked, committed: commit,
        })),
        createPeriodFromTemplate: vi.fn(async () => ({ periodId: 'p-new', report: {
            picsAdded: 15, ratersAdded: 108, pairsAdded: 423, picsSkippedNoRaters: [], picsUnmatched: [], ratersNoAccount: [], ratersAmbiguous: [], blockedReason: null, committed: true,
        } })),
    },
}));
vi.mock('../../../../../api/csi.api', () => ({
    CsiApi: { periods: vi.fn(async () => [{ id: 'p1', title: 'CSI HC Nov', scope: 'HC', status: 'ACTIVE', responseCount: 3, startDate: '2026-11-01', endDate: '2026-11-30' }]) },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const api = async () => (await import('../../../../../api/csiHc.api')).CsiHcApi;

beforeEach(() => { fx.list = { templates: [TEMPLATE], bundledAvailable: [] }; fx.blocked = null; fx.report = REPORT; fx.failPrune = false; });

const XLSX = new File(['x'], 'smg.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
/** Opens the import dialog on the Semarang template and waits for the dry run. */
async function openPreview() {
    renderWithQuery(<TemplatesTab scope="hc" />);
    await userEvent.click(await screen.findByRole('button', { name: /impor excel/i }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.upload(within(dialog).getByLabelText(/file excel/i), XLSX);
    await within(dialog).findByText(/format matriks/i);
    return dialog;
}
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('TemplatesTab', () => {
    it('shows four location tabs', async () => {
        renderWithQuery(<TemplatesTab scope="hc" />);
        await screen.findByRole('tab', { name: /semarang\s*2 PIC/i });
        const tabs = screen.getAllByRole('tab');
        expect(tabs.map((tab) => tab.textContent)).toEqual(['Semarang2 PIC', 'Karawangkosong', 'Sepanjangkosong', 'Jakartakosong']);
        expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    });

    it('empty location offers import and blank download', async () => {
        renderWithQuery(<TemplatesTab scope="hc" />);
        await userEvent.click(await screen.findByRole('tab', { name: /karawang/i }));
        expect(screen.getByText('Belum ada template Karawang')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /muat template bawaan/i })).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: /unduh template kosong/i }));
        expect((await api()).downloadBlankTemplate).toHaveBeenCalledWith('hc', 'KRW');
        const { downloadBlob } = await import('../../../../../lib/csiAdmin');
        await vi.waitFor(() => expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'CSI HC Karawang - template.xlsx'));
        await userEvent.click(screen.getByRole('button', { name: /impor excel/i }));
        expect(await screen.findByRole('dialog')).toBeInTheDocument();
    });

    it('import preview disables save until unresolved resolved', async () => {
        const dialog = await openPreview();
        expect((await api()).importTemplate).toHaveBeenLastCalledWith('hc', 'SMG', XLSX, { commit: false, prune: false, pruneConfirmed: false });
        expect(within(dialog).getByText('+1 PIC baru')).toBeInTheDocument();
        expect(within(dialog).getByText('~1 PIC berubah')).toBeInTheDocument();
        expect(within(dialog).getByText('+4 penilai')).toBeInTheDocument();
        const save = within(dialog).getByRole('button', { name: /simpan/i });
        expect(save).toBeDisabled();
        await userEvent.click(within(dialog).getByRole('radio', { name: /tim baru/i }));
        expect(save).toBeEnabled();
    });

    it('rename requires a suggestion', async () => {
        const dialog = await openPreview();
        const pick = within(dialog).getByRole('combobox', { name: /saran nama untuk tim rekrut/i });
        expect(pick).toBeDisabled();
        await userEvent.click(within(dialog).getByRole('radio', { name: /salah ketik/i }));
        expect(within(dialog).getByRole('button', { name: /simpan/i })).toBeDisabled();
        await userEvent.selectOptions(pick, 'TIM REKRUTMEN');
        expect(within(dialog).getByRole('button', { name: /simpan/i })).toBeEnabled();
    });

    it('prune checkbox lists services', async () => {
        const dialog = await openPreview();
        const prune = within(dialog).getByRole('checkbox', { name: 'Hapus yang tidak ada di Excel (layanan: HCC, HCS)' });
        const confirmed = within(dialog).getByRole('checkbox', { name: /termasuk penilai yang sudah dikonfirmasi/i });
        expect(confirmed).toBeDisabled();
        await userEvent.click(prune);
        expect((await api()).importTemplate).toHaveBeenLastCalledWith('hc', 'SMG', XLSX, { commit: false, prune: true, pruneConfirmed: false });
        expect(await within(dialog).findByText('−1 PIC dihapus')).toBeInTheDocument();
        expect(confirmed).toBeEnabled();
    });

    it('pruning with problem rows warns and blocks save', async () => {
        fx.report = { ...REPORT, unresolved: [], problems: [{ row: 7, message: 'Nama PIC kosong' }] };
        const dialog = await openPreview();
        expect(within(dialog).getByText(/baris 7/i)).toBeInTheDocument();
        expect(within(dialog).getByRole('button', { name: /simpan/i })).toBeEnabled();
        await userEvent.click(within(dialog).getByRole('checkbox', { name: /hapus yang tidak ada/i }));
        expect(await within(dialog).findByText(/perbaiki dulu baris bermasalah/i)).toBeInTheDocument();
        expect(within(dialog).getByRole('button', { name: /simpan/i })).toBeDisabled();
    });

    it('a failed prune preview keeps save disabled', async () => {
        fx.report = { ...REPORT, unresolved: [] };
        fx.failPrune = true;
        const dialog = await openPreview();
        expect(within(dialog).getByRole('button', { name: /simpan/i })).toBeEnabled();
        await userEvent.click(within(dialog).getByRole('checkbox', { name: /hapus yang tidak ada/i }));
        expect(await within(dialog).findByText('Pratinjau gagal dimuat, coba lagi')).toBeInTheDocument();
        expect(within(dialog).getByRole('button', { name: /simpan/i })).toBeDisabled();
    });

    it('commit sends resolutions and prune options', async () => {
        const dialog = await openPreview();
        await userEvent.click(within(dialog).getByRole('radio', { name: /salah ketik/i }));
        await userEvent.selectOptions(within(dialog).getByRole('combobox', { name: /saran nama/i }), 'RARA');
        await userEvent.click(within(dialog).getByRole('checkbox', { name: /hapus yang tidak ada/i }));
        await within(dialog).findByText('−1 PIC dihapus');
        await userEvent.click(within(dialog).getByRole('checkbox', { name: /termasuk penilai/i }));
        await userEvent.click(within(dialog).getByRole('button', { name: /simpan/i }));
        expect((await api()).importTemplate).toHaveBeenLastCalledWith('hc', 'SMG', XLSX, {
            commit: true, prune: true, pruneConfirmed: true, resolutions: { 'Tim Rekrut': { as: 'rename', picName: 'RARA' } },
        });
        const { toast } = await import('sonner');
        await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith('Template Semarang diperbarui'));
        await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('offers the bundled Semarang template when none exists yet', async () => {
        fx.list = { templates: [], bundledAvailable: ['SMG'] };
        renderWithQuery(<TemplatesTab scope="hc" />);
        await userEvent.click(await screen.findByRole('button', { name: /muat template bawaan/i }));
        expect((await api()).loadBundledTemplate).toHaveBeenCalledWith('hc', 'SMG');
    });

    it('shows each PIC with service function and rater match badges', async () => {
        renderWithQuery(<TemplatesTab scope="hc" />);
        const rara = await screen.findByRole('region', { name: /RARA KURNIA MAHARANI PONGDATU/ });
        expect(within(rara).getByText('People & Organization Development')).toBeInTheDocument();
        expect(within(rara).getByText('Cocok otomatis')).toBeInTheDocument();
        expect(within(rara).getByText('Belum punya akun')).toBeInTheDocument();
        expect(within(rara).getByText('Nama ganda')).toBeInTheDocument();
        expect(within(screen.getByRole('region', { name: /JINGGA FERDASIWI/ })).getByText(/belum ada penilai/i)).toBeInTheDocument();
    });

    it('edits the service function and adds a rater by name', async () => {
        renderWithQuery(<TemplatesTab scope="hc" />);
        const rara = await screen.findByRole('region', { name: /RARA KURNIA MAHARANI PONGDATU/ });
        await userEvent.click(within(rara).getByRole('button', { name: /ubah fungsi pelayanan/i }));
        const input = within(rara).getByRole('textbox', { name: /fungsi pelayanan/i });
        await userEvent.clear(input);
        await userEvent.type(input, 'POD{Enter}');
        expect((await api()).updateTemplatePic).toHaveBeenCalledWith('hc', 'tp-rara', { serviceFunction: 'POD' });
        await userEvent.type(within(rara).getByRole('combobox', { name: /tambah penilai/i }), 'budi santoso{Enter}');
        expect((await api()).addTemplateRater).toHaveBeenCalledWith('hc', 'tp-rara', { name: 'budi santoso' });
    });

    it('applying to a survey previews first and writes only on confirm', async () => {
        renderWithQuery(<TemplatesTab scope="hc" />);
        await userEvent.click(await screen.findByRole('button', { name: /gunakan template/i }));
        const dialog = await screen.findByRole('dialog');
        await userEvent.click(within(dialog).getByRole('radio', { name: /survei yang sudah ada/i }));
        await userEvent.selectOptions(within(dialog).getByRole('combobox', { name: /survei/i }), 'p1');
        await userEvent.click(within(dialog).getByRole('button', { name: /pratinjau/i }));
        expect((await api()).applyTemplate).toHaveBeenLastCalledWith('hc', 't1', 'p1', false);
        expect(await within(dialog).findByText(/1 pasangan baru/i)).toBeInTheDocument();
        expect(within(dialog).getByText(/Jingga Ferdasiwi/)).toBeInTheDocument();
        await userEvent.click(within(dialog).getByRole('button', { name: /terapkan/i }));
        expect((await api()).applyTemplate).toHaveBeenLastCalledWith('hc', 't1', 'p1', true);
    });

    it('a survey that cannot be synced shows why and cannot be applied', async () => {
        fx.blocked = 'Survei ini terbuka untuk semua user di site.';
        renderWithQuery(<TemplatesTab scope="hc" />);
        await userEvent.click(await screen.findByRole('button', { name: /gunakan template/i }));
        const dialog = await screen.findByRole('dialog');
        await userEvent.click(within(dialog).getByRole('radio', { name: /survei yang sudah ada/i }));
        await userEvent.selectOptions(within(dialog).getByRole('combobox', { name: /survei/i }), 'p1');
        await userEvent.click(within(dialog).getByRole('button', { name: /pratinjau/i }));
        expect(await within(dialog).findByText(/terbuka untuk semua user/)).toBeInTheDocument();
        expect(within(dialog).getByRole('button', { name: /terapkan/i })).toBeDisabled();
    });

    it('a new survey is created once: the button locks after success', async () => {
        renderWithQuery(<TemplatesTab scope="hc" />);
        await userEvent.click(await screen.findByRole('button', { name: /gunakan template/i }));
        const dialog = await screen.findByRole('dialog');
        await userEvent.type(within(dialog).getByLabelText(/tanggal mulai/i), '2026-12-01');
        await userEvent.type(within(dialog).getByLabelText(/tanggal selesai/i), '2026-12-31');
        const create = within(dialog).getByRole('button', { name: /buat survei/i });
        await userEvent.click(create);
        expect(await within(dialog).findByText(/423 pasangan baru/)).toBeInTheDocument();
        expect(within(dialog).getByRole('button', { name: /buat survei/i })).toBeDisabled();
        expect((await api()).createPeriodFromTemplate).toHaveBeenCalledTimes(1);
    });
});
