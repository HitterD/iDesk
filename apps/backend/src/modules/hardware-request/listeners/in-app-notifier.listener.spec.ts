import { Test } from '@nestjs/testing';
import { InAppNotifierListener } from './in-app-notifier.listener';
import { NotificationService } from '../../notifications/notification.service';
import { NotificationCenterService } from '../../notifications/notification-center.service';
import { HardwareRequestQueryService } from '../services/hardware-request-query.service';
import { NotificationType } from '../../notifications/entities/notification.entity';

describe('InAppNotifierListener', () => {
    let listener: InAppNotifierListener;
    const notif = { create: jest.fn() };
    const notificationCenter = { emitActionItemsRefresh: jest.fn(), findStaffAtSite: jest.fn().mockResolvedValue([{ id: 'lead1' }]) };
    const perm = notificationCenter;
    const q = { findById: jest.fn() };

    beforeEach(async () => {
        const mod = await Test.createTestingModule({
            providers: [
                InAppNotifierListener,
                { provide: NotificationService, useValue: notif },
                { provide: NotificationCenterService, useValue: notificationCenter },
                { provide: HardwareRequestQueryService, useValue: q },
            ],
        }).compile();
        listener = mod.get(InAppNotifierListener);
        jest.clearAllMocks();
    });

    it('onSubmitted notifies the reviewers at the request site', async () => {
        q.findById.mockResolvedValue({ id: 'r1', siteId: 's1', requestNumber: 'HR-2026-0001' });
        await listener.onSubmitted({ requestId: 'r1', actorId: 'u1', requesterId: 'u1', occurredAt: new Date() } as any);
        expect(notif.create).toHaveBeenCalledWith(expect.objectContaining({
            userId: 'lead1',
            type: NotificationType.HARDWARE_REQUEST_SUBMITTED,
            link: '/hardware-requests/r1',
        }));
    });

    it('onApproved notifies requester + ICT_STAFF', async () => {
        q.findById.mockResolvedValue({ id: 'r1', requesterId: 'u1', requestNumber: 'HR-2026-0001' });
        perm.findStaffAtSite.mockResolvedValue([{ id: 'proc1' }]);
        await listener.onApproved({ requestId: 'r1', actorId: 'lead1', requesterId: 'u1', occurredAt: new Date() } as any);
        const calls = notif.create.mock.calls.map((c: any[]) => c[0].userId);
        expect(calls).toContain('u1');
        expect(calls).toContain('proc1');
    });

    it('onProcurementDone scopes fan-out by siteId (not cross-site)', async () => {
        q.findById.mockResolvedValue({ id: 'r2', siteId: 's1', requestNumber: 'HR-2026-0002', requesterId: 'u1' });
        perm.findStaffAtSite.mockResolvedValue([{ id: 'tech1' }]);
        await (listener as any).onProcurementDone({ requestId: 'r2', actorId: 'lead1', requesterId: 'u1', occurredAt: new Date() } as any);
        expect(perm.findStaffAtSite).toHaveBeenCalledWith(expect.not.arrayContaining(['AGENT_ORACLE', 'ADMIN']), 's1');
    });

    it('onInstallCompleted tells the requester and the approver, not every ICT account nor the technician who finished', async () => {
        q.findById.mockResolvedValue({ id: 'r3', siteId: 's1', requestNumber: 'HR-2026-0003', requesterId: 'u1', approvedById: 'lead1', status: 'COMPLETED' });
        await (listener as any).onInstallCompleted({ requestId: 'r3', actorId: 'tech1', requesterId: 'u1', occurredAt: new Date() } as any);
        expect(perm.findStaffAtSite).not.toHaveBeenCalled();
        expect(notif.create.mock.calls.map((c: any[]) => c[0].userId).sort()).toEqual(['lead1', 'u1']);

        notif.create.mockClear();
        q.findById.mockResolvedValue({ id: 'r3', siteId: 's1', requestNumber: 'HR-2026-0003', requesterId: 'u1', approvedById: 'tech1', status: 'COMPLETED' });
        await (listener as any).onInstallCompleted({ requestId: 'r3', actorId: 'tech1', requesterId: 'u1', occurredAt: new Date() } as any);
        expect(notif.create.mock.calls.map((c: any[]) => c[0].userId)).toEqual(['u1']);
    });

    it('never notifies the actor about their own action', async () => {
        q.findById.mockResolvedValue({ id: 'r1', siteId: 's1', requestNumber: 'HR-1', requesterId: 'u1' });
        perm.findStaffAtSite.mockResolvedValue([{ id: 'lead1' }, { id: 'lead2' }]);
        await listener.onApproved({ requestId: 'r1', actorId: 'lead1', requesterId: 'u1', occurredAt: new Date() } as any);
        expect(notif.create.mock.calls.map((c: any[]) => c[0].userId)).not.toContain('lead1');

        notif.create.mockClear();
        await listener.onScheduleConfirmed({ requestId: 'r1', scheduleId: 's', confirmedBy: 'u1', technicianId: 't1', requesterId: 'u1', occurredAt: new Date() } as any);
        expect(notif.create.mock.calls.map((c: any[]) => c[0].userId)).toEqual(['t1']);
    });

    describe('mutual-scheduling (v2) events', () => {
        it('a new slot proposal asks the requester to pick a slot', async () => {
            await listener.onSlotsProposed({ requestId: 'r1', scheduleId: 's1', ownerId: 'u1', technicianId: 't1', slots: [] });
            expect(notif.create).toHaveBeenCalledWith(expect.objectContaining({
                userId: 'u1', type: NotificationType.HARDWARE_REQUEST_SCHEDULE_PROPOSED, link: '/hardware-requests/r1',
            }));
        });

        it('a slot picked by the owner notifies the technician; one picked by staff notifies both others', async () => {
            q.findById.mockResolvedValue({ id: 'r1', requesterId: 'u1' });
            await listener.onSlotConfirmed({ requestId: 'r1', scheduleId: 's1', technicianId: 't1', actorId: 'u1', scheduledStart: new Date(), scheduledEnd: new Date() });
            expect(notif.create.mock.calls.map((c: any[]) => c[0].userId)).toEqual(['t1']);

            notif.create.mockClear();
            await listener.onSlotConfirmed({ requestId: 'r1', scheduleId: 's1', technicianId: 't1', actorId: 'agent9', scheduledStart: new Date(), scheduledEnd: new Date() });
            expect(notif.create.mock.calls.map((c: any[]) => c[0].userId).sort()).toEqual(['t1', 'u1']);
        });

        it('a reschedule request tells the technician why', async () => {
            await listener.onRescheduleRequested({ requestId: 'r1', scheduleId: 's1', technicianId: 't1', reason: 'cuti', rescheduleCount: 1 });
            expect(notif.create).toHaveBeenCalledWith(expect.objectContaining({
                userId: 't1', type: NotificationType.HARDWARE_REQUEST_SCHEDULE_RESCHEDULED, message: expect.stringContaining('cuti'),
            }));
        });
    });

    it('onCommented notifies subscribers except author', async () => {
        await listener.onCommented({
            requestId: 'r1', actorId: 'u1', commentId: 'c1', body: 'halo',
            subscribers: ['u1', 'u2', 'lead1'], occurredAt: new Date(),
        } as any);
        const calls = notif.create.mock.calls.map((c: any[]) => c[0].userId);
        expect(calls).toEqual(expect.arrayContaining(['u2', 'lead1']));
        expect(calls).not.toContain('u1');
    });
});
