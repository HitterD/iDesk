import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CsiApi } from '../../api/csi.api';
import { useCsiDashboard, useCsiRespondents } from '../useCsi';

vi.mock('../../api/csi.api', () => ({
    CsiApi: {
        dashboard: vi.fn(),
        respondents: vi.fn(),
    },
}));

function DashboardView() {
    const { data } = useCsiDashboard('hc');
    return <span data-testid="dash-count">{data?.active?.[0]?.responses ?? 'loading'}</span>;
}

function RespondentsView() {
    const { data } = useCsiRespondents('hc', 'p-1');
    return <span data-testid="resp-count">{data?.totals.submitted ?? 'loading'}</span>;
}

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe('CSI admin query freshness across tab switches', () => {
    it('always refetches dashboard and respondents on remount even within default staleTime', async () => {
        const dashboardMock = vi.mocked(CsiApi.dashboard);
        const respondentsMock = vi.mocked(CsiApi.respondents);
        dashboardMock
            .mockResolvedValueOnce({ active: [{ responses: 84 }], trend: [], peopleDelta: [], pending: [], comments: [] } as never)
            .mockResolvedValueOnce({ active: [{ responses: 94 }], trend: [], peopleDelta: [], pending: [], comments: [] } as never);
        respondentsMock
            .mockResolvedValueOnce({ mode: 'LISTED', submitted: [], pending: [], pendingByDepartment: null, totals: { submitted: 84, pending: 19 } } as never)
            .mockResolvedValueOnce({ mode: 'LISTED', submitted: [], pending: [], pendingByDepartment: null, totals: { submitted: 94, pending: 9 } } as never);

        const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 5000, retry: false } } });
        const { rerender } = render(
            <QueryClientProvider client={qc}><DashboardView /></QueryClientProvider>,
        );
        await waitFor(() => expect(screen.getByTestId('dash-count')).toHaveTextContent('84'));

        rerender(<QueryClientProvider client={qc}><RespondentsView /></QueryClientProvider>);
        await waitFor(() => expect(screen.getByTestId('resp-count')).toHaveTextContent('84'));

        // Switch back within 5s staleTime: both views must fetch the latest counts immediately.
        rerender(<QueryClientProvider client={qc}><DashboardView /></QueryClientProvider>);
        await waitFor(() => expect(screen.getByTestId('dash-count')).toHaveTextContent('94'));

        rerender(<QueryClientProvider client={qc}><RespondentsView /></QueryClientProvider>);
        await waitFor(() => expect(screen.getByTestId('resp-count')).toHaveTextContent('94'));

        expect(dashboardMock).toHaveBeenCalledTimes(2);
        expect(respondentsMock).toHaveBeenCalledTimes(2);
    });
});
