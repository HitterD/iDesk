import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useScheduleSelection } from '../useScheduleSelection';
import * as api from '../../api/installation.api';

vi.mock('../../api/installation.api');

describe('useScheduleSelection', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };

  it('propose calls API + invalidates query', async () => {
    (api.proposeSchedule as any).mockResolvedValue({ id: 's1' });
    const { result } = renderHook(() => useScheduleSelection('r1'), { wrapper });

    await act(async () => {
      await result.current.propose({ itemIds: [], technicianId: 't1', slots: [] });
    });

    expect(api.proposeSchedule).toHaveBeenCalledWith('r1', { itemIds: [], technicianId: 't1', slots: [] });
  });
});
