import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { updateItemDelivery } from '../api/installation.api';
import type { ItemDeliveryInput } from '../types';

export function useDeliveryUpdate(requestId: string) {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ itemId, input }: { itemId: string; input: ItemDeliveryInput }) =>
      updateItemDelivery(requestId, itemId, input),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['hardware-requests', 'detail', requestId] });
      qc.invalidateQueries({ queryKey: ['hardware-requests', 'list'] });
      toast.success(
        vars.input.status === 'ARRIVED'
          ? 'Item ditandai sudah datang'
          : 'Item dikembalikan ke status menunggu',
      );
    },
    onError: (err: Error) => toast.error(`Gagal update: ${err.message}`),
  });

  return {
    update: mutation.mutateAsync,
    isUpdating: mutation.isPending,
  };
}
