import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDeliveryUpdate } from '../useDeliveryUpdate';
import * as api from '../../api/installation.api';

vi.mock('../../api/installation.api');

describe('useDeliveryUpdate', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };

  it('update calls API + invalidates query', async () => {
    (api.updateItemDelivery as any).mockResolvedValue({ id: 'i1', deliveryStatus: 'ARRIVED' });
    const { result } = renderHook(() => useDeliveryUpdate('r1'), { wrapper });

    await act(async () => {
      await result.current.update({ itemId: 'i1', input: { status: 'ARRIVED' } });
    });

    expect(api.updateItemDelivery).toHaveBeenCalledWith('r1', 'i1', { status: 'ARRIVED' });
  });
});
