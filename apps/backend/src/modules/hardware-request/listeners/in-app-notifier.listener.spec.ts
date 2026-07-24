import { Test } from '@nestjs/testing';
import { InAppNotifierListener } from './in-app-notifier.listener';
import { NotificationService } from '../../notifications/notification.service';
import { NotificationCenterService } from '../../notifications/notification-center.service';
import { HardwareRequestQueryService } from '../services/hardware-request-query.service';
import { PermissionsService } from '../../permissions/permissions.service';
import { NotificationType } from '../../notifications/entities/notification.entity';

describe('InAppNotifierListener', () => {
    let listener: InAppNotifierListener;
    const notif = { create: jest.fn() };
    const notificationCenter = { emitActionItemsRefresh: jest.fn() };
    const perm = { listUsersWithRole: jest.fn().mockResolvedValue([{ id: 'lead1' }]) };
    const q = { findById: jest.fn() };

    beforeEach(async () => {
        const mod = await Test.createTestingModule({
            providers: [
                InAppNotifierListener,
                { provide: NotificationService, useValue: notif },
                { provide: NotificationCenterService, useValue: notificationCenter },
                { provide: PermissionsService, useValue: perm },
                { provide: HardwareRequestQueryService, useValue: q },
            ],
        }).compile();
        listener = mod.get(InAppNotifierListener);
        jest.clearAllMocks();
    });

    it('onSubmitted notifies all ICT_STAFF', async () => {
        q.findById.mockResolvedValue({ id: 'r1', requestNumber: 'HR-2026-0001' });
        await listener.onSubmitted({ requestId: 'r1', actorId: 'u1', requesterId: 'u1', occurredAt: new Date() } as any);
        expect(notif.create).toHaveBeenCalledWith(expect.objectContaining({
            userId: 'lead1',
            type: NotificationType.HARDWARE_REQUEST_SUBMITTED,
            link: '/hardware-requests/r1',
        }));
    });

    it('onApproved notifies requester + ICT_STAFF', async () => {
        q.findById.mockResolvedValue({ id: 'r1', requesterId: 'u1', requestNumber: 'HR-2026-0001' });
        perm.listUsersWithRole.mockResolvedValue([{ id: 'proc1' }]);
        await listener.onApproved({ requestId: 'r1', actorId: 'lead1', requesterId: 'u1', occurredAt: new Date() } as any);
        const calls = notif.create.mock.calls.map((c: any[]) => c[0].userId);
        expect(calls).toContain('u1');
        expect(calls).toContain('proc1');
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
