import { cleanup, render, renderHook, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import type { CsiTemplate } from '../../../hcTypes';
import { SettingsPanel, useSettingsStatus } from '../SettingsPanel';

const fx = vi.hoisted(() => ({ templates: [] as CsiTemplate[] }));
vi.mock('../../../hooks/useCsi', () => ({
    useCsiSubjects: () => ({ data: [] }), useCsiDimensions: () => ({ data: [] }),
    useCsiRaters: () => ({ data: [] }), useCsiDepartments: () => ({ data: [] }),
}));
vi.mock('../../../hooks/useCsiHc', () => ({
    useCsiPics: () => ({ data: [] }), useCsiReportOwners: () => ({ data: [] }),
    useCsiTemplates: () => ({ data: { templates: fx.templates } }),
}));
vi.mock('../hc/templates/TemplatesTab', () => ({
    TemplatesTab: ({ initialLocation, initialView }: { initialLocation?: string; initialView?: string }) => <p>{`template:${initialLocation}:${initialView}`}</p>,
}));
afterEach(cleanup);

const template = (locationCode: string, status: 'ok' | 'ambiguous'): CsiTemplate => ({
    id: locationCode, scope: 'HC', locationCode, name: locationCode, updatedAt: null,
    summary: { pics: 1, picsUnmatched: 0, picsWithoutRaters: 0, raters: 9, ratersConfirmed: 0, ratersOk: 0, ratersNoAccount: 0, ratersAmbiguous: 9 },
    pics: [{ id: locationCode, area: '', serviceCode: 'HCS', picName: 'PIC', jobTitle: null, serviceFunction: null, picId: null, teamId: null, raterCount: 2,
        raters: [1, 2].map((id) => ({ id: String(id), raterName: 'Andi', raterNik: null, raterJobTitle: null, userId: 'andi', status, confirmed: false })) }],
});

it('HC checklist uses unique template people and worst status across locations', () => {
    fx.templates = [];
    const { result, rerender } = renderHook(() => useSettingsStatus('hc'));
    expect(result.current.find((row) => row.key === 'raters')).toMatchObject({ done: false, hint: 'belum ada template' });
    fx.templates = [template('SMG', 'ok'), template('KRW', 'ambiguous')];
    rerender();
    expect(result.current.find((row) => row.key === 'raters')).toMatchObject({ done: false, hint: '1 perlu dicek' });
    expect(result.current.find((row) => row.key === 'templates')).toMatchObject({ hint: '2 lokasi · 1 perlu dicek' });
    fx.templates = [template('SMG', 'ok'), template('KRW', 'ok')];
    rerender();
    expect(result.current.find((row) => row.key === 'raters')).toMatchObject({ done: true, hint: '1 orang' });
});

it('fix opens the selected template location in per-rater view', async () => {
    fx.templates = [template('KRW', 'ambiguous')];
    render(<SettingsPanel scope="hc" initial="raters" />);
    await userEvent.click(within(screen.getByRole('row', { name: /Karawang/ })).getByRole('button', { name: 'Perbaiki di template' }));
    expect(screen.getByText('template:KRW:rater')).toBeInTheDocument();
});

it('ICT checklist keeps its registered-rater logic', () => {
    fx.templates = [template('SMG', 'ok')];
    const { result } = renderHook(() => useSettingsStatus('ict'));
    expect(result.current.find((row) => row.key === 'raters')).toMatchObject({ done: false, hint: 'belum ada' });
});
