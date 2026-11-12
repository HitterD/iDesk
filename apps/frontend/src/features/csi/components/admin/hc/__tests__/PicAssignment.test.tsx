import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CsiPicView, CsiTemplate } from '../../../../hcTypes';
import type { CsiPeriodDetail } from '../../../../types';
import { PicAssignment } from '../PicAssignment';

const pic = (id: string, fullName: string, serviceCode = 'HCS'): CsiPicView => ({
    id, nik: id, fullName, jobTitle: null, serviceCode, serviceName: 'HC Services', serviceFunction: null, bagian: 'HC SERVICES',
    workLocation: null, siteId: null, userId: null, photoUrl: null, isActive: true,
});
const template = (locationCode: string, picIds: string[]): CsiTemplate => ({
    id: `t-${locationCode}`, scope: 'HC', locationCode, name: locationCode, updatedAt: null,
    summary: { pics: picIds.length, picsUnmatched: 0, picsWithoutRaters: 0, raters: 0, ratersConfirmed: 0, ratersOk: 0, ratersNoAccount: 0, ratersAmbiguous: 0 },
    pics: picIds.map((picId) => ({ id: `tp-${picId}`, area: '', serviceCode: 'HCS', picName: picId, jobTitle: null, serviceFunction: null, picId, teamId: null, raterCount: 0, raters: [] })),
});

const fx = vi.hoisted(() => ({
    pics: [] as CsiPicView[], templates: [] as CsiTemplate[], templatesLoading: false, save: vi.fn(),
}));
vi.mock('../../../../hooks/useCsiHc', () => ({
    useCsiPics: () => ({ data: fx.pics, isLoading: false }),
    useCsiTemplates: () => (fx.templatesLoading ? { data: undefined, isLoading: true } : { data: { templates: fx.templates, bundledAvailable: [] }, isLoading: false }),
    useSetCsiPeriodPics: () => ({ mutate: fx.save, isPending: false }),
}));
vi.mock('../../../../hooks/useCsi', () => ({ useCsiDimensions: () => ({ data: [{ id: 'd1', name: 'Knowledge', shortLabel: null, type: 'STAR' }] }) }));
afterEach(cleanup);

const ratee = (picId: string) => ({ id: `r-${picId}`, kind: 'PERSON', picId, dimensions: [{ dimensionId: 'd1' }] });
const period = (siteCodes: string[], picIds: string[] = []) => ({
    id: 'p1', scope: 'HC', locked: false, respondentPicks: true, respondentMode: 'LISTED',
    sites: siteCodes.map((code) => ({ id: `s-${code}`, code, name: code })), ratees: picIds.map(ratee),
}) as unknown as CsiPeriodDetail;

const filterGroup = () => screen.getByRole('group', { name: 'Lokasi template' });
const chip = (name: RegExp | string) => within(filterGroup()).getByRole('button', { name });

describe('PicAssignment location filter', () => {
    beforeEach(() => {
        fx.pics = [pic('a', 'ANI'), pic('b', 'BUDI'), pic('c', 'CICI'), pic('d', 'DEDE')];
        fx.templates = [template('KRW', ['a', 'b']), template('SMG', ['c'])];
        fx.templatesLoading = false;
    });

    it('holds the list back until the templates are loaded (no counter jump)', () => {
        fx.templatesLoading = true;
        const { rerender } = render(<PicAssignment scope="hc" period={period(['SMG'])} />);
        expect(screen.queryByText(/PIC dipilih/)).toBeNull();
        fx.templatesLoading = false;
        rerender(<PicAssignment scope="hc" period={period(['SMG'])} />);
        expect(screen.getByText('0 dari 1 PIC dipilih')).toBeInTheDocument();
    });

    it('lists only locations with a template (fixed order, with hint) and defaults to the survey sites', () => {
        render(<PicAssignment scope="hc" period={period(['SMG', 'SPJ'])} />);
        expect(within(filterGroup()).getAllByRole('button').map((button) => button.textContent)).toEqual(['Semua PIC', 'Karawang (SJA 2)', 'Semarang (SJA Semarang)']);
        expect(chip(/Semarang/)).toHaveAttribute('aria-pressed', 'true');
        expect(chip(/Karawang/)).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByText('Cici')).toBeInTheDocument();
        expect(screen.queryByText('Ani')).toBeNull();
        expect(screen.getByText('0 dari 1 PIC dipilih')).toBeInTheDocument();
        expect(screen.getByText('Tim custom diambil lewat Ambil dari template.')).toBeInTheDocument();
    });

    it('a survey without a template site starts on Semua PIC', () => {
        render(<PicAssignment scope="hc" period={period(['SPJ'])} />);
        expect(chip('Semua PIC')).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByText('0 dari 4 PIC dipilih')).toBeInTheDocument();
    });

    it('multi-select widens the list; Pilih semua only adds the filtered PICs', async () => {
        render(<PicAssignment scope="hc" period={period(['SMG'])} />);
        await userEvent.click(chip(/Karawang/));
        expect(['Ani', 'Budi', 'Cici'].every((name) => screen.queryByText(name))).toBe(true);
        expect(screen.queryByText('Dede')).toBeNull();
        await userEvent.click(screen.getByRole('button', { name: 'Pilih semua' }));
        expect(screen.getByText('3 dari 3 PIC dipilih')).toBeInTheDocument();
        await userEvent.click(chip('Semua PIC'));
        expect(screen.getByText('3 dari 4 PIC dipilih')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'Simpan PIC' }));
        expect(fx.save.mock.calls[0][0].picIds.sort()).toEqual(['a', 'b', 'c']);
    });

    it('selected PICs outside the filter stay selected and are counted', async () => {
        render(<PicAssignment scope="hc" period={period(['SMG'], ['a', 'd', 'c'])} />);
        expect(screen.getByText('1 dari 1 PIC dipilih')).toBeInTheDocument();
        expect(screen.getByText('Dipilih di luar filter (2)')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'Kosongkan' }));
        expect(screen.getByText('0 dari 1 PIC dipilih')).toBeInTheDocument();
        expect(screen.getByText('Dipilih di luar filter (2)')).toBeInTheDocument();
    });
});
