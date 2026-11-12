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
        findStaffAtSite: jest.fn().mockResolvedValue([]),
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

    const managerApproved = async (formType: string, status: string) => {
        notificationCenter.findStaffAtSite.mockResolvedValue([
            { id: 'ops1', fullName: 'Ops Agent 1', email: 'ops1@example.com', role: UserRole.AGENT_OPERATIONAL_SUPPORT },
        ]);
        await listener.handleEFormManagerApproved({
            request: { id: 'ef-1', formType, status, requesterName: 'Budi', siteId: 'site-1' } as any,
        });
    };

    it('handleEFormManagerApproved asks AGENT_OPERATIONAL_SUPPORT for the GM signature on VPN', async () => {
        await managerApproved('VPN', 'PENDING_GM');

        expect(notificationCenter.sendToRoleAtSite).toHaveBeenCalledWith(
            UserRole.AGENT_OPERATIONAL_SUPPORT,
            'site-1',
            expect.objectContaining({ title: 'Tanda Tangan GM Diperlukan' }),
        );
        expect(mailDispatch.send).toHaveBeenCalledWith(expect.objectContaining({
            to: 'ops1@example.com',
            subject: expect.stringContaining('[SPJ] Tanda Tangan GM Diperlukan'),
        }));
    });

    it('handleEFormManagerApproved asks for provisioning only when no GM signature is needed', async () => {
        await managerApproved('WEBSITE', 'PENDING_ICT');

        expect(notificationCenter.sendToRoleAtSite).toHaveBeenCalledWith(
            UserRole.AGENT_OPERATIONAL_SUPPORT,
            'site-1',
            expect.objectContaining({ title: 'Provisioning Diperlukan', message: expect.not.stringContaining('GM') }),
        );
        expect(mailDispatch.send).toHaveBeenCalledWith(expect.objectContaining({
            subject: expect.stringContaining('[SPJ] Provisioning Diperlukan'),
        }));
    });

    it('handleEFormManagerApproved leaves ICT alone while a GM chosen in iDesk decides', async () => {
        await listener.handleEFormManagerApproved({
            request: { id: 'ef-1', formType: 'VPN', status: 'PENDING_GM', gmApproverId: 'gm-1', requesterName: 'Budi', siteId: 'site-1' } as any,
        });
        expect(notificationCenter.sendToRoleAtSite).not.toHaveBeenCalled();
        expect(mailDispatch.send).not.toHaveBeenCalled();
    });

    it('handleEFormGmRequested tells the chosen GM in-app and by email', async () => {
        userRepo.findOne.mockResolvedValue({ id: 'gm-1', fullName: 'Pak GM', email: 'gm@example.com' });
        await listener.handleEFormGmRequested({
            request: { id: 'ef-1', formType: 'VPN', requesterName: 'Budi', siteId: 'site-1' } as any,
            gmId: 'gm-1',
        });
        expect(notificationCenter.send).toHaveBeenCalledWith(expect.objectContaining({ userId: 'gm-1', title: 'Persetujuan GM Diperlukan' }));
        expect(mailDispatch.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'gm@example.com' }));
    });

    it('handleEFormGmApproved tells ICT only after an in-app GM approval', async () => {
        userRepo.find.mockResolvedValue([]);
        const request = { id: 'ef-1', formType: 'VPN', status: 'PENDING_ICT', requesterName: 'Budi', siteId: 'site-1' } as any;

        await listener.handleEFormGmApproved({ request });
        expect(notificationCenter.sendToRoleAtSite).not.toHaveBeenCalled();

        await listener.handleEFormGmApproved({ request, inApp: true });
        expect(notificationCenter.sendToRoleAtSite).toHaveBeenCalledWith(
            UserRole.AGENT_OPERATIONAL_SUPPORT, 'site-1', expect.objectContaining({ title: 'Provisioning Diperlukan' }),
        );
    });

    it('sends each e-form event in-app once and the templated email once - no generic second email', async () => {
        await listener.handleEFormRejected({
            request: { id: 'ef-1', formType: 'VPN', requesterId: 'u-1', requesterEmail: 'u@example.com', requesterName: 'Budi', rejectionReason: 'x' } as any,
        });
        // The center is not asked for its EMAIL channel; the e-form template email is the only one.
        expect(notificationCenter.send).toHaveBeenCalledWith(expect.not.objectContaining({ channels: expect.anything() }));
        expect(notificationCenter.send).toHaveBeenCalledWith(expect.objectContaining({ link: '/eform-access/ef-1' }));
        expect(mailDispatch.send).toHaveBeenCalledTimes(1);
    });

    it('emails ICT from the same site-scoped list as the in-app notice', async () => {
        await managerApproved('WEBSITE', 'PENDING_ICT');
        expect(notificationCenter.findStaffAtSite).toHaveBeenCalledWith([UserRole.AGENT_OPERATIONAL_SUPPORT], 'site-1');
        expect(userRepo.find).not.toHaveBeenCalled();
    });
});
