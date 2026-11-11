import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CsiTemplate, CsiTemplateApplyManyReport } from '../../../../../hcTypes';
import type { CsiPeriodDetail } from '../../../../../types';
import { renderWithQuery } from '../../../__tests__/renderWithQuery';
import { HcPairsPanel } from '../../HcPairsPanel';
import { TemplatePullDialog } from '../TemplatePullDialog';

const template = (id: string, locationCode: string): CsiTemplate => ({
    id, scope: 'HC', locationCode, name: `CSI HC – ${locationCode}`, updatedAt: null,
    summary: { pics: 2, picsUnmatched: 0, picsWithoutRaters: 0, raters: 1, ratersConfirmed: 1, ratersOk: 0, ratersNoAccount: 0, ratersAmbiguous: 0 },
    pics: [],
});
const report = (over: Partial<CsiTemplateApplyManyReport> = {}): CsiTemplateApplyManyReport => ({
    picsAdded: 4, teamsAdded: 1, ratersAdded: 12, pairsAdded: 30, ratersUnconfirmed: 2, ratersOutsideSites: ['BUDI'], siteAdded: null,
    picsWithoutRaters: ['JINGGA'], picsUnmatched: [], ratersNoAccount: [], ratersAmbiguous: [], blockedReason: null, committed: false, nonPicRatees: 0, ...over,
});
const fx = vi.hoisted(() => ({ nonPic: 0, fail: null as string | null }));
vi.mock('../../../../../api/csiHc.api', () => ({
    CsiHcApi: {
        templates: vi.fn(async () => ({ templates: [template('t-smg', 'SMG'), template('t-krw', 'KRW')], bundledAvailable: [] })),
        applyTemplates: vi.fn(async (_scope: string, _id: string, _body: unknown, commit: boolean) => {
            if (fx.fail) throw { response: { data: { message: fx.fail } } };
            return report({ committed: commit, nonPicRatees: fx.nonPic });
        }),
    },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const api = async () => (await import('../../../../../api/csiHc.api')).CsiHcApi;

const period = (over: Partial<CsiPeriodDetail> = {}) => ({
    id: 'p1', scope: 'HC', sites: [{ id: 's-smg', code: 'SMG', name: 'Semarang' }], respondentMode: 'LISTED', respondentPicks: false,
    locked: false, ratees: [], raters: [], unitRules: [], ...over,
}) as CsiPeriodDetail;

beforeEach(() => { fx.nonPic = 0; fx.fail = null; });
afterEach(() => { cleanup(); vi.clearAllMocks(); });

async function openDialog() {
    renderWithQuery(<TemplatePullDialog scope="hc" period={period()} open onOpenChange={() => undefined} />);
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(within(dialog).getByRole("checkbox", { name: /semarang/i })).toBeEnabled());
    return dialog;
}

describe('TemplatePullDialog', () => {
    it('preselects the survey site, previews all checked locations and applies them in one call', async () => {
        const dialog = await openDialog();
        expect(within(dialog).getByRole('checkbox', { name: /semarang/i })).toBeChecked();
        expect(within(dialog).getByRole('checkbox', { name: /sepanjang/i })).toBeDisabled();
        await userEvent.click(within(dialog).getByRole('checkbox', { name: /karawang/i }));
        expect(within(dialog).getByRole('button', { name: 'Terapkan' })).toBeDisabled();
        await userEvent.click(within(dialog).getByRole('button', { name: 'Pratinjau' }));
        expect(await within(dialog).findByText('PIC/tim ditambahkan')).toBeInTheDocument();
        expect(within(dialog).getByText('5')).toBeInTheDocument();
        expect(within(dialog).getByText(/1 penilai berada di site lain/)).toBeInTheDocument();
        expect(within(dialog).getByText(/2 penilai belum dikonfirmasi/)).toBeInTheDocument();
        expect((await api()).applyTemplates).toHaveBeenLastCalledWith('hc', 'p1', { templateIds: ['t-smg', 't-krw'], replaceNonPic: false }, false);
        await userEvent.click(within(dialog).getByRole('button', { name: 'Terapkan' }));
        expect((await api()).applyTemplates).toHaveBeenLastCalledWith('hc', 'p1', { templateIds: ['t-smg', 't-krw'], replaceNonPic: false }, true);
        expect(await within(dialog).findByText('Tersimpan.')).toBeInTheDocument();
        expect(within(dialog).getByRole('button', { name: 'Terapkan' })).toBeDisabled();
    });

    it('requires confirming the replacement of non-PIC people before Terapkan, and sends replaceNonPic', async () => {
        fx.nonPic = 3;
        const dialog = await openDialog();
        await userEvent.click(within(dialog).getByRole('button', { name: 'Pratinjau' }));
        const confirm = await within(dialog).findByRole('checkbox', { name: /ganti 3 orang non-PIC dengan PIC dari template/i });
        expect(within(dialog).getByRole('button', { name: 'Terapkan' })).toBeDisabled();
        await userEvent.click(confirm);
        await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Terapkan' })).toBeEnabled());
        expect((await api()).applyTemplates).toHaveBeenLastCalledWith('hc', 'p1', { templateIds: ['t-smg'], replaceNonPic: true }, false);
        await userEvent.click(within(dialog).getByRole('button', { name: 'Terapkan' }));
        await waitFor(async () => expect((await api()).applyTemplates).toHaveBeenLastCalledWith('hc', 'p1', { templateIds: ['t-smg'], replaceNonPic: true }, true));
    });

    it('shows the server error', async () => {
        fx.fail = 'Survei sudah ada jawaban; ambil template hanya untuk survei tanpa jawaban';
        const dialog = await openDialog();
        await userEvent.click(within(dialog).getByRole('button', { name: 'Pratinjau' }));
        expect(await within(dialog).findByRole('alert')).toHaveTextContent('Survei sudah ada jawaban');
    });
});

describe('HcPairsPanel empty state', () => {
    it('offers "Ambil dari template" when the survey has no PIC yet', async () => {
        renderWithQuery(<HcPairsPanel scope="hc" period={period({ ratees: [{ id: 'r', kind: 'PERSON', picId: null } as CsiPeriodDetail['ratees'][number]] })} />);
        expect(screen.getByText(/0 PIC/)).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: /ambil dari template/i }));
        expect(await screen.findByRole('dialog', { name: 'Ambil dari template' })).toBeInTheDocument();
    });

    it('hides the button once the survey has answers', () => {
        renderWithQuery(<HcPairsPanel scope="hc" period={period({ locked: true })} />);
        expect(screen.queryByRole('button', { name: /ambil dari template/i })).not.toBeInTheDocument();
    });
});
