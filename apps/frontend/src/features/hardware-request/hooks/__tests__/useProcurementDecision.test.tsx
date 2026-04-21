import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useProcurementDecision } from '../useProcurementDecision';
import * as api from '../../api/hardware-request.api';

vi.mock('../../api/hardware-request.api');

describe('useProcurementDecision', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };

  it('decideItems calls API + invalidates query', async () => {
    (api.decideProcurementItems as any).mockResolvedValue([{ id: 'i1' }]);
    const { result } = renderHook(() => useProcurementDecision('r1'), { wrapper });

    await act(async () => {
      await result.current.decide({ decisions: [{ itemId: 'i1', decision: 'APPROVED' }] });
    });

    expect(api.decideProcurementItems).toHaveBeenCalledWith('r1', expect.any(Object));
  });

  it('completeProcurement triggers status transition', async () => {
    (api.completeProcurement as any).mockResolvedValue({ id: 'r1', status: 'AWAITING_DELIVERY' });
    const { result } = renderHook(() => useProcurementDecision('r1'), { wrapper });

    await act(async () => {
      await result.current.complete({});
    });

    expect(api.completeProcurement).toHaveBeenCalledWith('r1', {});
  });
});
