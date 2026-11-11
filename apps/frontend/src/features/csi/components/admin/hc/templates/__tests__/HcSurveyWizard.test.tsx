import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CsiTemplate, CsiTemplateApplyReport } from '../../../../../hcTypes';
import { renderWithQuery } from '../../../__tests__/renderWithQuery';
import { HcSurveyWizard } from '../HcSurveyWizard';

const rater = (id: string, name: string, status: 'ok' | 'no-account') => ({
    id, raterName: name, raterNik: null, raterJobTitle: null, userId: status === 'ok' ? `u-${name}` : null, status, confirmed: false,
});
const template = (id: string, locationCode: string): CsiTemplate => ({
    id, scope: 'HC', locationCode, name: `CSI HC 2026 – ${locationCode}`, updatedAt: null,
    summary: { pics: 1, picsUnmatched: 0, picsWithoutRaters: 0, raters: 2, ratersConfirmed: 0, ratersOk: 1, ratersNoAccount: 1, ratersAmbiguous: 0 },
    pics: [{
        id: `${id}-p`, area: 'HC Services', serviceCode: 'HCS', picName: 'JINGGA', jobTitle: null, serviceFunction: null,
        picId: 'pic-1', teamId: null, raterCount: 2, raters: [rater(`${id}-a`, 'ANA', 'ok'), rater(`${id}-b`, 'BUDI', 'no-account')],
    }],
});
const REPORT: CsiTemplateApplyReport = {
    picsAdded: 5, teamsAdded: 1, ratersAdded: 40, pairsAdded: 120, ratersUnconfirmed: 0, ratersOutsideSites: [], siteAdded: null,
    picsSkippedNoRaters: ['JINGGA FERDASIWI'], picsUnmatched: [], ratersNoAccount: ['ARIEF'], ratersAmbiguous: [], blockedReason: null, committed: false,
};
const fx = vi.hoisted(() => ({ templates: [] as unknown[], report: null as unknown }));
vi.mock('../../../../../api/csiHc.api', () => ({
    CsiHcApi: {
        templates: vi.fn(async () => ({ templates: fx.templates, bundledAvailable: [] })),
        previewPeriodFromTemplates: vi.fn(async () => fx.report),
        createPeriodFromTemplates: vi.fn(async () => ({ periodId: 'p-new', report: { ...(fx.report as object), committed: true } })),
    },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const api = async () => (await import('../../../../../api/csiHc.api')).CsiHcApi;

beforeEach(() => { fx.templates = [template('t-smg', 'SMG'), template('t-krw', 'KRW')]; fx.report = REPORT; });
afterEach(() => { cleanup(); vi.clearAllMocks(); });

/** Fills step 1 and moves to the location step. */
async function openLocations(initialLocation?: string) {
    renderWithQuery(<HcSurveyWizard scope="hc" open onOpenChange={() => undefined} initialLocation={initialLocation} />);
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/tanggal mulai/i), '2026-12-01');
    await userEvent.type(within(dialog).getByLabelText(/tanggal selesai/i), '2026-12-31');
    await userEvent.click(within(dialog).getByRole('button', { name: /lanjut/i }));
    await within(dialog).findByRole('checkbox', { name: /semarang/i });
    return dialog;
}

describe('HcSurveyWizard', () => {
    it('defaults the title and requires an end date not before the start', async () => {
        renderWithQuery(<HcSurveyWizard scope="hc" open onOpenChange={() => undefined} />);
        const dialog = await screen.findByRole('dialog');
        expect(within(dialog).getByLabelText(/judul survei/i)).toHaveValue(`CSI HC ${new Date().getFullYear()}`);
        const next = within(dialog).getByRole('button', { name: /lanjut/i });
        expect(next).toBeDisabled();
        await userEvent.type(within(dialog).getByLabelText(/tanggal mulai/i), '2026-12-10');
        await userEvent.type(within(dialog).getByLabelText(/tanggal selesai/i), '2026-12-01');
        expect(within(dialog).getByText(/tanggal selesai harus/i)).toBeInTheDocument();
        expect(next).toBeDisabled();
    });

    it('rejects a title shorter than 3 or longer than 150 characters', async () => {
        renderWithQuery(<HcSurveyWizard scope="hc" open onOpenChange={() => undefined} />);
        const dialog = await screen.findByRole('dialog');
        await userEvent.type(within(dialog).getByLabelText(/tanggal mulai/i), '2026-12-01');
        await userEvent.type(within(dialog).getByLabelText(/tanggal selesai/i), '2026-12-31');
        const title = within(dialog).getByLabelText(/judul survei/i);
        await userEvent.clear(title);
        await userEvent.type(title, ' ab ');
        expect(within(dialog).getByText('Judul 3–150 karakter.')).toBeInTheDocument();
        expect(within(dialog).getByRole('button', { name: /lanjut/i })).toBeDisabled();
        await userEvent.clear(title);
        await userEvent.click(title);
        await userEvent.paste('x'.repeat(151));
        expect(within(dialog).getByRole('button', { name: /lanjut/i })).toBeDisabled();
        await userEvent.clear(title);
        await userEvent.type(title, 'CSI HC Q4');
        expect(within(dialog).queryByText('Judul 3–150 karakter.')).not.toBeInTheDocument();
        expect(within(dialog).getByRole('button', { name: /lanjut/i })).toBeEnabled();
    });

    it('hands the new survey id to onCreated when the caller navigates', async () => {
        const onCreated = vi.fn();
        renderWithQuery(<HcSurveyWizard scope="hc" open onOpenChange={() => undefined} initialLocation="SMG" onCreated={onCreated} />);
        const dialog = await screen.findByRole('dialog');
        await userEvent.type(within(dialog).getByLabelText(/tanggal mulai/i), '2026-12-01');
        await userEvent.type(within(dialog).getByLabelText(/tanggal selesai/i), '2026-12-31');
        await userEvent.click(within(dialog).getByRole('button', { name: /lanjut/i }));
        await userEvent.click(await within(dialog).findByRole('button', { name: /lanjut/i }));
        await within(dialog).findByText('120');
        await userEvent.click(within(dialog).getByRole('button', { name: /lanjut/i }));
        await userEvent.click(within(dialog).getByRole('button', { name: /buat survei/i }));
        await vi.waitFor(() => expect(onCreated).toHaveBeenCalledWith('p-new'));
    });

    it('locations without template are disabled', async () => {
        const dialog = await openLocations();
        expect(within(dialog).getByRole('checkbox', { name: /sepanjang/i })).toBeDisabled();
        expect(within(dialog).getByRole('checkbox', { name: /jakarta/i })).toBeDisabled();
        expect(within(dialog).getAllByText(/belum ada template/i)).toHaveLength(2);
        expect(within(dialog).getAllByText('1 PIC · 2 penilai · 1 perlu dicek')).toHaveLength(2);
        expect(within(dialog).getByRole('button', { name: /lanjut/i })).toBeDisabled();
    });

    it('wizard sends all checked templateIds', async () => {
        const dialog = await openLocations('SMG');
        expect(within(dialog).getByRole('checkbox', { name: /semarang/i })).toBeChecked();
        await userEvent.click(within(dialog).getByRole('checkbox', { name: /karawang/i }));
        await userEvent.click(within(dialog).getByRole('button', { name: /lanjut/i }));
        expect(await within(dialog).findByText('120')).toBeInTheDocument();
        expect((await api()).previewPeriodFromTemplates).toHaveBeenLastCalledWith('hc', ['t-smg', 't-krw']);
        expect(within(dialog).getByText('6')).toBeInTheDocument();
        await userEvent.click(within(dialog).getByRole('button', { name: /lanjut/i }));
        await userEvent.click(within(dialog).getByRole('button', { name: /buat survei/i }));
        expect((await api()).createPeriodFromTemplates).toHaveBeenCalledWith('hc', {
            title: `CSI HC ${new Date().getFullYear()}`, startDate: '2026-12-01', endDate: '2026-12-31', templateIds: ['t-smg', 't-krw'],
        });
        expect(await within(dialog).findByText(/survei dibuat/i)).toBeInTheDocument();
        expect(within(dialog).getByRole('button', { name: /buat survei/i })).toBeDisabled();
        expect((await import('sonner')).toast.success).toHaveBeenCalledWith('Survei dibuat');
    });

    it('preview shows unconfirmed warning', async () => {
        fx.report = { ...REPORT, ratersUnconfirmed: 7 };
        const dialog = await openLocations('SMG');
        await userEvent.click(within(dialog).getByRole('button', { name: /lanjut/i }));
        expect(await within(dialog).findByText(/7 penilai belum dikonfirmasi/i)).toBeInTheDocument();
        expect(within(dialog).getByText(/Jingga Ferdasiwi/)).toBeInTheDocument();
        expect(within(dialog).getByRole('button', { name: /lanjut/i })).toBeEnabled();
    });

    it('preview warns about raters from another site without blocking', async () => {
        fx.report = { ...REPORT, ratersOutsideSites: ['ELVI CYNTHIA', 'BUDI'] };
        const dialog = await openLocations('SMG');
        await userEvent.click(within(dialog).getByRole('button', { name: /lanjut/i }));
        expect(await within(dialog).findByText('2 penilai berada di site lain dan tidak akan melihat survei ini')).toBeInTheDocument();
        expect(within(dialog).getByText(/Elvi Cynthia, Budi/)).toBeInTheDocument();
        expect(within(dialog).getByRole('button', { name: /lanjut/i })).toBeEnabled();
    });

    it('blocked reason disables create', async () => {
        fx.report = { ...REPORT, blockedReason: 'Template kosong.' };
        const dialog = await openLocations('SMG');
        await userEvent.click(within(dialog).getByRole('button', { name: /lanjut/i }));
        expect(await within(dialog).findByRole('alert')).toHaveTextContent('Template kosong.');
        expect(within(dialog).getByRole('button', { name: /lanjut/i })).toBeDisabled();
    });
});
