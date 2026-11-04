import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CsiAssignments, CsiPeriodDetail } from '../../../types';
import { StepPairs } from '../StepPairs';

const hooks = vi.hoisted(() => ({ mutate: vi.fn(), view: null as CsiAssignments | null }));

vi.mock('../../../hooks/useCsi', () => ({
    useCsiAssignments: () => ({ data: hooks.view }),
    useSaveCsiAssignments: () => ({ mutate: hooks.mutate, isPending: false }),
}));
vi.mock('../../admin/assignment/AssignmentMatrix', () => ({ AssignmentMatrix: () => <div data-testid="matrix" /> }));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));

const STAMP = { createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' };
const period = (over: Partial<CsiPeriodDetail> = {}): CsiPeriodDetail => ({
    id: 'p1', scope: 'ICT', teamEnabled: true, teamLabel: 'Tim IT', individualEnabled: true, slaTargetPct: 80, title: 'CSI', intro: '', thankYou: '',
    startDate: '2026-10-01', endDate: '2026-10-31', respondentMode: 'LISTED', createdById: 'a1', publishStatus: 'DRAFT',
    readiness: { ready: false, checks: [] }, sites: [], status: 'UPCOMING', locked: false, ratees: [],
    raters: [{ id: 'pr1', periodId: 'p1', userId: 'u1', user: { id: 'u1', fullName: 'Rina', email: 'r@x', jobTitle: null } }] as unknown as CsiPeriodDetail['raters'],
    ...STAMP, ...over,
});
const view = (pairs: CsiAssignments['pairs']): CsiAssignments => ({ raters: [], ratees: [], pairs });

beforeEach(() => { hooks.mutate.mockReset(); hooks.view = view([]); });
afterEach(cleanup);

describe('StepPairs', () => {
    it('defaults to "everyone rates everyone" while no pairs are saved (no matrix shown)', () => {
        render(<StepPairs scope="ict" period={period()} onDirtyChange={vi.fn()} />);
        expect(screen.getByRole('radio', { name: /Semua penilai menilai semua subjek/ })).toHaveAttribute('aria-checked', 'true');
        expect(screen.queryByTestId('matrix')).not.toBeInTheDocument();
    });

    it('"Atur per tim / orang" opens the matrix; a mapped period starts there', async () => {
        const actor = userEvent.setup();
        const { unmount } = render(<StepPairs scope="ict" period={period()} onDirtyChange={vi.fn()} />);
        await actor.click(screen.getByRole('radio', { name: /Atur per tim/ }));
        expect(screen.getByTestId('matrix')).toBeInTheDocument();
        unmount();
        hooks.view = view([{ periodRaterId: 'pr1', periodRateeId: 'r1' }]);
        render(<StepPairs scope="ict" period={period()} onDirtyChange={vi.fn()} />);
        expect(screen.getByRole('radio', { name: /Atur per tim/ })).toHaveAttribute('aria-checked', 'true');
    });

    it('switching back to "everyone" clears the saved pairs', async () => {
        hooks.view = view([{ periodRaterId: 'pr1', periodRateeId: 'r1' }]);
        const actor = userEvent.setup();
        render(<StepPairs scope="ict" period={period()} onDirtyChange={vi.fn()} />);
        await actor.click(screen.getByRole('radio', { name: /Semua penilai menilai semua subjek/ }));
        expect(hooks.mutate).toHaveBeenCalledWith([], expect.anything());
    });

    it('locked period cannot change the mode', () => {
        render(<StepPairs scope="ict" period={period({ locked: true })} onDirtyChange={vi.fn()} />);
        expect(screen.getByRole('radio', { name: /Atur per tim/ })).toBeDisabled();
        expect(screen.getByText('Terkunci karena sudah ada jawaban')).toBeInTheDocument();
    });
});
