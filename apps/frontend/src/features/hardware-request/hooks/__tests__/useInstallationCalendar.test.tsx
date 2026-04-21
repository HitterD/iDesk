import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useInstallationCalendar } from '../useInstallationCalendar';
import * as api from '../../api/installation.api';
import { vi, test, expect } from 'vitest';

vi.mock('../../api/installation.api');

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

test('rescheduleMutation calls api.rescheduleSchedule and invalidates calendar', async () => {
  vi.mocked(api.fetchCalendarEvents).mockResolvedValue([]);
  vi.mocked(api.rescheduleSchedule).mockResolvedValue({ id: 's1' } as any);
  const { result } = renderHook(
    () => useInstallationCalendar({ from: '2026-04-01', to: '2026-04-30' }),
    { wrapper },
  );
  await waitFor(() => expect(result.current.events).toEqual([]));
  await result.current.reschedule.mutateAsync({
    requestId: 'r1',
    payload: { proposedAt: '2026-04-20T09:00:00Z', reason: 'shift change' },
  });
  expect(api.rescheduleSchedule).toHaveBeenCalledWith('r1', {
    proposedAt: '2026-04-20T09:00:00Z',
    reason: 'shift change',
  });
});
