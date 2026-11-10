import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PeriodsTab } from '../PeriodsTab';

vi.mock('@/components/site/useActiveSites', () => ({ useActiveSites: () => ({ data: [] }) }));
vi.mock('../../../hooks/useCsi', () => ({ useCsiPeriods: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }) }));
vi.mock('../hc/templates/HcSurveyWizard', () => ({ HcSurveyWizard: () => <p>wizard-hc</p> }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

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
});
