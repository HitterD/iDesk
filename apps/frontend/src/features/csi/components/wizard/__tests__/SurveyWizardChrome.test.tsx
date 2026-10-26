import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SurveyWizard } from '../SurveyWizard';
import type { CsiDimension, CsiPeriodDetail } from '../../../types';

/** Stepper ticks and the "Hapus draft" header action; the step flows live in SurveyWizard.test.tsx. */
const fx = vi.hoisted(() => {
    const STAMP = { createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' };
    return {
        STAMP,
        period: null as unknown as CsiPeriodDetail,
        remove: { mutate: vi.fn(), isPending: false },
        idle: () => ({ mutate: vi.fn(), isPending: false }),
        dimension: { id: 'd1', name: 'Kecepatan', sortOrder: 1, scope: 'ICT', isActive: true, description: null, ...STAMP } as CsiDimension,
        dimensions: [] as CsiDimension[],
    };
});

vi.mock('../../../hooks/useCsi', () => ({
    useCsiPeriod: () => ({ data: fx.period, isLoading: false, isError: false, refetch: () => undefined }),
    useCsiPeriods: () => ({ data: [] }),
    useCsiDimensions: () => ({ data: fx.dimensions, isLoading: false, isError: false }),
    useCreateCsiDimension: fx.idle, useUpdateCsiDimension: fx.idle, useDeactivateCsiDimension: fx.idle,
    useCreateCsiPeriod: fx.idle, useUpdateCsiPeriod: fx.idle, useDeleteCsiPeriod: () => fx.remove,
}));
vi.mock('@/components/site/useActiveSites', () => ({ useActiveSites: () => ({ data: [] }) }));

const period = (over: Partial<CsiPeriodDetail> = {}): CsiPeriodDetail => ({
    id: 'p1', scope: 'ICT', teamEnabled: false, teamLabel: 'Tim IT Support', individualEnabled: true, slaTargetPct: 80, title: 'Survei Q4', intro: '', thankYou: '', startDate: '2026-10-01', endDate: '2026-10-31',
    respondentMode: 'OPEN', createdById: 'a1', sites: [{ id: 's1', code: 'SPJ', name: 'Sidoarjo' }], status: 'ACTIVE',
    publishStatus: 'DRAFT', locked: false, ratees: [], raters: [], ...fx.STAMP,
    readiness: { ready: true, checks: [] }, ...over,
});

const onClose = vi.fn();
const renderWizard = (periodId: string | null) => render(
    <SurveyWizard scope="ict" periodId={periodId} step="info" onStepChange={vi.fn()} onClose={onClose} onCreated={vi.fn()} onPublished={vi.fn()} />,
);
const stepButton = (name: RegExp) => within(screen.getByRole('navigation', { name: 'Langkah pembuatan survei' })).getByRole('button', { name });
const isDone = (name: RegExp) => stepButton(name).textContent?.includes('selesai') ?? false;
const deleteButton = () => screen.queryByRole('button', { name: 'Hapus draft' });

beforeEach(() => {
    vi.clearAllMocks();
    fx.period = period();
    fx.dimensions = [fx.dimension];
});
afterEach(cleanup);

describe('SurveyWizard stepper ticks', () => {
    it('ticks Dimensi only when the scope has an active dimension', () => {
        fx.dimensions = [];
        renderWizard('p1');
        expect(isDone(/Dimensi/)).toBe(false);
        cleanup();
        fx.dimensions = [fx.dimension];
        renderWizard('p1');
        expect(isDone(/Dimensi/)).toBe(true);
    });

    it('ticks Tinjau & terbitkan only once published', () => {
        renderWizard('p1');
        expect(isDone(/Tinjau/)).toBe(false);
        cleanup();
        fx.period = period({ publishStatus: 'PUBLISHED' });
        renderWizard('p1');
        expect(isDone(/Tinjau/)).toBe(true);
    });
});

describe('SurveyWizard Hapus draft', () => {
    it('deletes an abandoned draft and closes to the list', async () => {
        const actor = userEvent.setup();
        fx.remove.mutate.mockImplementation((_id, options) => options?.onSuccess?.());
        renderWizard('p1');

        await actor.click(deleteButton() as HTMLElement);
        await actor.click(await screen.findByRole('button', { name: 'Hapus' }));

        expect(fx.remove.mutate).toHaveBeenCalledWith('p1', expect.anything());
        expect(onClose).toHaveBeenCalled();
    });

    it.each([
        ['while creating', null, {}],
        ['for a published survey', 'p1', { publishStatus: 'PUBLISHED' }],
        ['once answers exist', 'p1', { locked: true }],
    ] as const)('is not offered %s', (_case, periodId, over) => {
        fx.period = period(over);
        renderWizard(periodId);
        expect(deleteButton()).not.toBeInTheDocument();
    });
});
