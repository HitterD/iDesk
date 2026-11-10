import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import type { CsiTemplate, CsiTemplateRater } from '../../../../hcTypes';
import { RatersTab } from '../../RatersTab';

const fx = vi.hoisted(() => ({ templates: [] as CsiTemplate[] }));
vi.mock('../../../../hooks/useCsiHc', () => ({ useCsiTemplates: () => ({ data: { templates: fx.templates }, isLoading: false }) }));
vi.mock('../../../../hooks/useCsi', () => ({
    useCsiRaters: () => { throw new Error('HC must not load the editable list'); },
    useRemoveCsiRaters: vi.fn(),
}));
afterEach(cleanup);

const rater = (id: string, status: CsiTemplateRater['status'], userId: string | null = id): CsiTemplateRater => ({
    id, status, userId, raterName: id, raterNik: null, raterJobTitle: null, confirmed: status === 'confirmed',
});
const template = (locationCode: string, raters: CsiTemplateRater[]): CsiTemplate => ({
    id: locationCode, scope: 'HC', locationCode, name: locationCode, updatedAt: null,
    summary: { pics: 1, picsUnmatched: 0, picsWithoutRaters: 0, raters: 99, ratersConfirmed: 0, ratersOk: 0, ratersNoAccount: 0, ratersAmbiguous: 0 },
    pics: [{ id: 'pic', area: '', serviceCode: 'HCS', picName: 'PIC', jobTitle: null, serviceFunction: null, picId: null, teamId: null, raterCount: raters.length, raters }],
});

it('location without template shows Buat template', async () => {
    fx.templates = [];
    const onFix = vi.fn();
    render(<RatersTab scope="hc" onFix={onFix} />);
    const krw = screen.getByRole('row', { name: /Karawang/ });
    expect(within(krw).getAllByRole('cell').slice(1, 6).map((cell) => cell.textContent)).toEqual(['—', '—', '—', '—', '—']);
    await userEvent.click(within(krw).getByRole('button', { name: 'Buat template' }));
    expect(onFix).toHaveBeenCalledWith('KRW');
});

it('HC raters tab is read-only summary with fix link', async () => {
    fx.templates = [template('SMG', [rater('a', 'confirmed'), rater('a', 'ok'), rater('b', 'ambiguous', null), rater('c', 'no-account', null)]),
        template('KRW', [rater('a', 'confirmed'), rater('b', 'no-account', null), rater('d', 'confirmed')])];
    const onFix = vi.fn();
    render(<RatersTab scope="hc" onFix={onFix} />);
    expect(screen.getByRole('heading', { name: 'Penilai dari Template penugasan' })).toBeInTheDocument();
    const smg = screen.getByRole('row', { name: /Semarang/ });
    expect(within(smg).getAllByRole('cell').slice(0, 6).map((cell) => cell.textContent)).toEqual(['Semarang', '3', '0', '1', '1', '1']);
    const total = screen.getByRole('row', { name: /Total/ });
    expect(within(total).getAllByRole('cell').slice(0, 6).map((cell) => cell.textContent)).toEqual(['Total', '4', '1', '1', '0', '2']);
    await userEvent.click(within(smg).getByRole('button', { name: 'Perbaiki di template' }));
    expect(onFix).toHaveBeenCalledWith('SMG');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Tambah|Hapus|Impor/ })).not.toBeInTheDocument();
});
