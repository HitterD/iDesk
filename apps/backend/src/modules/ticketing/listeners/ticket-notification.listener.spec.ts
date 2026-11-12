import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NOTIFY_FANOUT_CONCURRENCY, TicketNotificationListener } from './ticket-notification.listener';
import { NotificationService } from '../../notifications/notification.service';
import { NotificationCenterService } from '../../notifications/notification-center.service';
import { MailDispatchService } from '../../../shared/mail/mail-dispatch.service';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { NotificationPreferenceGate } from '../../notifications/notification-preference-gate.service';
import { TicketCreatedEvent } from '../events/ticket-created.event';
import { TicketAssignedEvent } from '../events/ticket-assigned.event';
import { TicketUpdatedEvent } from '../events/ticket-updated.event';
import { TicketRepliedEvent } from '../events/ticket-replied.event';
import { TicketCancelledEvent } from '../events/ticket-cancelled.event';
import { TicketStatus } from '../entities/ticket.entity';
import { TicketParticipant } from '../entities/ticket-participant.entity';

describe('TicketNotificationListener', () => {
    let listener: TicketNotificationListener;
    const notificationService = {
        notifyTicketCreated: jest.fn().mockResolvedValue(undefined),
        notifyNewTicketToAdmins: jest.fn().mockResolvedValue(undefined),
        notifyTicketAssigned: jest.fn().mockResolvedValue(undefined),
        notifyTicketUpdated: jest.fn().mockResolvedValue(undefined),
        notifyTicketResolved: jest.fn().mockResolvedValue(undefined),
        notifyTicketReply: jest.fn().mockResolvedValue(undefined),
        create: jest.fn().mockResolvedValue(undefined),
    };
    const notificationCenterService = {
        emitActionItemsRefresh: jest.fn(),
        findStaffAtSite: jest.fn().mockResolvedValue([]),
    };
    const participantRepo = { find: jest.fn().mockResolvedValue([]) };
    const mailDispatch = {
        send: jest.fn().mockResolvedValue({ success: true }),
    };
    const userRepo = {
        find: jest.fn(),
        findOne: jest.fn(),
    };
    const gate = { allows: jest.fn().mockResolvedValue(true) };

    beforeEach(async () => {
        const mod = await Test.createTestingModule({
            providers: [
                TicketNotificationListener,
                { provide: NotificationService, useValue: notificationService },
                { provide: NotificationCenterService, useValue: notificationCenterService },
                { provide: MailDispatchService, useValue: mailDispatch },
                { provide: getRepositoryToken(User), useValue: userRepo },
                { provide: NotificationPreferenceGate, useValue: gate },
                { provide: getRepositoryToken(TicketParticipant), useValue: participantRepo },
            ],
        }).compile();

        listener = mod.get(TicketNotificationListener);
        jest.clearAllMocks();
        userRepo.findOne.mockReset();
        participantRepo.find.mockResolvedValue([]);
        notificationCenterService.findStaffAtSite.mockResolvedValue([]);
    });

    it('a new general ticket reaches operational support at its site (plus cross-site)', async () => {
        notificationCenterService.findStaffAtSite.mockResolvedValue([
            { id: 'ops-1', fullName: 'Ops Agent', email: 'ops@example.com', role: UserRole.AGENT_OPERATIONAL_SUPPORT },
        ]);

        const event = new TicketCreatedEvent(
            't-1',
            'TK-2026-0001',
            'Printer Rusak',
            'HIGH',
            'HARDWARE',
            'OPEN',
            'u-1',
            'User Requester',
            'user@example.com',
            new Date(),
            'site-spj',
            'SERVICE',
        );

        await listener.handleTicketRoutedEvent({ created: event, assignedToId: null });

        expect(notificationCenterService.findStaffAtSite).toHaveBeenCalledWith([UserRole.AGENT_OPERATIONAL_SUPPORT], 'site-spj');
        expect(mailDispatch.send).toHaveBeenCalledWith(expect.objectContaining({
            to: 'ops@example.com',
            subject: expect.stringContaining('Tiket Baru: #TK-2026-0001'),
        }));
    });

    it('handleTicketCreatedEvent emails a large agent pool a few at a time, not all at once', async () => {
        notificationCenterService.findStaffAtSite.mockResolvedValue(Array.from({ length: 30 }, (_, i) => (
            { id: `ops-${i}`, fullName: `Ops ${i}`, email: `ops${i}@example.com`, role: UserRole.AGENT_OPERATIONAL_SUPPORT })));
        let running = 0;
        let peak = 0;
        mailDispatch.send.mockImplementation(async () => {
            running += 1;
            peak = Math.max(peak, running);
            await new Promise((resolve) => setTimeout(resolve, 2));
            running -= 1;
            return { success: true };
        });

        await listener.handleTicketRoutedEvent({ created: new TicketCreatedEvent(
            't-1', 'TK-2026-0001', 'Printer Rusak', 'HIGH', 'HARDWARE', 'OPEN',
            'u-1', 'User Requester', 'user@example.com', new Date(), 'site-spj', 'SERVICE',
        ), assignedToId: null });

        expect(mailDispatch.send).toHaveBeenCalledTimes(30);
        expect(peak).toBeLessThanOrEqual(NOTIFY_FANOUT_CONCURRENCY);
        mailDispatch.send.mockResolvedValue({ success: true });
    });

    it('handleTicketCreatedEvent sends email to AGENT_ORACLE & AGENT_MOBILE_DEV for Oracle/K2 request', async () => {
        userRepo.find.mockResolvedValue([
            { id: 'oracle-1', fullName: 'Oracle Agent', email: 'oracle@example.com', role: UserRole.AGENT_ORACLE },
            { id: 'mobile-1', fullName: 'Mobile Dev Agent', email: 'mobile@example.com', role: UserRole.AGENT_MOBILE_DEV },
        ]);

        const event = new TicketCreatedEvent(
            't-2',
            'TK-2026-0002',
            'Oracle GL Issue',
            'HIGH',
            'ORACLE_REQUEST',
            'OPEN',
            'u-1',
            'User Requester',
            'user@example.com',
            new Date(),
            'site-spj',
            'ORACLE_REQUEST',
        );

        await listener.handleTicketRoutedEvent({ created: event, assignedToId: null });

        expect(mailDispatch.send).toHaveBeenCalledWith(expect.objectContaining({
            to: 'oracle@example.com',
            subject: expect.stringContaining('Permintaan Oracle/K2 Baru: #TK-2026-0002'),
        }));
        expect(mailDispatch.send).toHaveBeenCalledWith(expect.objectContaining({
            to: 'mobile@example.com',
            subject: expect.stringContaining('Permintaan Oracle/K2 Baru: #TK-2026-0002'),
        }));
    });

    it('handleTicketCreatedEvent sends email to AGENT_ORACLE for Web Dev request', async () => {
        userRepo.find.mockResolvedValue([
            { id: 'oracle-1', fullName: 'Oracle Agent', email: 'oracle@example.com', role: UserRole.AGENT_ORACLE },
        ]);

        const event = new TicketCreatedEvent(
            't-3',
            'TK-2026-0003',
            'Web Portal Bug',
            'MEDIUM',
            'WEB_DEV_REQUEST',
            'OPEN',
            'u-1',
            'User Requester',
            'user@example.com',
            new Date(),
            'site-spj',
            'WEB_DEV_REQUEST',
        );

        await listener.handleTicketRoutedEvent({ created: event, assignedToId: null });

        expect(mailDispatch.send).toHaveBeenCalledWith(expect.objectContaining({
            to: 'oracle@example.com',
            subject: expect.stringContaining('Permintaan Web Dev Baru: #TK-2026-0003'),
        }));
    });

    it('handleTicketCreatedEvent sends email to AGENT_MOBILE_DEV only for Mobile Dev request', async () => {
        userRepo.find.mockResolvedValue([
            { id: 'mobile-1', fullName: 'Mobile Dev Agent', email: 'mobile@example.com', role: UserRole.AGENT_MOBILE_DEV },
        ]);

        const event = new TicketCreatedEvent(
            't-4',
            'TK-2026-0004',
            'Flutter App Crash',
            'HIGH',
            'MOBILE_DEV_REQUEST',
            'OPEN',
            'u-1',
            'User Requester',
            'user@example.com',
            new Date(),
            'site-spj',
            'MOBILE_DEV_REQUEST',
        );

        await listener.handleTicketRoutedEvent({ created: event, assignedToId: null });

        expect(mailDispatch.send).toHaveBeenCalledWith(expect.objectContaining({
            to: 'mobile@example.com',
            subject: expect.stringContaining('Permintaan Mobile Dev Baru: #TK-2026-0004'),
        }));
    });

    it('handleTicketAssignedEvent sends email to assignee AND to requester', async () => {
        const event = new TicketAssignedEvent(
            't-5',
            'TK-2026-0005',
            'agent-1',
            'Budi Support',
            'budi@example.com',
            'Admin Lead',
            'Network Issue',
            'TODO',
            'requester@example.com',
            'Ani User',
        );

        await listener.handleTicketAssignedEvent(event);

        // Email to Assignee
        expect(mailDispatch.send).toHaveBeenCalledWith(expect.objectContaining({
            to: 'budi@example.com',
            subject: expect.stringContaining('Ticket Assigned to You: #TK-2026-0005'),
        }));

        // Email to Requester
        expect(mailDispatch.send).toHaveBeenCalledWith(expect.objectContaining({
            to: 'requester@example.com',
            subject: expect.stringContaining('Ticket Assigned: #TK-2026-0005 - Network Issue'),
            context: expect.objectContaining({
                message: expect.stringContaining('Budi Support'),
            }),
        }));
    });

    it('handleTicketAssignedEvent skips in-app and assignee email on self-assign but still emails the requester', async () => {
        const event = new TicketAssignedEvent(
            't-7', 'TK-2026-0007', 'agent-1', 'Budi Support', 'budi@example.com', 'Budi Support',
            'Network Issue', 'IN_PROGRESS', 'requester@example.com', 'Ani User', 'agent-1',
        );

        await listener.handleTicketAssignedEvent(event);

        expect(notificationService.notifyTicketAssigned).not.toHaveBeenCalled();
        expect(mailDispatch.send).not.toHaveBeenCalledWith(expect.objectContaining({ to: 'budi@example.com' }));
        expect(mailDispatch.send).toHaveBeenCalledWith(expect.objectContaining({
            to: 'requester@example.com',
            subject: expect.stringContaining('Ticket Assigned: #TK-2026-0007 - Network Issue'),
        }));
    });

    it('handleTicketAssignedEvent notifies the assignee in-app when assigned by someone else', async () => {
        const event = new TicketAssignedEvent(
            't-8', 'TK-2026-0008', 'agent-1', 'Budi Support', 'budi@example.com', 'Admin Lead',
            'Network Issue', 'TODO', 'requester@example.com', 'Ani User', 'admin-1',
        );

        await listener.handleTicketAssignedEvent(event);

        expect(notificationService.notifyTicketAssigned).toHaveBeenCalledWith('agent-1', 't-8', 'TK-2026-0008', 'Admin Lead', {
            title: 'Network Issue', requesterName: 'Ani User',
        });
        expect(mailDispatch.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'budi@example.com' }));
        expect(mailDispatch.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'requester@example.com' }));
    });

    it('handleTicketUpdatedEvent sends email to Requester when updated by Agent', async () => {
        const ticket: any = {
            id: 't-6',
            ticketNumber: 'TK-2026-0006',
            title: 'VPN Issue',
            status: TicketStatus.IN_PROGRESS,
            user: { id: 'u-1', fullName: 'Client User', email: 'client@example.com' },
            assignedTo: { id: 'agent-1', fullName: 'Agent Budi', email: 'budi@example.com' },
            assignedToId: 'agent-1',
        };

        const event = new TicketUpdatedEvent('t-6', 'TK-2026-0006', 'agent-1', ['Status changed from TODO to IN_PROGRESS'], ticket);

        await listener.handleTicketUpdatedEvent(event);

        // Requester gets an in-app notice titled with the problem and signed by the PIC
        expect(notificationService.notifyTicketUpdated).toHaveBeenCalledWith('u-1', 't-6', 'TK-2026-0006', 'Status changed from TODO to IN_PROGRESS', {
            title: 'VPN Issue', assigneeName: 'Agent Budi',
        });
        // Requester gets email
        expect(mailDispatch.send).toHaveBeenCalledWith(expect.objectContaining({
            to: 'client@example.com',
            subject: expect.stringContaining('Ticket Updated: #TK-2026-0006'),
        }));
        // Agent does NOT get email for their own update
        expect(mailDispatch.send).not.toHaveBeenCalledWith(expect.objectContaining({
            to: 'budi@example.com',
        }));
    });

    it('handleTicketUpdatedEvent sends email to Assigned Agent when updated by Requester', async () => {
        const ticket: any = {
            id: 't-7',
            ticketNumber: 'TK-2026-0007',
            title: 'Laptop Issue',
            status: TicketStatus.RESOLVED,
            user: { id: 'u-1', fullName: 'Client User', email: 'client@example.com' },
            assignedTo: { id: 'agent-1', fullName: 'Agent Budi', email: 'budi@example.com' },
            assignedToId: 'agent-1',
        };

        const event = new TicketUpdatedEvent('t-7', 'TK-2026-0007', 'u-1', ['Status changed from IN_PROGRESS to RESOLVED'], ticket);

        await listener.handleTicketUpdatedEvent(event);

        // Assigned Agent gets email
        expect(mailDispatch.send).toHaveBeenCalledWith(expect.objectContaining({
            to: 'budi@example.com',
            subject: expect.stringContaining('Ticket Resolved: #TK-2026-0007'),
        }));
        // Requester does NOT get email for their own action
        expect(mailDispatch.send).not.toHaveBeenCalledWith(expect.objectContaining({
            to: 'client@example.com',
        }));
    });

    it('a reply sends no email per message - unread chat is emailed later by the digest', async () => {
        const event = new TicketRepliedEvent(
            't-8', 'TK-2026-0008', 'Laptop Setup', 'IN_PROGRESS', 'u-1', 'ani@example.com', 'Ani User', 'agent-1',
            { id: 'm-1', content: 'Terima kasih atas infonya' } as any, 'u-1', 'Ani User', UserRole.USER, [],
        );

        await listener.handleTicketRepliedEvent(event);

        expect(mailDispatch.send).not.toHaveBeenCalled();
        expect(notificationService.notifyTicketReply).toHaveBeenCalledWith('agent-1', 't-8', 'TK-2026-0008', 'Ani User', 'Terima kasih atas infonya', 'm-1');
        expect(notificationService.notifyTicketReply).not.toHaveBeenCalledWith('u-1', expect.anything(), expect.anything(), expect.anything(), expect.anything(), expect.anything());
    });

    it('participants get the reply in-app; internal notes reach staff only; mentioned people get only the mention', async () => {
        participantRepo.find.mockResolvedValue([{ userId: 'staff-p' }, { userId: 'user-p' }]);
        userRepo.find.mockResolvedValue([{ id: 'agent-1', role: UserRole.AGENT }, { id: 'staff-p', role: UserRole.AGENT }, { id: 'user-p', role: UserRole.USER }]);
        userRepo.findOne.mockResolvedValue({ id: 'staff-p', email: 'p@example.com', fullName: 'P', role: UserRole.AGENT });

        await listener.handleTicketRepliedEvent(new TicketRepliedEvent(
            't-8', 'TK-2026-0008', 'Laptop', 'IN_PROGRESS', 'u-1', 'ani@example.com', 'Ani', 'agent-1',
            { id: 'm-2', content: 'internal', isInternal: true } as any, 'agent-2', 'Budi', UserRole.AGENT, ['staff-p'],
        ));

        const recipients = notificationService.notifyTicketReply.mock.calls.map((c: any[]) => c[0]);
        expect(recipients).toEqual(['agent-1']);
    });

    it('takeover by status sends the requester one email (the status one), not a second "assigned" email', async () => {
        await listener.handleTicketAssignedEvent(new TicketAssignedEvent(
            't-7', 'TK-2026-0007', 'agent-1', 'Budi', 'budi@example.com', 'Budi',
            'Network', 'IN_PROGRESS', 'requester@example.com', 'Ani', 'agent-1', true,
        ));
        expect(mailDispatch.send).not.toHaveBeenCalled();
    });

    it('priority-only changes stay in-app, no email', async () => {
        const ticket: any = {
            id: 't-6', ticketNumber: 'TK-2026-0006', title: 'VPN', status: TicketStatus.IN_PROGRESS,
            user: { id: 'u-1', fullName: 'Client', email: 'client@example.com' }, assignedToId: 'agent-1',
            assignedTo: { id: 'agent-1', fullName: 'Budi', email: 'budi@example.com' },
        };
        await listener.handleTicketUpdatedEvent(new TicketUpdatedEvent('t-6', 'TK-2026-0006', 'agent-1', ['Priority changed from LOW to HIGH'], ticket));
        expect(notificationService.notifyTicketUpdated).toHaveBeenCalled();
        expect(mailDispatch.send).not.toHaveBeenCalled();
    });

    it('a new ticket: the requester gets an email receipt only; an auto-assigned ticket is not broadcast to the team', async () => {
        const created = new TicketCreatedEvent(
            't-1', 'TK-2026-0001', 'Printer', 'HIGH', 'HARDWARE', 'OPEN', 'u-1', 'Ani', 'ani@example.com', new Date(), 'site-spj', 'SERVICE', 'agent-9',
        );
        await listener.handleTicketCreatedEvent(created);
        expect(notificationService.notifyTicketCreated).not.toHaveBeenCalled();
        expect(mailDispatch.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'ani@example.com' }));

        mailDispatch.send.mockClear();
        await listener.handleTicketRoutedEvent({ created, assignedToId: 'agent-3' });
        expect(notificationCenterService.findStaffAtSite).not.toHaveBeenCalled();
        expect(mailDispatch.send).not.toHaveBeenCalled();

        notificationCenterService.findStaffAtSite.mockResolvedValue([{ id: 'agent-9', email: 'a9@x.co' }, { id: 'ops-2', email: 'o2@x.co' }]);
        await listener.handleTicketRoutedEvent({ created, assignedToId: null });
        // Staff who filed it for the requester is left out.
        expect(mailDispatch.send.mock.calls.map((c: any[]) => c[0].to)).toEqual(['o2@x.co']);
    });

    it('handleTicketRepliedEvent ties each reply notification to its message, so a delete can take the snippet back', async () => {
        const event = new TicketRepliedEvent(
            't-8', 'TK-2026-0008', 'Laptop Setup', 'IN_PROGRESS', 'u-1', 'ani@example.com', 'Ani User', 'agent-1',
            { id: 'm-9', content: 'Sudah saya cek' } as any, 'agent-2', 'Budi Agent', UserRole.AGENT, [],
        );

        await listener.handleTicketRepliedEvent(event);

        expect(notificationService.notifyTicketReply).toHaveBeenCalledWith('u-1', 't-8', 'TK-2026-0008', 'Budi Agent', 'Sudah saya cek', 'm-9');
        expect(notificationService.notifyTicketReply).toHaveBeenCalledWith('agent-1', 't-8', 'TK-2026-0008', 'Budi Agent', 'Sudah saya cek', 'm-9');
    });

    it('the mention e-mail links to the ticket page of the mentioned person\'s portal', async () => {
        userRepo.findOne.mockResolvedValueOnce({ id: 'u-1', email: 'ani@example.com', fullName: 'Ani', role: UserRole.USER });
        const event = new TicketRepliedEvent(
            't-8', 'TK-2026-0008', 'Laptop', 'IN_PROGRESS', 'u-1', 'ani@example.com', 'Ani', 'agent-1',
            { id: 'm-1', content: '@Ani cek' } as any, 'agent-2', 'Budi', UserRole.AGENT, ['u-1'],
        );

        await listener.handleTicketRepliedEvent(event);

        const mention = mailDispatch.send.mock.calls.map((c: any[]) => c[0]).find((m: any) => m.template === 'mention-notification');
        expect(mention.context.link).toContain('/client/tickets/t-8');
        expect(mention.context.link).not.toContain('/admin/');
    });

    it('handleTicketCancelledEvent sends email to Assigned Agent when Requester cancels', async () => {
        userRepo.findOne.mockResolvedValueOnce({
            id: 'agent-1',
            fullName: 'Agent Budi',
            email: 'budi@example.com',
        });

        const event = new TicketCancelledEvent(
            't-9',
            'TK-2026-0009',
            'Meeting Room Display',
            'u-1',
            'Ani User',
            UserRole.USER,
            'Sudah solved sendiri',
            'u-1',
            'agent-1',
        );

        await listener.handleTicketCancelledEvent(event);

        expect(mailDispatch.send).toHaveBeenCalledWith(expect.objectContaining({
            to: 'budi@example.com',
            subject: expect.stringContaining('Ticket Cancelled: #TK-2026-0009'),
        }));
    });
    it('handleTicketCancelledEvent emails the requester with the reason when an operational agent cancels', async () => {
        userRepo.findOne.mockResolvedValueOnce({ id: 'u-1', fullName: 'Ani User', email: 'ani@example.com' });

        const event = new TicketCancelledEvent(
            't-10', 'TK-2026-0010', 'Printer', 'agent-2', 'Agent Sari',
            UserRole.AGENT_OPERATIONAL_SUPPORT, 'Duplikat tiket lain', 'u-1', 'agent-2',
        );

        await listener.handleTicketCancelledEvent(event);

        expect(mailDispatch.send).toHaveBeenCalledWith(expect.objectContaining({
            to: 'ani@example.com',
            context: expect.objectContaining({ message: expect.stringContaining('Alasan: Duplikat tiket lain') }),
        }));
    });

    it('skips the email for people who turned email off for that notification type', async () => {
        gate.allows.mockImplementation(async (userId: string) => userId !== 'u-1');
        const ticket: any = {
            id: 't-6', ticketNumber: 'TK-6', title: 'VPN', status: TicketStatus.IN_PROGRESS,
            user: { id: 'u-1', fullName: 'Client', email: 'client@example.com' }, assignedToId: 'agent-1',
            assignedTo: { id: 'agent-1', fullName: 'Budi', email: 'budi@example.com' },
        };
        await listener.handleTicketUpdatedEvent(new TicketUpdatedEvent('t-6', 'TK-6', 'agent-2', ['Status changed from TODO to IN_PROGRESS'], ticket));
        expect(mailDispatch.send.mock.calls.map((c: any[]) => c[0].to)).toEqual(['budi@example.com']);
        gate.allows.mockResolvedValue(true);
    });
});
