import type { HardwareRequest, HardwareRole, RequestStatus, InstallStatus } from '../types';

export interface Caps {
    canEditDraft: boolean;
    canSubmit: boolean;
    canCancel: boolean;
    canReview: boolean;
    canApprove: boolean;
    canReject: boolean;
    canEditProcurement: boolean;
    canCompleteProcurement: boolean;
    canPropose: boolean;
    canConfirm: boolean;
    canReschedule: boolean;
    canStartInstall: boolean;
    canScanBarcode: boolean;
    canCompleteInstall: boolean;
    canComment: boolean;
    canManageCatalog: boolean;
}

export function capsFor(user: { id: string; role: HardwareRole }, req: HardwareRequest | null): Caps {
    const r = req?.status as RequestStatus | undefined;
    const mine = !!req && req.requesterId === user.id;
    const sched = req?.installationSchedule;
    const isStaff = user.role === 'ICT_STAFF';
    const inCal = r === 'INSTALLATION';
    const scheduleStatus: InstallStatus | null = sched?.status ?? null;

    return {
        canEditDraft:           mine && r === 'DRAFT',
        canSubmit:              mine && r === 'DRAFT',
        canCancel:              mine && r === 'SUBMITTED',
        canReview:              isStaff && r === 'SUBMITTED',
        canApprove:             isStaff && r === 'UNDER_REVIEW',
        canReject:              isStaff && r === 'UNDER_REVIEW',
        canEditProcurement:     isStaff && (r === 'APPROVED' || r === 'PROCUREMENT'),
        canCompleteProcurement: isStaff && r === 'PROCUREMENT',
        canPropose:             inCal && (mine || isStaff) &&
                                (!scheduleStatus || ['RESCHEDULED', 'CANCELLED', 'DONE'].includes(scheduleStatus)),
        canConfirm:             inCal && scheduleStatus === 'PROPOSED' && (
                                    (isStaff && user.id !== sched?.proposedBy) ||
                                    (mine && user.id !== sched?.proposedBy)
                                ),
        canReschedule:          inCal && !!scheduleStatus &&
                                !['IN_PROGRESS', 'DONE', 'CANCELLED', 'RESCHEDULED'].includes(scheduleStatus) &&
                                (isStaff || mine),
        canStartInstall:        isStaff && scheduleStatus === 'CONFIRMED',
        canScanBarcode:         isStaff && scheduleStatus === 'IN_PROGRESS',
        canCompleteInstall:     isStaff && scheduleStatus === 'IN_PROGRESS',
        canComment:             !!req && (isStaff || mine),
        canManageCatalog:       isStaff,
    };
}

/** @deprecated Use capsFor */
export const computePermissions = capsFor;

interface User {
  id: string;
  role: 'USER' | 'ICT_STAFF';
}

export function canComment(user: User, req: HardwareRequest): boolean {
  if (!user) return false;
  if (user.role === 'ICT_STAFF') return true;
  return req.requesterId === user.id; // USER own only, all status
}

export function canDecideProcurement(user: User, req: HardwareRequest): boolean {
  return user.role === 'ICT_STAFF'
    && (req.status === 'APPROVED' || req.status === 'PROCUREMENT');
}

export function canUpdateDelivery(user: User, req: HardwareRequest): boolean {
  return user.role === 'ICT_STAFF'
    && (req.status === 'AWAITING_DELIVERY' || req.status === 'INSTALLATION');
}

export function canProposeSchedule(user: User, req: HardwareRequest): boolean {
  return user.role === 'ICT_STAFF'
    && (req.status === 'AWAITING_DELIVERY' || req.status === 'INSTALLATION')
    && req.items.some((i) => i.deliveryStatus === 'ARRIVED');
}

export function canSelectSlot(user: User, req: HardwareRequest, scheduleStatus: string): boolean {
  if (scheduleStatus !== 'PROPOSED_AWAITING_USER') return false;
  if (user.role === 'ICT_STAFF') return true;
  return req.requesterId === user.id;
}

export function canRequestReschedule(user: User, req: HardwareRequest, scheduleStatus: string): boolean {
  if (!['PROPOSED_AWAITING_USER', 'CONFIRMED'].includes(scheduleStatus)) return false;
  if (user.role === 'ICT_STAFF') return true;
  return req.requesterId === user.id;
}
