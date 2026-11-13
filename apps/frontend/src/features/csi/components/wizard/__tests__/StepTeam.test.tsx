import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CsiDimension, CsiPeriodDetail } from '../../../types';
import { StepTeam } from '../StepTeam';

const hooks = vi.hoisted(() => ({ mutate: vi.fn(), mutateAsync: vi.fn(), applyTemplate: vi.fn(), questions: [] as CsiDimension[], sets: [] as any[] }));
vi.mock('../../../hooks/useCsi', () => ({
    useCsiDimensions: () => ({ data: hooks.questions, isLoading: false }),
    useCsiQuestionSets: () => ({ data: hooks.sets }),
    useApplyCsiTemplate: () => ({ mutateAsync: hooks.applyTemplate, isPending: false }),
    useSetCsiTeamQuestions: () => ({ mutate: hooks.mutate, mutateAsync: hooks.mutateAsync, isPending: false }),
}));

const STAMP = { createdAt: '', updatedAt: '' };
const question = (id: string, name: string, type: CsiDimension['type'] = 'STAR'): CsiDimension => ({
    id, name, type, scope: 'ICT', isActive: true, sortOrder: 0, description: null, required: true, options: [], ...STAMP,
});
const SPJ = { id: 's-spj', code: 'SPJ', name: 'Sepanjang' };
const KRW = { id: 's-krw', code: 'KRW', name: 'Karawang' };
const teamRatee = (ids: string[], siteId = SPJ.id): CsiPeriodDetail['ratees'][number] => ({
    id: `team-${siteId}`, periodId: 'p1', kind: 'TEAM', userId: null, siteId, displayName: 'Tim', jobTitle: null, sortOrder: 0, ...STAMP,
    dimensions: ids.map((dimensionId, index) => ({
        id: `t-${dimensionId}`, periodRateeId: `team-${siteId}`, dimensionId, dimensionName: dimensionId, type: 'STAR', required: true, options: [], sortOrder: index, ...STAMP,
    })),
});
const period = (ids: string[], locked = false, extra: Partial<CsiPeriodDetail> = {}): CsiPeriodDetail => ({
    id: 'p1', scope: 'ICT', sites: [SPJ], title: 'Q4', intro: '', thankYou: '', startDate: '2026-10-01', endDate: '2026-10-31',
    respondentMode: 'OPEN', publishStatus: 'DRAFT', teamEnabled: true, teamLabel: 'Tim IT Support', individualEnabled: true, slaTargetPct: 80,
    createdById: 'a', status: 'ACTIVE', locked, readiness: { ready: false, checks: [] }, raters: [], ratees: [teamRatee(ids)], ...STAMP, ...extra,
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
        expect(hooks.mutate).toHaveBeenCalledWith({ siteId: SPJ.id, questionIds: ['q1', 'q3'] });
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
        expect(hooks.mutate).toHaveBeenCalledWith({ siteId: SPJ.id, questionIds: ['q2', 'q1', 'q3'] });
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
        expect(hooks.mutate).toHaveBeenCalledWith({ siteId: SPJ.id, questionIds: ['q1'] });
    });

    it('is read-only with a note when the survey is locked', () => {
        render(<StepTeam scope="ict" period={period(['q1'], true)} />);
        expect(screen.getByText('Terkunci karena sudah ada jawaban')).toBeInTheDocument();
        expect(screen.getByRole('checkbox', { name: 'Kecepatan' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Simpan' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Ubah urutan pertanyaan tim' })).toBeDisabled();
    });

    it('shows one team picker per period site and saves each with its own siteId', async () => {
        const actor = userEvent.setup();
        render(<StepTeam scope="ict" period={period(['q1'], false, { sites: [SPJ, KRW], ratees: [teamRatee(['q1'], SPJ.id)] })} />);
        const spj = screen.getByRole('region', { name: 'Tim Sepanjang' });
        const krw = screen.getByRole('region', { name: 'Tim Karawang' });
        expect(within(spj).getByRole('checkbox', { name: 'Kecepatan' })).toBeChecked();
        expect(within(krw).getByRole('checkbox', { name: 'Kecepatan' })).not.toBeChecked();
        await actor.click(within(krw).getByRole('checkbox', { name: 'Saran' }));
        await actor.click(within(krw).getByRole('button', { name: 'Simpan' }));
        expect(hooks.mutate).toHaveBeenCalledWith({ siteId: KRW.id, questionIds: ['q3'] });
        expect(within(spj).getByRole('button', { name: 'Simpan' })).toBeDisabled();
    });

    it('merges delegated site (SKD -> SPJ) into handler team card and supports Template CSI 2025 + Terapkan ke semua tim', async () => {
        const SKD = { id: 's-skd', code: 'SKD', name: 'Sukodono', handledBySiteId: SPJ.id };
        const tplName = 'Bagaimana Anda menilai kemampuan komunikasi IT Support?';
        const missingName = 'Bagaimana penilaian anda terhadap kualitas pelayanan tim IT Support secara keseluruhan?';
        hooks.questions = [question('q1', tplName), question('q2', 'Lainnya')];
        hooks.applyTemplate.mockResolvedValueOnce([question('q-new', missingName)]);
        hooks.mutateAsync.mockResolvedValue({});
        const actor = userEvent.setup();
        render(<StepTeam scope="ict" period={period([], false, { sites: [SPJ, SKD, KRW], ratees: [] })} />);
        expect(screen.queryByRole('region', { name: 'Tim Sukodono' })).not.toBeInTheDocument();
        const spj = screen.getByRole('region', { name: 'Tim Sepanjang' });
        expect(within(spj).getByText('Juga melayani Sukodono (SKD)')).toBeInTheDocument();

        await actor.click(within(spj).getByRole('button', { name: 'Template CSI 2025' }));
        expect(hooks.applyTemplate).toHaveBeenCalledTimes(1);
        await actor.click(within(spj).getByRole('button', { name: 'Terapkan ke semua tim (2)' }));
        expect(hooks.mutateAsync).toHaveBeenCalledWith({ siteId: SPJ.id, questionIds: ['q1', 'q-new'] });
        expect(hooks.mutateAsync).toHaveBeenCalledWith({ siteId: KRW.id, questionIds: ['q1', 'q-new'] });
    });
});
