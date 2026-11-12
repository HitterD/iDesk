import { SlaCheckerService } from './sla-checker.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { UserRole } from '../users/enums/user-role.enum';

describe('SlaCheckerService', () => {
    let ticketRepo: any;
    let mail: any;
    let notifications: any;
    let center: any;
    let service: SlaCheckerService;

    beforeEach(() => {
        ticketRepo = {
            query: jest.fn(async (sql: string) => (sql.includes('"isOverdue" = true') ? [[{ id: 't1' }], 1] : [[], 0])),
            find: jest.fn().mockResolvedValue([{
                id: 't1', ticketNumber: 'GEN-1', title: '<b>Printer</b>', siteId: 's1', assignedToId: 'agent-1',
                assignedTo: { id: 'agent-1', fullName: 'Budi', email: 'budi@x.co' },
            }]),
        };
        mail = { send: jest.fn().mockResolvedValue({ success: true }) };
        notifications = { create: jest.fn().mockResolvedValue({}) };
        center = { findStaffAtSite: jest.fn().mockResolvedValue([{ id: 'mgr-1', email: 'mgr@x.co' }]) };
        service = new SlaCheckerService(ticketRepo, mail, notifications, center);
    });

    it('tells the PIC and the site managers in-app and by templated (escaped) email - no global address', async () => {
        await service.checkSla();

        expect(center.findStaffAtSite).toHaveBeenCalledWith([UserRole.MANAGER], 's1', ['agent-1']);
        expect(notifications.create.mock.calls.map((c: any[]) => c[0].userId)).toEqual(['agent-1', 'mgr-1']);
        expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({
            type: NotificationType.SLA_BREACHED, referenceId: 't1_sla_resolution', link: '/tickets/t1',
        }));
        expect(mail.send.mock.calls.map((c: any[]) => c[0].to)).toEqual(['budi@x.co', 'mgr@x.co']);
        expect(mail.send.mock.calls.every((c: any[]) => c[0].template === 'notification' && !c[0].html)).toBe(true);
    });

    it('claims breaches atomically, so a ticket another instance already marked is not notified again', async () => {
        ticketRepo.query.mockResolvedValue([[], 0]);
        await service.checkSla();
        expect(ticketRepo.find).not.toHaveBeenCalled();
        expect(notifications.create).not.toHaveBeenCalled();
    });
});
