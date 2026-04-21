import { canTransition } from '../request-state';
import { RequestStatus } from '../../enums/request-status.enum';

describe('Request state machine — AWAITING_DELIVERY', () => {
  it('allows PROCUREMENT → AWAITING_DELIVERY', () => {
    expect(canTransition(RequestStatus.PROCUREMENT, RequestStatus.AWAITING_DELIVERY)).toBe(true);
  });

  it('allows AWAITING_DELIVERY → INSTALLATION', () => {
    expect(canTransition(RequestStatus.AWAITING_DELIVERY, RequestStatus.INSTALLATION)).toBe(true);
  });

  it('forbids AWAITING_DELIVERY → COMPLETED directly', () => {
    expect(canTransition(RequestStatus.AWAITING_DELIVERY, RequestStatus.COMPLETED)).toBe(false);
  });

  it('allows INSTALLATION → COMPLETED', () => {
    expect(canTransition(RequestStatus.INSTALLATION, RequestStatus.COMPLETED)).toBe(true);
  });

  it('still allows PROCUREMENT → REJECTED', () => {
    expect(canTransition(RequestStatus.PROCUREMENT, RequestStatus.REJECTED)).toBe(true);
  });
});
