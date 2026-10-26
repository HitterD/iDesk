import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CsiDimension, CsiPeriodDetail } from '../../../types';
import { StepTeam } from '../StepTeam';

const hooks = vi.hoisted(() => ({ mutate: vi.fn(), questions: [] as CsiDimension[] }));
vi.mock('../../../hooks/useCsi', () => ({
    useCsiDimensions: () => ({ data: hooks.questions, isLoading: false }),
    useSetCsiTeamQuestions: () => ({ mutate: hooks.mutate, isPending: false }),
}));

const STAMP = { createdAt: '', updatedAt: '' };
const question = (id: string, name: string, type: CsiDimension['type'] = 'STAR'): CsiDimension => ({
    id, name, type, scope: 'ICT', isActive: true, sortOrder: 0, description: null, required: true, options: [], ...STAMP,
});
const teamRatee = (ids: string[]): CsiPeriodDetail['ratees'][number] => ({
    id: 'team', periodId: 'p1', kind: 'TEAM', userId: null, displayName: 'Tim IT Support', jobTitle: null, sortOrder: 0, ...STAMP,
    dimensions: ids.map((dimensionId, index) => ({
        id: `t-${dimensionId}`, periodRateeId: 'team', dimensionId, dimensionName: dimensionId, type: 'STAR', required: true, options: [], sortOrder: index, ...STAMP,
    })),
});
const period = (ids: string[], locked = false): CsiPeriodDetail => ({
    id: 'p1', scope: 'ICT', sites: [], title: 'Q4', intro: '', thankYou: '', startDate: '2026-10-01', endDate: '2026-10-31',
    respondentMode: 'OPEN', publishStatus: 'DRAFT', teamEnabled: true, teamLabel: 'Tim IT Support', individualEnabled: true, slaTargetPct: 80,
    createdById: 'a', status: 'ACTIVE', locked, readiness: { ready: false, checks: [] }, raters: [], ratees: [teamRatee(ids)], ...STAMP,
});

const ITEMS = ['q1', 'q2', 'q3'];
beforeEach(() => {
    hooks.mutate.mockReset();
    hooks.questions = [question('q1', 'Kecepatan'), question('q2', 'Keramahan', 'CHOICE'), question('q3', 'Saran', 'TEXT')];
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function mock(this: Element) {
        const index = ITEMS.indexOf(this.getAttribute('data-sortable-id') ?? '');
        const top = Math.max(index, 0) * 60;
        return { x: 0, y: top, top, left: 0, width: 300, height: 50, right: 300, bottom: top + 50, toJSON: () => ({}) };
    });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('StepTeam', () => {
    it('lists active questions with a type chip and saves the selection', async () => {
        const actor = userEvent.setup();
        render(<StepTeam scope="ict" period={period([])} />);
        expect(screen.getByText('Bintang 1–5')).toBeInTheDocument();
        expect(screen.getByText('Jawaban teks')).toBeInTheDocument();
        await actor.click(screen.getByRole('checkbox', { name: 'Kecepatan' }));
        await actor.click(screen.getByRole('checkbox', { name: 'Saran' }));
        await actor.click(screen.getByRole('button', { name: 'Simpan' }));
        expect(hooks.mutate).toHaveBeenCalledWith({ questionIds: ['q1', 'q3'] });
    });

    it('team step saves selected questions in dragged order', async () => {
        const actor = userEvent.setup();
        render(<StepTeam scope="ict" period={period(['q1', 'q2', 'q3'])} />);
        const handles = screen.getAllByRole('button', { name: 'Ubah urutan pertanyaan tim' });
        expect(handles).toHaveLength(3);
        handles[0].focus();
        await actor.keyboard(' ');
        await actor.keyboard('{ArrowDown}');
        await actor.keyboard(' ');
        await actor.click(screen.getByRole('button', { name: 'Simpan' }));
        expect(hooks.mutate).toHaveBeenCalledWith({ questionIds: ['q2', 'q1', 'q3'] });
    });

    it('removes a question from the selection and reports dirty state', async () => {
        const onDirty = vi.fn();
        const actor = userEvent.setup();
        render(<StepTeam scope="ict" period={period(['q1', 'q2'])} onDirtyChange={onDirty} />);
        expect(onDirty).toHaveBeenLastCalledWith(false);
        expect(screen.getByRole('button', { name: 'Simpan' })).toBeDisabled();
        await actor.click(screen.getByRole('button', { name: 'Hapus Keramahan dari penilaian tim' }));
        expect(onDirty).toHaveBeenLastCalledWith(true);
        expect(screen.getByText('Ada perubahan yang belum disimpan')).toBeInTheDocument();
        await actor.click(screen.getByRole('button', { name: 'Simpan' }));
        expect(hooks.mutate).toHaveBeenCalledWith({ questionIds: ['q1'] });
    });

    it('is read-only with a note when the survey is locked', () => {
        render(<StepTeam scope="ict" period={period(['q1'], true)} />);
        expect(screen.getByText('Terkunci karena sudah ada jawaban')).toBeInTheDocument();
        expect(screen.getByRole('checkbox', { name: 'Kecepatan' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Simpan' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Ubah urutan pertanyaan tim' })).toBeDisabled();
    });
});
