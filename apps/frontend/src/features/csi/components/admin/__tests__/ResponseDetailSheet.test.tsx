import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ResponseDetailSheet } from '../ResponseDetailSheet';
import type { CsiResponseDetail } from '../../../types';

const hooks = vi.hoisted(() => ({ reset: vi.fn() }));
const DETAIL: CsiResponseDetail = {
    responseId: 'r1', fullName: 'Rina Pemohon', departmentName: 'Finance', submittedAt: '2026-10-20T07:05:00Z',
    ratees: [{ periodRateeId: 'pr1', displayName: 'Andi', jobTitle: 'IT Support', comment: 'Cepat tanggap',
        scores: [{ dimension: 'Kecepatan', score: 5 }] }],
};

vi.mock('../../../hooks/useCsi', () => ({
    useCsiResponseDetail: () => ({ data: DETAIL, isLoading: false, isError: false, refetch: vi.fn() }),
    useResetCsiResponse: () => ({ mutate: hooks.reset, isPending: false }),
}));

beforeEach(() => hooks.reset.mockReset());
afterEach(cleanup);

describe('ResponseDetailSheet', () => {
    it('menampilkan jawaban lalu reset hanya setelah alasan minimal 5 karakter', async () => {
        const actor = userEvent.setup();
        render(<ResponseDetailSheet scope="ict" periodId="p1" responseId="r1" onClose={vi.fn()} />);

        expect(screen.getByText('Rina Pemohon')).toBeInTheDocument();
        expect(screen.getByText('Cepat tanggap')).toBeInTheDocument();
        await actor.click(screen.getByRole('button', { name: 'Reset jawaban' }));

        const confirm = screen.getByRole('button', { name: 'Reset jawaban' });
        expect(confirm).toBeDisabled();
        await actor.type(screen.getByLabelText('Alasan reset'), ' abc ');
        expect(confirm).toBeDisabled();
        await actor.type(screen.getByLabelText('Alasan reset'), 'salah dept');
        expect(confirm).toBeEnabled();
        await actor.click(confirm);

        expect(hooks.reset).toHaveBeenCalledWith({ responseId: 'r1', reason: 'abc salah dept' }, expect.anything());
    });
});
