import { Test } from '@nestjs/testing';
import { EmailNotifierListener } from './email-notifier.listener';
import { MailDispatchService } from '../../../shared/mail/mail-dispatch.service';
import { PermissionsService } from '../../permissions/permissions.service';
import { HardwareRequestQueryService } from '../services/hardware-request-query.service';

describe('EmailNotifierListener', () => {
    let listener: EmailNotifierListener;
    const mailer = { send: jest.fn().mockResolvedValue({ success: true }) };
    const perm = { listUsersWithRole: jest.fn().mockResolvedValue([{ id: 'lead1', email: 'lead1@x.com', fullName: 'Lead 1' }]) };
    const q = { findById: jest.fn().mockResolvedValue({
        id: 'r1',
        requestNumber: 'HR-2026-0001',
        siteName: 'HQ',
        justification: '...',
        items: [],
        requester: { fullName: 'User 1', email: 'u1@x.com' },
    }) };

    beforeEach(async () => {
        const mod = await Test.createTestingModule({
            providers: [
                EmailNotifierListener,
                { provide: MailDispatchService, useValue: mailer },
                { provide: PermissionsService, useValue: perm },
                { provide: HardwareRequestQueryService, useValue: q },
            ],
        }).compile();
        listener = mod.get(EmailNotifierListener);
        jest.clearAllMocks();
    });

    it('onSubmitted sends to ICT_STAFF via mail dispatch', async () => {
        await listener.onSubmitted({ requestId: 'r1', actorId: 'u1', requesterId: 'u1', occurredAt: new Date() } as any);
        expect(mailer.send).toHaveBeenCalledWith(expect.objectContaining({
            to: 'lead1@x.com',
        }));
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
