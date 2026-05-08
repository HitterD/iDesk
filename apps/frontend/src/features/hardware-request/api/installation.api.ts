import api from '../../../lib/api';

export type ReschedulePayload = {
  proposedAt: string;
  reason: string;
};

import type {
  InstallStatus, ItemDeliveryInput, HardwareRequestItem,
  ScheduleProposeInput, InstallationSchedule, SelectSlotInput,
  RequestRescheduleInput
} from '../types';

export type CalendarEventResponse = {
  scheduleId: string;
  requestId: string;
  requestNumber: string;
  siteName: string;
  technicianName: string;
  recipientName?: string | null;
  division?: string | null;
  status: InstallStatus;
  requestStatus?: string | null;
  scheduledAt: string;
  endsAt?: string | null;
};

export async function fetchCalendarEvents(params: { from: string; to: string; technicianIds?: string[] }) {
  const query = new URLSearchParams({
    from: params.from,
    to: params.to,
  });
  if (params.technicianIds?.length) {
    params.technicianIds.forEach((id) => query.append('technicianIds', id));
  }
  const { data } = await api.get<{ data: CalendarEventResponse[] }>(`/hardware-requests/calendar?${query}`);
  return data.data;
}

export async function rescheduleSchedule(requestId: string, payload: ReschedulePayload) {
  const { data } = await api.post(`/hardware-requests/${requestId}/schedule/reschedule`, payload);
  return data;
}

export async function fetchTechnicians() {
  const { data } = await api.get<{ data: { id: string; fullName: string }[] }>('/users/technicians');
  return data.data;
}

export async function fetchUnscheduledRequests() {
  const { data } = await api.get<{ data: { id: string; requestNumber: string; siteName: string }[] }>('/hardware-requests/unscheduled');
  return data.data;
}

export async function fetchMyTodaySchedules() {
  const { data } = await api.get<{ data: { id: string; requestId: string; requestNumber: string; siteName: string; scheduledAt: string }[] }>('/hardware-requests/my-today');
  return data.data;
}

export async function completeInstallation(requestId: string, payload: { items: { itemId: string; assetCode: string }[] }) {
  const { data } = await api.post(`/hardware-requests/${requestId}/install/complete`, payload);
  return data;
}

export async function updateItemDelivery(
  requestId: string,
  itemId: string,
  input: ItemDeliveryInput,
): Promise<HardwareRequestItem> {
  const res = await api.patch(
    `/hardware-requests/${requestId}/items/${itemId}/delivery`,
    input,
  );
  return res.data.data;
}

export async function proposeSchedule(
  requestId: string,
  input: ScheduleProposeInput,
): Promise<InstallationSchedule> {
  const res = await api.post(`/hardware-requests/${requestId}/schedule/propose`, input);
  return res.data.data;
}

export async function selectScheduleSlot(
  requestId: string,
  scheduleId: string,
  input: SelectSlotInput,
): Promise<InstallationSchedule> {
  const res = await api.post(
    `/hardware-requests/${requestId}/schedule/${scheduleId}/select-slot`,
    input,
  );
  return res.data.data;
}

export async function requestReschedule(
  requestId: string,
  scheduleId: string,
  input: RequestRescheduleInput,
): Promise<InstallationSchedule> {
  const res = await api.post(
    `/hardware-requests/${requestId}/schedule/${scheduleId}/request-reschedule`,
    input,
  );
  return res.data.data;
}
