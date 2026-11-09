import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CsiTemplate } from '../../../../../hcTypes';
import { renderWithQuery } from '../../../__tests__/renderWithQuery';
import { TemplatesTab } from '../TemplatesTab';

const TEMPLATE: CsiTemplate = {
    id: 't1', scope: 'HC', locationCode: 'SMG', name: 'CSI HC 2026 – Semarang', updatedAt: null,
    summary: { pics: 2, picsUnmatched: 0, picsWithoutRaters: 1, raters: 3, ratersOk: 1, ratersNoAccount: 1, ratersAmbiguous: 1 },
    pics: [
        {
            id: 'tp-rara', area: 'HC Development', serviceCode: 'HCD', picName: 'RARA KURNIA MAHARANI PONGDATU', jobTitle: 'PEOPLE & ORGANIZATION DEVELOPMENT STAFF',
            serviceFunction: 'People & Organization Development', picId: 'pic-rara', raterCount: 3,
            raters: [
                { id: 'a', raterName: 'ELVI CYNTHIA', raterJobTitle: 'PLANT MANAGER 1', userId: 'u1', status: 'ok' },
                { id: 'b', raterName: 'ARIEF NOEGROHO', raterJobTitle: null, userId: null, status: 'no-account' },
                { id: 'c', raterName: 'AGUS SUBEKTI', raterJobTitle: null, userId: null, status: 'ambiguous' },
            ],
        },
        { id: 'tp-jingga', area: 'HC Services', serviceCode: 'HCS', picName: 'JINGGA FERDASIWI', jobTitle: 'RECEPTIONIST', serviceFunction: null, picId: null, raterCount: 0, raters: [] },
    ],
};
const fx = vi.hoisted(() => ({ list: { templates: [] as unknown[], bundledAvailable: ['SMG'] }, blocked: null as string | null }));
vi.mock('../../../../../api/csiHc.api', () => ({
    CsiHcApi: {
        templates: vi.fn(async () => fx.list),
        loadBundledTemplate: vi.fn(async () => TEMPLATE),
        updateTemplatePic: vi.fn(async () => TEMPLATE),
        addTemplateRater: vi.fn(async () => TEMPLATE),
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

beforeEach(() => { fx.list = { templates: [TEMPLATE], bundledAvailable: [] }; fx.blocked = null; });
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('TemplatesTab', () => {
    it('offers the bundled Semarang template when none exists yet', async () => {
        fx.list = { templates: [], bundledAvailable: ['SMG'] };
        renderWithQuery(<TemplatesTab scope="hc" />);
        await userEvent.click(await screen.findByRole('button', { name: /muat template semarang/i }));
        expect((await api()).loadBundledTemplate).toHaveBeenCalledWith('hc', 'SMG');
    });

    it('shows each PIC with service function and rater match badges', async () => {
        renderWithQuery(<TemplatesTab scope="hc" />);
        const rara = await screen.findByRole('region', { name: /RARA KURNIA MAHARANI PONGDATU/ });
        expect(within(rara).getByText('People & Organization Development')).toBeInTheDocument();
        expect(within(rara).getByText('Cocok')).toBeInTheDocument();
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
        await userEvent.type(within(rara).getByRole('textbox', { name: /tambah penilai/i }), 'budi santoso{Enter}');
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
