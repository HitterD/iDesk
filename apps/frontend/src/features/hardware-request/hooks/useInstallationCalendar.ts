import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { rescheduleSchedule, fetchCalendarEvents, type ReschedulePayload } from '../api/installation.api';

export function useInstallationCalendar(range: { from: string; to: string; technicianIds?: string[] }) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['hardware-requests', 'calendar', range],
    queryFn: () => fetchCalendarEvents(range),
    staleTime: 30_000,
  });

  const reschedule = useMutation({
    mutationFn: ({ requestId, payload }: { requestId: string; payload: ReschedulePayload }) =>
      rescheduleSchedule(requestId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hardware-requests', 'calendar'] });
      qc.invalidateQueries({ queryKey: ['hardware-requests', 'detail'] });
    },
  });

  return { events: query.data ?? [], isLoading: query.isLoading, error: query.error, reschedule };
}
