import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PeriodReport } from '../PeriodReport';
import { RespondentStatus } from '../RespondentStatus';

vi.mock('../../../hooks/useCsi', () => ({
    useCsiReport: () => ({ data: { overall: { average: 4.25, respondentCount: 12 }, sla: { mode: 'OPEN', basis: 81, targetPct: 80, target: 65, responses: 12, pengisiPct: 18 }, ratees: [
        { periodRateeId: 'person', kind: 'PERSON', displayName: 'Budi', respondentCount: 12, average: 4, indexPct: 80, questions: [] },
        { periodRateeId: 'team', kind: 'TEAM', displayName: 'Tim IT Support', respondentCount: 12, average: 4.5, indexPct: 90, questions: [{ name: 'Kepuasan', type: 'SCALE', average: 4.5, count: 12, distribution: [{ label: 'Puas', count: 6 }] }] },
    ] } }),
    useCsiRespondents: () => ({ data: { mode: 'OPEN', submitted: [{ responseId: 'a', respondentName: 'Rina', accountName: 'User SPJ', departmentName: 'Finance', submittedAt: '2026-10-20T12:00:00Z' }], pending: null, totals: { submitted: 1, pending: null } } }),
}));
afterEach(cleanup);
describe('CSI report', () => {
    it('shows overall average on a five-point scale and team before people', () => {
        render(<PeriodReport scope="ict" periodId="p1" />);
        expect(screen.getByLabelText('Nilai keseluruhan')).toHaveTextContent('4,25');
        const rows = within(screen.getByRole('table')).getAllByRole('row');
        expect(rows[1]).toHaveTextContent('Tim IT Support');
        expect(rows[2]).toHaveTextContent('Budi');
        expect(screen.getByText('Puas')).toBeInTheDocument();
    });
    it('shows SLA basis, target and percentage alongside respondent and account names', () => {
        render(<RespondentStatus scope="ict" periodId="p1" onOpenResponse={vi.fn()} />);
        expect(screen.getByLabelText('Target responden')).toHaveTextContent('65');
        expect(screen.getByLabelText('Pengisi SLA')).toHaveTextContent('18');
        expect(screen.getByText('Rina')).toBeInTheDocument();
        expect(screen.getByText(/User SPJ/)).toBeInTheDocument();
    });
});
