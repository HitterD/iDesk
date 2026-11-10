import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CsiTemplate, CsiTemplateRater } from '../../../../../hcTypes';
import { renderWithQuery } from '../../../__tests__/renderWithQuery';
import { RaterTableView } from '../RaterTableView';

const rater = (id: string, name: string, status: CsiTemplateRater['status'], userId: string | null, nik: string | null = null): CsiTemplateRater =>
    ({ id, raterName: name, raterNik: nik, raterJobTitle: null, status, userId, confirmed: status === 'confirmed' });
const TEMPLATE: CsiTemplate = {
    id: 't1', scope: 'HC', locationCode: 'SMG', name: 'Semarang', updatedAt: null,
    summary: { pics: 2, picsUnmatched: 0, picsWithoutRaters: 0, raters: 4, ratersConfirmed: 0, ratersOk: 2, ratersNoAccount: 1, ratersAmbiguous: 1 },
    pics: ['RARA', 'TIM PAYROLL'].map((picName, i) => ({
        id: `p${i}`, area: 'Comben', serviceCode: 'HCC', picName, jobTitle: null, serviceFunction: null, picId: null, teamId: null, raterCount: 2,
        raters: [rater(`ok${i}`, 'BUDI', 'ok', 'u1', '001234'), rater(`issue${i}`, i ? 'AGUS' : 'ARIEF', i ? 'ambiguous' : 'no-account', null)],
    })),
};
vi.mock('../../../../../api/csiHc.api', () => ({
    CsiHcApi: {
        confirmTemplateRaters: vi.fn(async () => TEMPLATE),
        templateAccountSuggestions: vi.fn(async () => [{ id: 'u2', fullName: 'Budi Baru', email: 'b@x.id', employeeId: null, siteId: null, siteCode: null, department: null, score: 1 }]),
        setTemplateRaterAccount: vi.fn(async () => TEMPLATE),
    },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const api = async () => (await import('../../../../../api/csiHc.api')).CsiHcApi;
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('RaterTableView', () => {
    it('defaults to Perlu dicek when issues exist', () => {
        renderWithQuery(<RaterTableView scope="hc" template={TEMPLATE} />);
        expect(screen.getByRole('button', { name: 'Perlu dicek' })).toHaveAttribute('aria-pressed', 'true');
        const table = screen.getByRole('table');
        expect(within(table).getByText('ARIEF')).toBeInTheDocument();
        expect(within(table).getByText('AGUS')).toBeInTheDocument();
        expect(within(table).queryByText('BUDI')).not.toBeInTheDocument();
    });

    it('search filters by NIK', async () => {
        renderWithQuery(<RaterTableView scope="hc" template={TEMPLATE} />);
        await userEvent.click(screen.getByRole('button', { name: 'Semua' }));
        await userEvent.type(screen.getByRole('searchbox'), '00123');
        expect(within(screen.getByRole('table')).getByText('BUDI')).toBeInTheDocument();
        expect(screen.queryByText('ARIEF')).not.toBeInTheDocument();
        await userEvent.clear(screen.getByRole('searchbox'));
        await userEvent.type(screen.getByRole('searchbox'), 'nobody');
        expect(screen.getByText('Tidak ada penilai yang sesuai.')).toBeInTheDocument();
    });

    it('expands PIC names and changes account for all assignments', async () => {
        renderWithQuery(<RaterTableView scope="hc" template={TEMPLATE} />);
        await userEvent.click(screen.getByRole('button', { name: 'Cocok otomatis' }));
        const disclosure = screen.getByRole('button', { name: 'Menilai 2 PIC: BUDI' });
        await userEvent.click(disclosure);
        expect(disclosure).toHaveAttribute('aria-expanded', 'true');
        expect(within(screen.getByRole('list', { name: 'PIC yang dinilai BUDI' })).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['RARA', 'TIM PAYROLL']);
        await userEvent.click(screen.getByRole('button', { name: /Pilih akun untuk BUDI/ }));
        await userEvent.click(await screen.findByRole('option', { name: /Budi Baru/ }));
        expect((await api()).setTemplateRaterAccount).toHaveBeenCalledWith('hc', ['ok0', 'ok1'], 'u2');
    });

    it('defaults to Semua without issues and loads 50 rows at a time, resetting pagination on search', async () => {
        const clean = { ...TEMPLATE, pics: [{ ...TEMPLATE.pics[0], raters: Array.from({ length: 51 }, (_, i) => rater(`r${i}`, `Penilai ${String(i).padStart(2, '0')}`, 'confirmed', `u${i}`)) }] };
        renderWithQuery(<RaterTableView scope="hc" template={clean} />);
        expect(screen.getByRole('button', { name: 'Semua' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getAllByRole('row')).toHaveLength(51);
        await userEvent.click(screen.getByRole('button', { name: 'Muat lebih banyak' }));
        expect(screen.getAllByRole('row')).toHaveLength(52);
        expect(screen.queryByRole('button', { name: 'Muat lebih banyak' })).not.toBeInTheDocument();
        await userEvent.type(screen.getByRole('searchbox'), 'Penilai');
        expect(screen.getAllByRole('row')).toHaveLength(51);
    });

    it('confirm applies to all raterIds', async () => {
        renderWithQuery(<RaterTableView scope="hc" template={TEMPLATE} />);
        await userEvent.click(screen.getByRole('button', { name: 'Cocok otomatis' }));
        await userEvent.click(screen.getByRole('button', { name: 'Konfirmasi BUDI' }));
        expect((await api()).confirmTemplateRaters).toHaveBeenCalledWith('hc', ['ok0', 'ok1'], true);
    });
});
