import { RequestStatus } from '../enums/request-status.enum';

const TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  [RequestStatus.DRAFT]: [RequestStatus.SUBMITTED, RequestStatus.CANCELLED],
  [RequestStatus.SUBMITTED]: [RequestStatus.UNDER_REVIEW, RequestStatus.CANCELLED],
  [RequestStatus.UNDER_REVIEW]: [RequestStatus.APPROVED, RequestStatus.REJECTED],
  [RequestStatus.APPROVED]: [RequestStatus.PROCUREMENT],
  [RequestStatus.PROCUREMENT]: [RequestStatus.AWAITING_DELIVERY, RequestStatus.REJECTED],
  [RequestStatus.AWAITING_DELIVERY]: [RequestStatus.INSTALLATION, RequestStatus.CANCELLED],
  [RequestStatus.INSTALLATION]: [RequestStatus.AWAITING_USER_CONFIRMATION, RequestStatus.CANCELLED],
  [RequestStatus.AWAITING_USER_CONFIRMATION]: [RequestStatus.COMPLETED, RequestStatus.INSTALLATION, RequestStatus.CANCELLED],
  [RequestStatus.COMPLETED]: [RequestStatus.CLOSED],
  [RequestStatus.REJECTED]: [],
  [RequestStatus.CANCELLED]: [],
  [RequestStatus.CLOSED]: [],
};

export function canTransition(from: RequestStatus, to: RequestStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}
