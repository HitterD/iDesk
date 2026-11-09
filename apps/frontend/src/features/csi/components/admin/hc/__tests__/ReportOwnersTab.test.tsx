import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithQuery } from '../../__tests__/renderWithQuery';
import { ReportOwnersTab } from '../ReportOwnersTab';

const fx = vi.hoisted(() => ({ set: vi.fn() }));
vi.mock('../../../../api/csiHc.api', () => ({
    CsiHcApi: {
        reportOwners: vi.fn(async () => [
            { serviceCode: 'HCC', users: [] },
            { serviceCode: 'HCD', users: [{ id: 'u1', fullName: 'Fajar Rachmanto', email: null }] },
            { serviceCode: 'HCS', users: [] },
        ]),
        setReportOwners: fx.set,
    },
}));
vi.mock('../../AdminParts', async (importOriginal) => ({
    ...(await importOriginal<object>()),
    UserMultiPicker: ({ label, onChange, selected }: { label: string; selected: Array<{ id: string; fullName: string }>; onChange: (users: unknown[]) => void }) => (
        <div>
            <button type="button" onClick={() => onChange([...selected, { id: 'u2', fullName: 'Budi', jobTitle: null }])}>{label}</button>
            {selected.map((user) => <span key={user.id}>{user.fullName}</span>)}
        </div>
    ),
}));

afterEach(cleanup);

describe('ReportOwnersTab', () => {
    it('lists the owners of each service', async () => {
        renderWithQuery(<ReportOwnersTab scope="hc" />);
        const hcd = await screen.findByRole('region', { name: /HCD/ });
        expect(within(hcd).getByText('Fajar Rachmanto')).toBeTruthy();
    });

    it('saves the picked owners of one service', async () => {
        fx.set.mockResolvedValue([]);
        renderWithQuery(<ReportOwnersTab scope="hc" />);
        const hcd = await screen.findByRole('region', { name: /HCD/ });
        await userEvent.click(within(hcd).getByRole('button', { name: /pilih penanggung jawab HCD/i }));
        expect(fx.set).toHaveBeenCalledWith('hc', 'HCD', ['u1', 'u2']);
    });
});
