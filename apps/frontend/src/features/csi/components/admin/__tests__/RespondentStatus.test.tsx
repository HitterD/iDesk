import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CsiReport, CsiRespondents } from '../../../types';
import { RespondentStatus } from '../RespondentStatus';
import { PERIOD, report } from '../report/__tests__/reportFixture';

const fx = vi.hoisted(() => ({
    respondents: null as unknown as CsiRespondents,
    report: null as unknown as CsiReport,
    mutate: vi.fn(),
    resetMutate: vi.fn(),
    toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock('../../../hooks/useCsi', () => ({
    useCsiRespondents: () => ({ data: fx.respondents, isLoading: false, isError: false, refetch: vi.fn() }),
    useCsiReport: () => ({ data: fx.report }),
    useSendCsiReminders: () => ({ mutate: fx.mutate, isPending: false }),
    useResetCsiResponse: () => ({ mutate: fx.resetMutate, isPending: false }),
}));
vi.mock('sonner', () => ({ toast: fx.toast }));

const LISTED: CsiRespondents = {
    mode: 'LISTED',
    submitted: [{ responseId: 'a', userId: 'u9', respondentName: 'Rina', accountName: 'User SPJ', departmentName: 'Finance', siteId: 's1', submittedAt: '2026-10-20T05:00:00Z' }],
    pending: [
        { userId: 'u1', fullName: 'Andi', department: 'Gudang', siteId: 's1' },
        { userId: 'u2', fullName: 'Citra', department: 'HRGA', siteId: 's2' },
    ],
    totals: { submitted: 1, pending: 2 },
};
const OPEN: CsiRespondents = { ...LISTED, mode: 'OPEN', pending: null, totals: { submitted: 1, pending: null } };

beforeEach(() => { vi.clearAllMocks(); fx.respondents = LISTED; fx.report = report(); });
afterEach(cleanup);

const renderStatus = () => render(<RespondentStatus scope="ict" periodId="p1" sites={PERIOD.sites} />);
const names = () => within(screen.getByRole('list', { name: 'Daftar responden' })).getAllByRole('listitem')
    .map((item) => item.querySelector('b')?.textContent);

describe('RespondentStatus', () => {
    it('not-yet rows come first', () => {
        renderStatus();
        expect(names()).toEqual(['Andi', 'Citra', 'Rina']);
        expect(screen.getByText('1/3')).toBeInTheDocument();
        // target 90 % of 3 = 3 → 2 more needed
        expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Butuh 2 jawaban lagi untuk mencapai target 90%');
        expect(screen.getByRole('button', { name: 'Belum 2' })).toBeInTheDocument();
    });

    it('filters by tab, site and search', async () => {
        const user = userEvent.setup();
        renderStatus();
        await user.click(screen.getByRole('button', { name: 'Sudah 1' }));
        expect(names()).toEqual(['Rina']);
        await user.click(screen.getByRole('button', { name: 'Semua 3' }));
        await user.click(within(screen.getByRole('group', { name: 'Filter site responden' })).getByRole('button', { name: 'KRW' }));
        expect(names()).toEqual(['Citra']);
        await user.click(within(screen.getByRole('group', { name: 'Filter site responden' })).getByRole('button', { name: 'Semua site' }));
        await user.type(screen.getByRole('searchbox', { name: 'Cari responden' }), 'gudang');
        expect(names()).toEqual(['Andi']);
    });

    it('Ingatkan sends one user id', async () => {
        fx.mutate.mockImplementation((_vars, options) => { options?.onSuccess?.({ sent: 1, skipped: 0 }); options?.onSettled?.(); });
        const user = userEvent.setup();
        renderStatus();
        await user.click(screen.getByRole('button', { name: 'Ingatkan Andi' }));
        expect(fx.mutate).toHaveBeenCalledWith({ userIds: ['u1'] }, expect.anything());
        expect(screen.getByText('Pengingat terkirim')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Ingatkan Andi' })).not.toBeInTheDocument();
    });

    it('Ingatkan semua sends the explicit not-yet ids and toasts the result', async () => {
        fx.mutate.mockImplementation((_vars, options) => options?.onSuccess?.({ sent: 1, skipped: 1 }));
        const user = userEvent.setup();
        renderStatus();
        await user.click(screen.getByRole('button', { name: 'Ingatkan semua yang belum' }));
        expect(fx.mutate).toHaveBeenCalledWith({ userIds: ['u1', 'u2'] }, expect.anything());
        expect(fx.toast.success).toHaveBeenCalledWith('Pengingat terkirim ke 1 orang, 1 dilewati');
    });

    it('OPEN mode hides reminders', () => {
        fx.respondents = OPEN;
        renderStatus();
        expect(screen.queryByRole('button', { name: /Ingatkan/ })).not.toBeInTheDocument();
        expect(names()).toEqual(['Rina']);
        expect(screen.getByText(/Pelapor tiket iDesk/)).toBeInTheDocument();
        expect(screen.getByText(/User SPJ/)).toBeInTheDocument();
    });

    it('ICT: the same department summary; names after "Tampilkan nama"', async () => {
        fx.respondents = { ...LISTED, pendingByDepartment: [{ department: 'GUDANG', pending: 1, total: 1 }] };
        const user = userEvent.setup();
        render(<RespondentStatus scope="ict" periodId="p1" sites={PERIOD.sites} />);
        expect(within(screen.getByRole('region', { name: 'Belum menilai per departemen' })).getByText('Gudang')).toBeInTheDocument();
        expect(screen.queryByRole('list', { name: 'Daftar responden' })).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Tampilkan nama' }));
        expect(names()).toEqual(['Andi', 'Citra', 'Rina']);
    });

    it('HC: pending raters are summarised per department; names only after "Tampilkan nama"', async () => {
        fx.respondents = { ...LISTED, pendingByDepartment: [{ department: 'GUDANG', pending: 1, total: 1 }, { department: 'HRGA', pending: 1, total: 2 }] };
        const user = userEvent.setup();
        render(<RespondentStatus scope="hc" periodId="p1" sites={PERIOD.sites} />);
        const summary = screen.getByRole('region', { name: 'Belum menilai per departemen' });
        expect(within(summary).getByText('Gudang')).toBeInTheDocument();
        expect(within(summary).getByText('1 dari 2 belum menilai')).toBeInTheDocument();
        expect(screen.queryByRole('list', { name: 'Daftar responden' })).not.toBeInTheDocument();
        expect(screen.queryByText('Andi')).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Tampilkan nama' }));
        expect(names()).toEqual(['Andi', 'Citra', 'Rina']);
    });

    it('allows resetting a submitted response with reason without ever exposing scores or "Lihat jawaban"', async () => {
        const user = userEvent.setup();
        fx.resetMutate.mockImplementation((_payload, opts) => opts?.onSuccess?.());
        renderStatus();
        expect(screen.queryByRole('button', { name: /Lihat jawaban/ })).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Reset jawaban Rina' }));
        const confirm = screen.getByRole('button', { name: 'Reset jawaban' });
        expect(confirm).toBeDisabled();
        await user.type(screen.getByLabelText('Alasan reset'), ' abc ');
        expect(confirm).toBeDisabled();
        await user.type(screen.getByLabelText('Alasan reset'), 'salah departemen');
        expect(confirm).toBeEnabled();
        await user.click(confirm);
        expect(fx.resetMutate).toHaveBeenCalledWith({ responseId: 'a', reason: 'abc salah departemen' }, expect.anything());
        expect(fx.toast.success).toHaveBeenCalledWith('Jawaban Rina direset');
    });

    it('merges ICT delegated sites (SKD -> SPJ) into one card & SPJ filter while keeping SKD row badge', async () => {
        const user = userEvent.setup();
        const SPJ = { id: 's1', code: 'SPJ', name: 'Sepanjang', handledBySiteId: null };
        const KRW = { id: 's2', code: 'KRW', name: 'Karawang', handledBySiteId: null };
        const SKD = { id: 's3', code: 'SKD', name: 'Sukodono', handledBySiteId: 's1' };
        fx.respondents = {
            mode: 'LISTED',
            submitted: [
                { responseId: 'a', userId: 'u9', respondentName: 'Rina', accountName: 'User SPJ', departmentName: 'Finance', siteId: 's1', submittedAt: '2026-10-20T05:00:00Z' },
            ],
            pending: [
                { userId: 'u1', fullName: 'Andi', department: 'Gudang', siteId: 's2' },
                { userId: 'u3', fullName: 'Dina', department: 'QA', siteId: 's3' },
            ],
            totals: { submitted: 1, pending: 2 },
        };

        render(<RespondentStatus scope="ict" periodId="p1" sites={[SPJ, KRW, SKD]} />);

        expect(screen.queryByLabelText('Progres SKD')).not.toBeInTheDocument();
        const spjCard = screen.getByLabelText('Progres SPJ');
        expect(spjCard).toHaveTextContent('Sepanjang (+ SKD)');
        expect(spjCard).toHaveTextContent('1/2');

        const filter = screen.getByRole('group', { name: 'Filter site responden' });
        expect(within(filter).getAllByRole('button').map((btn) => btn.textContent)).toEqual(['Semua site', 'SPJ', 'KRW']);

        await user.click(within(filter).getByRole('button', { name: 'SPJ' }));
        expect(names()).toEqual(['Dina', 'Rina']);
        const list = screen.getByRole('list', { name: 'Daftar responden' });
        expect(within(list).getByText('SKD')).toBeInTheDocument();
    });
});
