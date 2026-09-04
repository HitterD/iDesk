import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EFormNotificationListener } from './eform-notification.listener';
import { NotificationCenterService } from '../../notifications/notification-center.service';
import { MailDispatchService } from '../../../shared/mail/mail-dispatch.service';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { Site } from '../../sites/entities/site.entity';

describe('EFormNotificationListener', () => {
    let listener: EFormNotificationListener;
    const notificationCenter = {
        send: jest.fn().mockResolvedValue({ id: 'n1' }),
        sendToRoleAtSite: jest.fn().mockResolvedValue({ sent: 1 }),
        emitActionItemsRefresh: jest.fn(),
    };
    const mailDispatch = { send: jest.fn().mockResolvedValue({ success: true }) };
    const userRepo = {
        findOne: jest.fn(),
        find: jest.fn(),
    };
    const siteRepo = {
        findOne: jest.fn().mockResolvedValue({ id: 'site-1', code: 'SPJ', name: 'Sepanjang' }),
    };

    beforeEach(async () => {
        const mod = await Test.createTestingModule({
            providers: [
                EFormNotificationListener,
                { provide: NotificationCenterService, useValue: notificationCenter },
                { provide: MailDispatchService, useValue: mailDispatch },
                { provide: getRepositoryToken(User), useValue: userRepo },
                { provide: getRepositoryToken(Site), useValue: siteRepo },
            ],
        }).compile();

        listener = mod.get(EFormNotificationListener);
        jest.clearAllMocks();
    });

    it('handleEFormManagerApproved sends in-app and email to AGENT_OPERATIONAL_SUPPORT', async () => {
        userRepo.find.mockResolvedValue([
            { id: 'ops1', fullName: 'Ops Agent 1', email: 'ops1@example.com', role: UserRole.AGENT_OPERATIONAL_SUPPORT },
        ]);

        await listener.handleEFormManagerApproved({
            request: {
                id: 'ef-1',
                formType: 'ORACLE_K2',
                requesterName: 'Budi',
                siteId: 'site-1',
            } as any,
        });

        expect(notificationCenter.sendToRoleAtSite).toHaveBeenCalledWith(
            UserRole.AGENT_OPERATIONAL_SUPPORT,
            'site-1',
            expect.objectContaining({ title: 'Provisioning Akses Diperlukan' }),
        );
        expect(mailDispatch.send).toHaveBeenCalledWith(expect.objectContaining({
            to: 'ops1@example.com',
            subject: expect.stringContaining('[SPJ] Provisioning Diperlukan'),
        }));
    });
});
