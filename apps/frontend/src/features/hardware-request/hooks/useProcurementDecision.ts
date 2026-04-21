import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  decideProcurementItems,
  completeProcurement,
} from '../api/hardware-request.api';
import type { ProcurementDecisionInput, ProcurementCompleteInput } from '../types';

export function useProcurementDecision(requestId: string) {
  const qc = useQueryClient();

  const decideMutation = useMutation({
    mutationFn: (input: ProcurementDecisionInput) =>
      decideProcurementItems(requestId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hardware-request', requestId] });
      toast.success('Keputusan procurement disimpan');
    },
    onError: (err: Error) => toast.error(`Gagal simpan: ${err.message}`),
  });

  const completeMutation = useMutation({
    mutationFn: (input: ProcurementCompleteInput) =>
      completeProcurement(requestId, input),
    onSuccess: (req) => {
      qc.invalidateQueries({ queryKey: ['hardware-request', requestId] });
      qc.invalidateQueries({ queryKey: ['hardware-requests'] });
      toast.success(
        req.status === 'AWAITING_DELIVERY'
          ? 'Procurement selesai. Menunggu kedatangan barang.'
          : 'Procurement ditolak.',
      );
    },
    onError: (err: Error) => toast.error(`Gagal selesaikan: ${err.message}`),
  });

  return {
    decide: decideMutation.mutateAsync,
    complete: completeMutation.mutateAsync,
    isDeciding: decideMutation.isPending,
    isCompleting: completeMutation.isPending,
  };
}
