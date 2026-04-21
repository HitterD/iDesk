export const HR_EVT = {
    SUBMITTED:             'hardware-request.submitted',
    APPROVED:              'hardware-request.approved',
    REJECTED:              'hardware-request.rejected',
    CANCELLED:             'hardware-request.cancelled',
    PROCUREMENT_DONE:      'hardware-request.procurement.completed',
    SCHEDULE_PROPOSED:     'hardware-request.schedule.proposed',
    SCHEDULE_CONFIRMED:    'hardware-request.schedule.confirmed',
    SCHEDULE_RESCHEDULED:  'hardware-request.schedule.rescheduled',
    INSTALL_STARTED:       'hardware-request.install.started',
    INSTALL_COMPLETED:     'hardware-request.install.completed',
    COMMENTED:             'hardware-request.commented',
    AGING_FLAGGED:         'hardware-request.aging.flagged',
    CLOSED:                'hardware-request.closed',
} as const;

export type HrEventName = typeof HR_EVT[keyof typeof HR_EVT];

export interface HrEventBase { requestId: string; actorId: string; occurredAt: Date; }
export interface HrSubmitted extends HrEventBase { requesterId: string; }
export interface HrApproved extends HrEventBase { requesterId: string; }
export interface HrRejected extends HrEventBase { requesterId: string; reason: string; }
export interface HrCancelled extends HrEventBase { requesterId: string; fromStatus: string; }
export interface HrProcurementDone extends HrEventBase { requesterId: string; }
export interface HrScheduleProposed extends HrEventBase { scheduleId: string; proposerId: string; technicianId: string; requesterId: string; }
export interface HrScheduleConfirmed extends HrEventBase { scheduleId: string; confirmedBy: string; technicianId: string; requesterId: string; }
export interface HrScheduleRescheduled extends HrEventBase { oldId: string; newId: string; reason?: string; technicianId: string; requesterId: string; }
export interface HrInstallStarted extends HrEventBase { scheduleId: string; requesterId: string; }
export interface HrInstallCompleted extends HrEventBase { requesterId: string; }
export interface HrCommented extends HrEventBase { commentId: string; body: string; subscribers: string[]; }
export interface HrAgingFlagged extends HrEventBase { requesterId: string; daysInStatus: number; status: string; }
export interface HrClosed extends HrEventBase { requesterId: string; }

export const HardwareEvents = {
  ItemArrived: 'hardware-item.arrived',
  ItemNotProcured: 'hardware-item.not-procured',
  ProcurementCompleted: 'procurement.completed',
  ScheduleProposed: 'schedule.proposed',
  ScheduleConfirmed: 'schedule.confirmed',
  ScheduleRescheduleRequested: 'schedule.reschedule-requested',
  ScheduleCancelled: 'schedule.cancelled',
} as const;

export interface ItemArrivedPayload {
  requestId: string;
  itemId: string;
  itemName: string;
  ownerId: string;
  arrivedAt: Date;
}

export interface ProcurementCompletedPayload {
  requestId: string;
  ownerId: string;
  approvedItems: number;
  rejectedItems: number;
}

export interface ScheduleProposedPayload {
  requestId: string;
  scheduleId: string;
  ownerId: string;
  technicianId: string;
  slots: Array<{ start: string; end: string }>;
}

export interface ScheduleConfirmedPayload {
  requestId: string;
  scheduleId: string;
  technicianId: string;
  scheduledStart: Date;
  scheduledEnd: Date;
}

export interface ScheduleRescheduleRequestedPayload {
  requestId: string;
  scheduleId: string;
  technicianId: string;
  reason: string;
  rescheduleCount: number;
}
