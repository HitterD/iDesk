import { describe, it, expect } from 'vitest';
import { capsFor, computePermissions, canComment, canDecideProcurement, canUpdateDelivery, canProposeSchedule } from '../permission.util';
import type { HardwareRequest } from '../../types';

const staff = (id = 's1') => ({ id, role: 'ICT_STAFF' as const });
const user  = (id = 'u1') => ({ id, role: 'USER' as const });
const createReq = (overrides: Partial<HardwareRequest>): HardwareRequest =>
    ({ id: 'r1', requestNumber: 'HR-001', requesterId: 'u1', siteId: 'site1',
       justification: '', status: 'SUBMITTED', version: 1, items: [],
       createdAt: '', updatedAt: '', ...overrides } as HardwareRequest);

describe('capsFor (ICT_STAFF flat)', () => {
    it('ICT_STAFF canReview when SUBMITTED', () => {
        expect(capsFor(staff(), createReq({ status: 'SUBMITTED' })).canReview).toBe(true);
    });

    it('ICT_STAFF canApprove when UNDER_REVIEW', () => {
        expect(capsFor(staff(), createReq({ status: 'UNDER_REVIEW' })).canApprove).toBe(true);
    });

    it('ICT_STAFF canReject when UNDER_REVIEW', () => {
        expect(capsFor(staff(), createReq({ status: 'UNDER_REVIEW' })).canReject).toBe(true);
    });

    it('ICT_STAFF canCompleteInstall when IN_PROGRESS', () => {
        const r = createReq({ status: 'INSTALLATION', installationSchedule: { status: 'IN_PROGRESS' } as any });
        expect(capsFor(staff(), r).canCompleteInstall).toBe(true);
    });

    it('ICT_STAFF canManageCatalog', () => {
        expect(capsFor(staff(), createReq({})).canManageCatalog).toBe(true);
    });

    it('USER cannot approve', () => {
        expect(capsFor(user(), createReq({ status: 'UNDER_REVIEW' })).canApprove).toBe(false);
    });

    it('USER (requester) can cancel SUBMITTED own', () => {
        expect(capsFor(user('u1'), createReq({ status: 'SUBMITTED', requesterId: 'u1' })).canCancel).toBe(true);
    });

    it('USER cannot cancel other request', () => {
        expect(capsFor(user('u2'), createReq({ status: 'SUBMITTED', requesterId: 'u1' })).canCancel).toBe(false);
    });

    it('computePermissions alias works', () => {
        expect(computePermissions).toBe(capsFor);
    });
});

describe('permission.util — v2 helpers', () => {
  const ictUser = { id: 'ict-1', role: 'ICT_STAFF' as const };
  const ownerUser = { id: 'u-1', role: 'USER' as const };
  const otherUser = { id: 'u-2', role: 'USER' as const };
  const baseReq = { id: 'r1', requesterId: 'u-1', items: [] } as any;

  describe('canComment — all statuses', () => {
    const statuses = ['DRAFT','SUBMITTED','UNDER_REVIEW','APPROVED','PROCUREMENT',
                      'AWAITING_DELIVERY','INSTALLATION','COMPLETED','REJECTED','CANCELLED'];
    statuses.forEach((s) => {
      it(`ICT_STAFF can comment in ${s}`, () => {
        expect(canComment(ictUser, { ...baseReq, status: s })).toBe(true);
      });
      it(`USER owner can comment in ${s}`, () => {
        expect(canComment(ownerUser, { ...baseReq, status: s })).toBe(true);
      });
      it(`USER non-owner cannot comment in ${s}`, () => {
        expect(canComment(otherUser, { ...baseReq, status: s })).toBe(false);
      });
    });
  });

  it('canDecideProcurement only ICT in PROCUREMENT', () => {
    expect(canDecideProcurement(ictUser, { ...baseReq, status: 'PROCUREMENT' })).toBe(true);
    expect(canDecideProcurement(ictUser, { ...baseReq, status: 'APPROVED' })).toBe(false);
    expect(canDecideProcurement(ownerUser, { ...baseReq, status: 'PROCUREMENT' })).toBe(false);
  });

  it('canUpdateDelivery only ICT in AWAITING_DELIVERY|INSTALLATION', () => {
    expect(canUpdateDelivery(ictUser, { ...baseReq, status: 'AWAITING_DELIVERY' })).toBe(true);
    expect(canUpdateDelivery(ictUser, { ...baseReq, status: 'INSTALLATION' })).toBe(true);
    expect(canUpdateDelivery(ictUser, { ...baseReq, status: 'PROCUREMENT' })).toBe(false);
    expect(canUpdateDelivery(ownerUser, { ...baseReq, status: 'AWAITING_DELIVERY' })).toBe(false);
  });

  it('canProposeSchedule requires ≥1 item ARRIVED', () => {
    const items = [{ deliveryStatus: 'PENDING' }, { deliveryStatus: 'ARRIVED' }];
    expect(canProposeSchedule(ictUser, { ...baseReq, status: 'AWAITING_DELIVERY', items })).toBe(true);

    const allPending = [{ deliveryStatus: 'PENDING' }, { deliveryStatus: 'PENDING' }];
    expect(canProposeSchedule(ictUser, { ...baseReq, status: 'AWAITING_DELIVERY', items: allPending })).toBe(false);
  });
});
