export type CalendarEventData = {
  scheduleId: string;
  requestId: string;
  requestNumber: string;
  siteName: string;
  technicianName: string;
  recipientName?: string | null;
  division?: string | null;
  status: string;
  scheduledAt: string;
  endsAt?: string | null;
};