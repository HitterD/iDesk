import { Test } from '@nestjs/testing';
import { EmailNotifierListener } from './email-notifier.listener';
import { MailDispatchService } from '../../../shared/mail/mail-dispatch.service';
import { NotificationCenterService } from '../../notifications/notification-center.service';
import { HardwareRequestQueryService } from '../services/hardware-request-query.service';
import { RequestFlowMembership } from '../services/request-flow-membership.service';

describe('EmailNotifierListener', () => {
    let listener: EmailNotifierListener;
    const mailer = { send: jest.fn().mockResolvedValue({ success: true }) };
    const perm = { findStaffAtSite: jest.fn().mockResolvedValue([{ id: 'lead1', email: 'lead1@x.com', fullName: 'Lead 1' }]) };
    const q = { findById: jest.fn().mockResolvedValue({
        id: 'r1',
        siteId: 's1',
        requestNumber: 'HR-2026-0001',
        siteName: 'HQ',
        justification: '...',
        items: [],
        requester: { fullName: 'User 1', email: 'u1@x.com' },
    }) };

    const flows = { has: jest.fn() };

    beforeEach(async () => {
        const mod = await Test.createTestingModule({
            providers: [
                EmailNotifierListener,
                { provide: MailDispatchService, useValue: mailer },
                { provide: NotificationCenterService, useValue: perm },
                { provide: HardwareRequestQueryService, useValue: q },
                { provide: RequestFlowMembership, useValue: flows },
            ],
        }).compile();
        listener = mod.get(EmailNotifierListener);
        jest.clearAllMocks();
        flows.has.mockResolvedValue(false);
    });

    it('onSubmitted sends to AGENT_OPERATIONAL_SUPPORT via mail dispatch', async () => {
        await listener.onSubmitted({ requestId: 'r1', actorId: 'u1', requesterId: 'u1', occurredAt: new Date() } as any);
        expect(perm.findStaffAtSite).toHaveBeenCalledWith(['AGENT_OPERATIONAL_SUPPORT'], 's1');
        expect(mailer.send).toHaveBeenCalledWith(expect.objectContaining({
            to: 'lead1@x.com',
        }));
    });

    it('legacy procurement done still sends the SPP mail to the requester', async () => {
        q.findById.mockResolvedValueOnce({ id: 'r1', requestNumber: 'HR-2026-0001', requester: { fullName: 'User 1', email: 'u1@x.com' } });
        await listener.onProcurementDone({ requestId: 'r1', actorId: 'lead1', requesterId: 'u1', occurredAt: new Date() } as any);
        expect(mailer.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'u1@x.com', subject: expect.stringContaining('SPP') }));
    });

    it('a request-flow request gets no "SPP diterbitkan" mail', async () => {
        flows.has.mockResolvedValue(true);
        await listener.onProcurementDone({ requestId: 'r1', actorId: 'lead1', requesterId: 'u1', occurredAt: new Date() } as any);
        expect(mailer.send).not.toHaveBeenCalled();
    });

    it('onRejected includes reason in context', async () => {
        await listener.onRejected({
            requestId: 'r1', actorId: 'lead1', requesterId: 'u1', reason: 'Tidak sesuai',
            occurredAt: new Date(),
        } as any);
        expect(mailer.send).toHaveBeenCalledWith(expect.objectContaining({
            context: expect.objectContaining({ message: expect.stringContaining('Tidak sesuai') }),
        }));
    });
});
