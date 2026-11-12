import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccountSuggestion, CsiTemplate, CsiTemplateRater } from '../../../../../hcTypes';
import { renderWithQuery } from '../../../__tests__/renderWithQuery';
import { TemplatesTab } from '../TemplatesTab';

const rater = (id: string, raterName: string, status: CsiTemplateRater['status'], userId: string | null = null, confirmed = false): CsiTemplateRater =>
    ({ id, raterName, raterNik: null, raterJobTitle: null, userId, status, confirmed });

const TEMPLATE: CsiTemplate = {
    id: 't1', scope: 'HC', locationCode: 'SMG', name: 'CSI HC 2026 – Semarang', updatedAt: null,
    summary: { pics: 2, picsUnmatched: 0, picsWithoutRaters: 0, raters: 6, ratersConfirmed: 1, ratersOk: 2, ratersNoAccount: 1, ratersAmbiguous: 2 },
    pics: [
        {
            id: 'tp-rara', area: 'HC Development', serviceCode: 'HCD', picName: 'RARA KURNIA', jobTitle: null, serviceFunction: null, picId: 'pic-rara', teamId: null, raterCount: 5,
            raters: [
                rater('a', 'ELVI CYNTHIA', 'ok', 'u1'), rater('g', 'GITA SARI', 'ok', 'u7'), rater('b', 'ARIEF NOEGROHO', 'no-account'),
                rater('c', 'AGUS SUBEKTI', 'ambiguous'), rater('d', 'DEWI LESTARI', 'confirmed', 'u4', true),
            ],
        },
        {
            id: 'tp-payroll', area: 'Comben', serviceCode: 'HCC', picName: 'TIM PAYROLL', jobTitle: null, serviceFunction: null, picId: null, teamId: 'team-1', raterCount: 1,
            raters: [rater('e', 'Agus Subekti', 'ambiguous')],
        },
    ],
};
const CLEAN: CsiTemplate = {
    ...TEMPLATE,
    summary: { ...TEMPLATE.summary, raters: 1, ratersOk: 0, ratersNoAccount: 0, ratersAmbiguous: 0 },
    pics: [{ ...TEMPLATE.pics[0], raterCount: 1, raters: [rater('d', 'DEWI LESTARI', 'confirmed', 'u4', true)] }],
};
const SUGGESTIONS: AccountSuggestion[] = [
    { id: 'u-agus', fullName: 'Agus Subekti Prasetyo', email: 'agus@x.id', employeeId: '1234', siteId: 's1', siteCode: 'SMG', department: 'Produksi', score: 0.9 },
    { id: 'u-agus2', fullName: 'Agus Subekti', email: 'agus.s@x.id', employeeId: null, siteId: 's2', siteCode: 'KRW', department: 'Gudang', score: 0.8 },
];
const fx = vi.hoisted(() => ({ template: null as unknown }));
vi.mock('../../../../../api/csiHc.api', () => ({
    CsiHcApi: {
        templates: vi.fn(async () => ({ templates: [fx.template], bundledAvailable: [] })),
        templateAccountSuggestions: vi.fn(async () => SUGGESTIONS),
        setTemplateRaterAccount: vi.fn(async () => fx.template),
        confirmTemplateRaters: vi.fn(async () => fx.template),
        addTemplateRater: vi.fn(async () => fx.template),
        removeTemplateRater: vi.fn(async () => fx.template),
        updateTemplatePic: vi.fn(async () => fx.template),
    },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const api = async () => (await import('../../../../../api/csiHc.api')).CsiHcApi;
const card = (name: RegExp) => screen.findByRole('region', { name });

beforeEach(() => { fx.template = TEMPLATE; });
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('Template raters', () => {
    it('defaults to Per PIC and switches to the per-rater table and back', async () => {
        renderWithQuery(<TemplatesTab scope="hc" />);
        await card(/RARA KURNIA/);
        expect(screen.getByRole('button', { name: 'Per PIC' })).toHaveAttribute('aria-pressed', 'true');
        await userEvent.click(screen.getByRole('button', { name: 'Per penilai' }));
        expect(screen.getByRole('table', { name: 'Daftar per penilai' })).toBeInTheDocument();
        expect(screen.queryByRole('region', { name: /RARA KURNIA/ })).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'Per PIC' }));
        expect(await card(/RARA KURNIA/)).toBeInTheDocument();
        expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('ambiguous badge opens picker and pins account', async () => {
        renderWithQuery(<TemplatesTab scope="hc" />);
        const rara = await card(/RARA KURNIA/);
        await userEvent.click(within(rara).getByRole('button', { name: /pilih akun untuk agus subekti/i }));
        const picker = await screen.findByRole('dialog');
        expect(within(picker).getByRole('combobox', { name: /cari akun/i })).toHaveValue('AGUS SUBEKTI');
        const option = await within(picker).findByRole('option', { name: /Agus Subekti Prasetyo/ });
        expect(option).toHaveTextContent('Produksi · SMG · agus@x.id');
        expect(option).toHaveTextContent('NIK 1234');
        await userEvent.click(option);
        expect((await api()).setTemplateRaterAccount).toHaveBeenCalledWith('hc', ['c'], 'u-agus');
    });

    it('picker is keyboard operable: arrows move the active option, Enter pins it', async () => {
        renderWithQuery(<TemplatesTab scope="hc" />);
        const rara = await card(/RARA KURNIA/);
        await userEvent.click(within(rara).getByRole('button', { name: /pilih akun untuk agus subekti/i }));
        const picker = await screen.findByRole('dialog');
        const search = within(picker).getByRole('combobox', { name: /cari akun/i });
        await within(picker).findAllByRole('option');
        await userEvent.keyboard('{ArrowDown}{ArrowDown}');
        const second = within(picker).getByRole('option', { name: /KRW/ });
        expect(search).toHaveAttribute('aria-activedescendant', second.id);
        expect(second).toHaveAttribute('aria-selected', 'true');
        await userEvent.keyboard('{Enter}');
        expect((await api()).setTemplateRaterAccount).toHaveBeenCalledWith('hc', ['c'], 'u-agus2');
    });

    it('add-rater field exposes the active suggestion to assistive tech', async () => {
        renderWithQuery(<TemplatesTab scope="hc" />);
        const rara = await card(/RARA KURNIA/);
        const input = within(rara).getByRole('combobox', { name: /tambah penilai/i });
        await userEvent.type(input, 'agus');
        await within(rara).findAllByRole('option');
        await userEvent.keyboard('{ArrowDown}');
        expect(input).toHaveAttribute('aria-activedescendant', within(rara).getByRole('option', { name: /Prasetyo/ }).id);
        await userEvent.keyboard('{Escape}');
        expect(within(rara).queryByRole('option')).not.toBeInTheDocument();
        await userEvent.keyboard('{Enter}');
        expect((await api()).addTemplateRater).toHaveBeenCalledWith('hc', 'tp-rara', { name: 'agus' });
    });

    it('lepas akun sends null', async () => {
        renderWithQuery(<TemplatesTab scope="hc" />);
        const rara = await card(/RARA KURNIA/);
        await userEvent.click(within(rara).getByRole('button', { name: /pilih akun untuk elvi cynthia/i }));
        await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /lepas akun/i }));
        expect((await api()).setTemplateRaterAccount).toHaveBeenCalledWith('hc', ['a'], null);
    });

    it('confirm all only touches ok rows', async () => {
        renderWithQuery(<TemplatesTab scope="hc" />);
        const rara = await card(/RARA KURNIA/);
        await userEvent.click(within(rara).getByRole('button', { name: 'Konfirmasi semua (2)' }));
        expect((await api()).confirmTemplateRaters).toHaveBeenCalledWith('hc', ['a', 'g'], true);
        const payroll = screen.getByRole('region', { name: /TIM PAYROLL/ });
        expect(within(payroll).queryByRole('button', { name: /konfirmasi semua/i })).not.toBeInTheDocument();
        expect(within(payroll).getByText('Tim')).toBeInTheDocument();
        expect(within(rara).queryByText('Tim')).not.toBeInTheDocument();
    });

    it('confirms one ok row and undoes a confirmation from the picker', async () => {
        renderWithQuery(<TemplatesTab scope="hc" />);
        const rara = await card(/RARA KURNIA/);
        expect(within(rara).getAllByRole('button', { name: /^konfirmasi (?!semua)/i })).toHaveLength(2);
        await userEvent.click(within(rara).getByRole('button', { name: 'Konfirmasi Elvi Cynthia' }));
        expect((await api()).confirmTemplateRaters).toHaveBeenCalledWith('hc', ['a'], true);
        await userEvent.click(within(rara).getByRole('button', { name: /pilih akun untuk dewi lestari/i }));
        await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /batalkan konfirmasi/i }));
        expect((await api()).confirmTemplateRaters).toHaveBeenLastCalledWith('hc', ['d'], false);
    });

    it('manual add via account sends userId', async () => {
        renderWithQuery(<TemplatesTab scope="hc" />);
        const rara = await card(/RARA KURNIA/);
        await userEvent.type(within(rara).getByRole('combobox', { name: /tambah penilai/i }), 'agus');
        await userEvent.click(await within(rara).findByRole('option', { name: /Agus Subekti Prasetyo/ }));
        expect((await api()).addTemplateRater).toHaveBeenCalledWith('hc', 'tp-rara', { userId: 'u-agus' });
        expect((await api()).templateAccountSuggestions).toHaveBeenCalledWith('hc', 't1', 'agus');
    });

    it('issues panel has no accept-all', async () => {
        renderWithQuery(<TemplatesTab scope="hc" />);
        const panel = await screen.findByRole('region', { name: '2 perlu dicek' });
        expect(within(panel).queryByText(/agus subekti/i)).not.toBeInTheDocument();
        await userEvent.click(within(panel).getByRole('button', { name: 'Lihat' }));
        expect(within(panel).queryByRole('button', { name: /semua/i })).not.toBeInTheDocument();
        const agus = within(panel).getByRole('listitem', { name: /agus subekti/i });
        expect(agus).toHaveTextContent('2 PIC');
        await within(agus).findByText(/Agus Subekti Prasetyo/);
        await userEvent.click(within(agus).getByRole('button', { name: 'Terima' }));
        expect((await api()).setTemplateRaterAccount).toHaveBeenCalledWith('hc', ['c', 'e'], 'u-agus');
        const arief = within(panel).getByRole('listitem', { name: /arief noegroho/i });
        await userEvent.click(within(arief).getByRole('button', { name: 'Biarkan' }));
        expect(within(panel).queryByRole('listitem', { name: /arief noegroho/i })).not.toBeInTheDocument();
    });

    it('issues panel "Pilih lain" opens the picker for every row of that name', async () => {
        renderWithQuery(<TemplatesTab scope="hc" />);
        const panel = await screen.findByRole('region', { name: '2 perlu dicek' });
        await userEvent.click(within(panel).getByRole('button', { name: 'Lihat' }));
        const agus = within(panel).getByRole('listitem', { name: /agus subekti/i });
        await userEvent.click(within(agus).getByRole('button', { name: 'Pilih lain' }));
        await userEvent.click(await within(await screen.findByRole('dialog')).findByRole('option', { name: /KRW/ }));
        expect((await api()).setTemplateRaterAccount).toHaveBeenCalledWith('hc', ['c', 'e'], 'u-agus2');
    });

    it('issues panel hidden when nothing to check', async () => {
        fx.template = CLEAN;
        renderWithQuery(<TemplatesTab scope="hc" />);
        await card(/RARA KURNIA/);
        expect(screen.queryByText(/perlu dicek/i)).not.toBeInTheDocument();
        expect(within(screen.getByRole('list', { name: 'Ringkasan template' })).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
            '2 PIC', '1 penilai', '1 terkonfirmasi', '0 cocok otomatis', '0 nama ganda', '0 belum punya akun',
        ]);
    });
});

describe('Template card layout (narrow cards)', () => {
    it('status badge carries a compact dot named by the status label', async () => {
        renderWithQuery(<TemplatesTab scope="hc" />);
        const rara = await card(/RARA KURNIA/);
        const badge = within(rara).getByRole('button', { name: /pilih akun untuk arief noegroho/i });
        expect(badge).toHaveAccessibleName(/Belum punya akun/);
        expect(badge.title).toMatch(/^Belum punya akun/);
        expect(badge.querySelector('[data-status-dot]')).toHaveAttribute('aria-hidden', 'true');
        // Full label stays a whole word sequence (never cut mid-word): it is hidden as a unit in compact mode.
        expect(within(badge).getByText('Belum punya akun')).toHaveClass('whitespace-nowrap');
    });

    it('rater list scrolls vertically only and names are truncated with a tooltip', async () => {
        renderWithQuery(<TemplatesTab scope="hc" />);
        const rara = await card(/RARA KURNIA/);
        const list = within(rara).getAllByRole('list')[0];
        expect(list).toHaveClass('overflow-y-auto', 'overflow-x-hidden');
        expect(list).not.toHaveClass('overflow-auto');
        expect(within(list).getByText('Elvi Cynthia')).toHaveAttribute('title', 'Elvi Cynthia');
        expect(rara).toHaveClass('min-w-0');
    });

    it('PIC name is clamped to two lines with the full name as tooltip', async () => {
        renderWithQuery(<TemplatesTab scope="hc" />);
        const rara = await card(/RARA KURNIA/);
        const name = within(rara).getByText('Rara Kurnia');
        expect(name).toHaveClass('line-clamp-2');
        expect(name).toHaveAttribute('title', 'Rara Kurnia');
    });
});
