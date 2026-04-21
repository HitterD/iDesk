import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  proposeSchedule,
  selectScheduleSlot,
  requestReschedule,
} from '../api/installation.api';
import type {
  ScheduleProposeInput,
  SelectSlotInput,
  RequestRescheduleInput,
} from '../types';

export function useScheduleSelection(requestId: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['hardware-requests', 'detail', requestId] });
    qc.invalidateQueries({ queryKey: ['hardware-requests', 'list'] });
    qc.invalidateQueries({ queryKey: ['installation-calendar'] });
  };

  const propose = useMutation({
    mutationFn: (input: ScheduleProposeInput) => proposeSchedule(requestId, input),
    onSuccess: () => {
      invalidate();
      toast.success('Slot diusulkan ke user');
    },
    onError: (err: Error) => toast.error(`Gagal usulkan: ${err.message}`),
  });

  const select = useMutation({
    mutationFn: ({ scheduleId, input }: { scheduleId: string; input: SelectSlotInput }) =>
      selectScheduleSlot(requestId, scheduleId, input),
    onSuccess: () => {
      invalidate();
      toast.success('Jadwal dikonfirmasi');
    },
    onError: (err: Error) => toast.error(`Gagal konfirmasi: ${err.message}`),
  });

  const reschedule = useMutation({
    mutationFn: ({ scheduleId, input }: { scheduleId: string; input: RequestRescheduleInput }) =>
      requestReschedule(requestId, scheduleId, input),
    onSuccess: (sched) => {
      invalidate();
      toast.success(
        sched.status === 'CANCELLED'
          ? 'Reschedule maksimal — schedule otomatis dibatalkan'
          : 'Permintaan reschedule terkirim',
      );
    },
    onError: (err: Error) => toast.error(`Gagal: ${err.message}`),
  });

  return {
    propose: propose.mutateAsync,
    select: select.mutateAsync,
    reschedule: reschedule.mutateAsync,
    isProposing: propose.isPending,
    isSelecting: select.isPending,
    isRescheduling: reschedule.isPending,
  };
}
