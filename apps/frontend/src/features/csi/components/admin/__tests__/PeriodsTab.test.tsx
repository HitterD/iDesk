import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CsiReadOnlyProvider } from '../../../lib/CsiReadOnly';
import { PeriodsTab } from '../PeriodsTab';

vi.mock('@/components/site/useActiveSites', () => ({ useActiveSites: () => ({ data: [] }) }));
const periods = vi.hoisted(() => ({ rows: [] as unknown[] }));
vi.mock('../../../hooks/useCsi', () => ({ useCsiPeriods: () => ({ data: periods.rows, isLoading: false, isError: false, refetch: vi.fn() }) }));
vi.mock('../hc/templates/HcSurveyWizard', () => ({
    HcSurveyWizard: ({ onCreated }: { onCreated?: (periodId: string) => void }) => (
        <button type="button" onClick={() => onCreated?.('p-new')}>wizard-hc</button>
    ),
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); periods.rows = []; });

describe('PeriodsTab create entry', () => {
    it('ICT create still opens generic wizard', async () => {
        const onCreate = vi.fn();
        render(<PeriodsTab scope="ict" onOpen={vi.fn()} onCreate={onCreate} />);
        await userEvent.click(screen.getByRole('button', { name: /buat survei/i }));
        expect(onCreate).toHaveBeenCalledTimes(1);
        expect(screen.queryByText('wizard-hc')).not.toBeInTheDocument();
    });

    it('HC create opens the template wizard instead of the generic one', async () => {
        const onCreate = vi.fn();
        render(<PeriodsTab scope="hc" onOpen={vi.fn()} onCreate={onCreate} />);
        await userEvent.click(screen.getByRole('button', { name: /buat survei/i }));
        expect(onCreate).not.toHaveBeenCalled();
        expect(screen.getByText('wizard-hc')).toBeInTheDocument();
    });

    it('HC create opens the new draft after the wizard creates it', async () => {
        const onCreated = vi.fn();
        render(<PeriodsTab scope="hc" onOpen={vi.fn()} onCreate={vi.fn()} onCreated={onCreated} />);
        await userEvent.click(screen.getByRole('button', { name: /buat survei/i }));
        await userEvent.click(screen.getByRole('button', { name: 'wizard-hc' }));
        expect(onCreated).toHaveBeenCalledWith('p-new');
        expect(screen.queryByText('wizard-hc')).not.toBeInTheDocument();
    });
});

describe('PeriodsTab read-only', () => {
    const row = { id: 'p1', title: 'Survei CSI - ICT', publishStatus: 'DRAFT', status: 'ACTIVE', sites: [], respondentMode: 'LISTED', startDate: '2026-11-16', endDate: '2026-11-26', responseCount: 3 };

    it('read-only viewers still open a survey (even a draft) but get no create / repeat buttons', async () => {
        periods.rows = [row];
        const onOpen = vi.fn();
        render(<CsiReadOnlyProvider readOnly><PeriodsTab scope="ict" onOpen={onOpen} onCreate={vi.fn()} onRepeat={vi.fn()} /></CsiReadOnlyProvider>);
        expect(screen.queryByRole('button', { name: /buat survei/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /buat lagi/i })).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: /Survei CSI - ICT/ }));
        expect(onOpen).toHaveBeenCalledTimes(1);
    });

    it('writers keep the create button', () => {
        render(<PeriodsTab scope="ict" onOpen={vi.fn()} onCreate={vi.fn()} />);
        expect(screen.getByRole('button', { name: /buat survei/i })).toBeInTheDocument();
    });
});
