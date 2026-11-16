import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CsiDimension, CsiPeriodDetail, CsiPeriodRateeDimension } from '../../../types';
import { PeriodQuestionModes } from '../PeriodQuestionModes';

const fx = vi.hoisted(() => ({
    STAMP: { createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' },
    masters: [] as CsiDimension[],
    mutate: vi.fn(),
    isPending: false,
    toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../hooks/useCsi', () => ({
    useCsiDimensions: () => ({ data: fx.masters }),
    useUpdateCsiPeriodQuestions: () => ({ mutate: fx.mutate, isPending: fx.isPending }),
}));
vi.mock('sonner', () => ({ toast: fx.toast }));

const SCALE_OPTS = [
    { label: 'Sangat puas', points: 5 },
    { label: 'Puas', points: 4 },
    { label: 'Netral', points: 3 },
    { label: 'Tidak puas', points: 2 },
    { label: 'Sangat tidak puas', points: 1 },
];

const snapDim = (over: Partial<CsiPeriodRateeDimension> = {}): CsiPeriodRateeDimension => ({
    id: 'prd-1',
    periodRateeId: 'pr-1',
    dimensionId: 'd1',
    dimensionName: 'Kecepatan respon',
    shortLabel: 'Kecepatan',
    type: 'SCALE',
    required: true,
    options: SCALE_OPTS,
    sortOrder: 1,
    ...fx.STAMP,
    ...over,
});

const masterDim = (over: Partial<CsiDimension> = {}): CsiDimension => ({
    id: 'd1',
    scope: 'ICT',
    name: 'Kecepatan respon',
    shortLabel: 'Kecepatan',
    description: null,
    type: 'SCALE',
    required: true,
    options: SCALE_OPTS,
    sortOrder: 1,
    isActive: true,
    ...fx.STAMP,
    ...over,
});

const period = (over: Partial<CsiPeriodDetail> = {}): CsiPeriodDetail => ({
    id: 'p1',
    scope: 'ICT',
    teamEnabled: true,
    teamLabel: 'Tim IT Support',
    individualEnabled: true,
    slaTargetPct: 80,
    title: 'Survei Q4',
    intro: '',
    thankYou: '',
    startDate: '2026-10-01',
    endDate: '2026-10-31',
    respondentMode: 'LISTED',
    createdById: 'a1',
    sites: [{ id: 's1', code: 'SPJ', name: 'Sepanjang' }],
    status: 'ACTIVE',
    publishStatus: 'PUBLISHED',
    locked: false,
    readiness: { ready: true, checks: [] },
    raters: [],
    ratees: [{
        id: 'pr-1',
        periodId: 'p1',
        kind: 'TEAM',
        userId: null,
        displayName: 'Tim IT',
        jobTitle: null,
        sortOrder: 1,
        ...fx.STAMP,
        dimensions: [
            snapDim({ id: 'prd-1', dimensionId: 'd1', dimensionName: 'Kecepatan respon', type: 'SCALE', sortOrder: 1 }),
            snapDim({ id: 'prd-2', dimensionId: 'd2', dimensionName: 'Keramahan', shortLabel: 'Ramah', type: 'SCALE', sortOrder: 2 }),
            snapDim({ id: 'prd-3', dimensionId: 'd3', dimensionName: 'Saran', shortLabel: null, type: 'TEXT', options: [], sortOrder: 3 }),
        ],
    }],
    ...fx.STAMP,
    ...over,
});

beforeEach(() => {
    vi.clearAllMocks();
    fx.isPending = false;
    fx.masters = [
        masterDim({ id: 'd1', name: 'Kecepatan respon', type: 'STAR', options: [] }),
        masterDim({ id: 'd2', name: 'Keramahan', shortLabel: 'Ramah', type: 'SCALE' }),
        masterDim({ id: 'd3', name: 'Saran', shortLabel: null, type: 'TEXT', options: [] }),
    ];
    fx.mutate.mockImplementation((_payload, opts) => opts?.onSuccess?.());
});
afterEach(cleanup);

describe('PeriodQuestionModes', () => {
    it('detects master diffs and syncs + converts all SCALE to STAR when unlocked', async () => {
        const actor = userEvent.setup();
        render(<PeriodQuestionModes scope="ict" period={period()} />);

        const syncBtn = screen.getByRole('button', { name: /Terapkan perubahan dari Pertanyaan master/i });
        expect(syncBtn).toBeEnabled();
        expect(syncBtn).toHaveTextContent('1');
        await actor.click(syncBtn);
        expect(fx.mutate).toHaveBeenCalledWith({ syncFromMaster: true }, expect.any(Object));
        expect(fx.toast.success).toHaveBeenCalledWith('Pembaruan dari Pertanyaan master diterapkan ke survei ini');

        const bulkBtn = screen.getByRole('button', { name: /Ubah semua Skala → Bintang 1–5 \(2\)/i });
        await actor.click(bulkBtn);
        expect(fx.mutate).toHaveBeenCalledWith({ convertScaleToStar: true }, expect.any(Object));
    });

    it('switches one question between SCALE and STAR immediately when unlocked', async () => {
        const actor = userEvent.setup();
        render(<PeriodQuestionModes scope="ict" period={period()} />);

        const group = screen.getByRole('group', { name: 'Mode penilaian Keramahan' });
        await actor.click(within(group).getByRole('button', { name: 'Bintang 1–5' }));
        expect(fx.mutate).toHaveBeenCalledWith(
            { updates: [{ dimensionId: 'd2', type: 'STAR', options: [] }] },
            expect.any(Object),
        );
    });

    it('asks for confirmation before applying mode change when survey already has answers (locked)', async () => {
        const actor = userEvent.setup();
        render(<PeriodQuestionModes scope="ict" period={period({ locked: true })} />);

        await actor.click(screen.getByRole('button', { name: /Ubah semua Skala → Bintang 1–5/i }));
        expect(fx.mutate).not.toHaveBeenCalled();

        expect(screen.getByText('Ubah semua Skala ke Bintang 1–5?')).toBeInTheDocument();
        await actor.click(screen.getByRole('button', { name: 'Ya, terapkan' }));
        expect(fx.mutate).toHaveBeenCalledWith({ convertScaleToStar: true }, expect.any(Object));
    });

    it('renders read-only mode without edit buttons when survey is ENDED or CANCELLED', () => {
        render(<PeriodQuestionModes scope="ict" period={period({ status: 'ENDED' })} />);
        expect(screen.queryByRole('button', { name: /Ubah semua Skala/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Terapkan perubahan/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('group', { name: /Mode penilaian/i })).not.toBeInTheDocument();
    });
});
