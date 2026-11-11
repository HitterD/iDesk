import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CsiHcRecap, CsiLocationCode } from '../../../../hcTypes';
import { HcRecapPanel } from '../HcRecapPanel';

const GREEN_INK = 'text-[hsl(var(--ticket-green-ink))]';
const cell = (average: number | null, ratings: number) => ({ average, ratings });
const NONE = { SJA1: cell(null, 0), SJA2: cell(null, 0), SJA3: cell(null, 0), SJA4: cell(null, 0), JKT: cell(null, 0) };
const cells = (average: number | null, ratings: number, at: Partial<Record<CsiLocationCode, ReturnType<typeof cell>>> = {}) => ({
    all: cell(average, ratings), byLocation: { ...NONE, SJA4: cell(average, ratings), ...at },
});
const row = (level: 'service' | 'bagian' | 'pic', serviceCode: string, label: string, average: number) => ({
    level, key: `${level}:${serviceCode}:${label}`, label, serviceCode, bagian: level === 'service' ? null : label, jobTitle: null,
    serviceFunction: null, ...cells(average, 4), dimensions: { Knowledge: average }, respondents: 4, picId: null,
});

const fx = vi.hoisted(() => ({ recap: null as unknown as CsiHcRecap }));
vi.mock('../../../../hooks/useCsiHc', () => ({
    useCsiHcRecap: () => ({ data: fx.recap, isLoading: false, isError: false, refetch: vi.fn() }),
}));

const RECAP: CsiHcRecap = {
    period: { id: 'p1', title: 'CSI HC', startDate: '2026-11-01', endDate: '2026-11-30' },
    scoreBands: { fairMin: 3.5, goodMin: 4.2 },
    dimensions: ['Knowledge'],
    locations: [{ code: 'SJA4', label: 'SJA 4' }, { code: 'JKT', label: 'Jakarta' }],
    overall: { ...cells(4.3, 12), dimensions: { Knowledge: 4.3 }, respondents: 6 },
    services: [row('service', 'HCD', 'HCD · HC Development', 4.3), row('service', 'HCC', 'HCC · HC Center', 4.1), row('service', 'HCS', 'HCS · HC Services', 3.4)],
    respondentGroups: [
        { level: 'division', key: 'd:FIN', label: 'FINANCE · AKUNTANSI', division: 'FINANCE', department: 'AKUNTANSI', respondents: 4, all: cell(4.3, 8) },
        {
            level: 'division', key: 'd:small', label: 'Departemen kecil (gabungan)', division: 'Departemen kecil (gabungan)', department: null, respondents: 2,
            all: cell(null, 4),
        },
    ],
    respondents: [],
};

afterEach(cleanup);

describe('HcRecapPanel', () => {
    it('colours scores with the survey bands from the payload (4,30 is green with 3,5 / 4,2)', () => {
        fx.recap = RECAP;
        render(<HcRecapPanel scope="hc" periodId="p1" />);
        const overall = screen.getByRole('group', { name: 'ALL SJA' });
        expect(within(overall).getByText('4,30')).toHaveClass(GREEN_INK);
    });

    it('a custom team row sits directly under its layanan: visible with the layanan open, no bagian to expand', () => {
        const base = row('pic', 'HCS', 'TIM RECEPTION', 4.1);
        fx.recap = {
            ...RECAP, services: [
                { ...row('service', 'HCS', 'HCS · HC Services', 3.4), key: 's:HCS' },
                { ...row('bagian', 'HCS', 'GA MANAGEMENT', 3.4), key: 'b:HCS:GA MANAGEMENT' },
                { ...row('pic', 'HCS', 'CICI', 3.4), key: 'p:c', bagian: 'GA MANAGEMENT' },
                { ...base, key: 'p:t', label: 'Tim · TIM RECEPTION', bagian: null, team: true },
            ],
        };
        render(<HcRecapPanel scope="hc" periodId="p1" />);
        expect(screen.getByText('Tim · TIM RECEPTION')).toBeInTheDocument();
        // The bagian is closed by default, so its PIC is hidden; the team is not behind a bagian.
        expect(screen.queryByText('Cici')).toBeNull();
    });

    it('keeps the layanan order of the payload (HCD, HCC, HCS)', () => {
        fx.recap = RECAP;
        render(<HcRecapPanel scope="hc" periodId="p1" />);
        const labels = screen.getAllByRole('button').map((button) => button.textContent ?? '').filter((text) => /^HC[DCS] ·/.test(text));
        expect(labels).toEqual(['HCD · HC Development', 'HCC · HC Center', 'HCS · HC Services']);
    });

    it('respondent table has no location columns; a masked total (under 3 respondents) shows "–"', async () => {
        fx.recap = RECAP;
        render(<HcRecapPanel scope="hc" periodId="p1" />);
        await userEvent.setup().click(screen.getByRole('button', { name: 'Per divisi responden' }));
        const headers = screen.getAllByRole('columnheader').map((header) => header.textContent);
        expect(headers).toEqual(['Divisi / Departemen / Bagian responden', 'Semua lokasi', 'Responden']);
        const small = screen.getByRole('row', { name: /Departemen kecil \(gabungan\)/i });
        expect(within(small).queryByText(/\d,\d\d/)).toBeNull();
        expect(within(small).getByTitle(/disembunyikan/i)).toHaveTextContent('–');
        expect(within(small).getByText('2')).toBeInTheDocument();
        const finance = screen.getByRole('row', { name: /FINANCE · AKUNTANSI/i });
        expect(within(finance).getByText('4,30')).toBeInTheDocument();
        expect(within(finance).getByText('4')).toBeInTheDocument();
    });

    it('service × location cells masked by the backend show "–" with the hidden title', () => {
        fx.recap = { ...RECAP, services: [{ ...RECAP.services[0], byLocation: { ...NONE, SJA4: cell(4.3, 4), JKT: cell(null, 1) } }] };
        render(<HcRecapPanel scope="hc" periodId="p1" />);
        const row = screen.getByRole('row', { name: /HCD · HC Development/ });
        expect(within(row).getByTitle(/disembunyikan/i)).toHaveTextContent('–');
    });
});
