import { NotificationCenterService } from './notification-center.service';
import { UserRole } from '../users/enums/user-role.enum';
import { ActionItemEntityType, ActionItemUrgency } from './dto/action-item.dto';

describe('NotificationCenterService Action Items', () => {
    let service: NotificationCenterService;
    const snoozeRepo = {
        find: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockResolvedValue(undefined),
        delete: jest.fn().mockResolvedValue(undefined),
    };
    const eventsGateway = {
        server: {
            to: jest.fn().mockReturnThis(),
            emit: jest.fn(),
        },
    };
    const notificationRepo = {} as any;
    const preferenceRepo = {
        findOne: jest.fn().mockResolvedValue({
            categorySettings: { TICKET: true, HARDWARE_REQUEST: true, EFORM: true, RENEWAL: true, ZOOM: true },
        }),
        update: jest.fn().mockResolvedValue(undefined),
    };
    const logRepo = {} as any;
    const userRepo = {} as any;
    const emailChannel = {} as any;
    const inAppChannel = {} as any;
    const pushChannel = {} as any;
    const entityManager = {
        query: jest.fn(),
    };
    const cacheService = {
        getOrSet: jest.fn((key, fn) => fn()),
        delByPattern: jest.fn().mockResolvedValue(1),
    };

    beforeEach(() => {
        service = new NotificationCenterService(
            snoozeRepo as any,
            eventsGateway as any,
            notificationRepo,
            preferenceRepo as any,
            logRepo,
            userRepo,
            emailChannel,
            inAppChannel,
            pushChannel,
            entityManager as any,
            cacheService as any,
        );
        jest.clearAllMocks();
    });

    it('emitActionItemsRefresh clears cache by pattern and emits socket event', () => {
        service.emitActionItemsRefresh('u-1', 'TICKET', 't-1');

        expect(cacheService.delByPattern).toHaveBeenCalledWith('action-items:u-1:*');
        expect(eventsGateway.server.to).toHaveBeenCalledWith('user:u-1');
        expect(eventsGateway.server.emit).toHaveBeenCalledWith('action-items:refresh:u-1', {
            entityType: 'TICKET',
            entityId: 't-1',
        });
    });

    it('getActionItems returns SLA breached tickets and Zoom bookings for AGENT_OPERATIONAL_SUPPORT', async () => {
        entityManager.query.mockImplementation((sql: string) => {
            if (sql.includes('tickets') && sql.includes('slaTarget')) {
                return Promise.resolve([
                    { id: 't-1', ticketNumber: 'TK-001', title: 'Server Down', createdAt: new Date(), updatedAt: new Date() },
                ]);
            }
            if (sql.includes('zoom_bookings')) {
                return Promise.resolve([
                    { id: 'z-1', title: 'Daily Standup', startTime: '09:00', endTime: '10:00', status: 'CONFIRMED', createdAt: new Date() },
                ]);
            }
            return Promise.resolve([]);
        });

        const result = await service.getActionItems('agent-1', UserRole.AGENT_OPERATIONAL_SUPPORT, 'site-1');

        expect(result.items).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    entityType: ActionItemEntityType.TICKET,
                    title: 'SLA Breached: TK-001',
                    urgency: ActionItemUrgency.CRITICAL,
                }),
                expect.objectContaining({
                    entityType: ActionItemEntityType.ZOOM,
                    title: 'Zoom Meeting: Daily Standup',
                }),
            ])
        );
    });

    it('getActionItems returns resolved tickets and hardware confirmation for USER', async () => {
        entityManager.query.mockImplementation((sql: string) => {
            if (sql.includes('tickets') && sql.includes("status = 'RESOLVED'")) {
                return Promise.resolve([
                    { id: 't-2', ticketNumber: 'TK-002', title: 'Printer Issue', updatedAt: new Date(), resolutionDeadlineAt: new Date('2026-09-30T03:00:00Z') },
                ]);
            }
            if (sql.includes('hardware_requests') && sql.includes('AWAITING_USER_CONFIRMATION')) {
                return Promise.resolve([
                    { id: 'hw-1', requestNumber: 'HR-001', status: 'AWAITING_USER_CONFIRMATION', createdAt: new Date() },
                ]);
            }
            return Promise.resolve([]);
        });

        const result = await service.getActionItems('user-1', UserRole.USER);

        expect(result.items).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    entityType: ActionItemEntityType.TICKET,
                    title: 'Ticket Resolved: TK-002',
                    // The requester has a deadline before auto-close, so it is urgent.
                    urgency: ActionItemUrgency.HIGH,
                    description: expect.stringContaining('sebelum'),
                }),
                expect.objectContaining({
                    entityType: ActionItemEntityType.HARDWARE_REQUEST,
                    title: 'Konfirmasi Penerimaan Hardware',
                    urgency: ActionItemUrgency.HIGH,
                }),
            ])
        );
    });

    it('getActionItems returns disputed tickets to the assigned agent', async () => {
        entityManager.query.mockImplementation((sql: string) => {
            if (sql.includes('"disputedAt" IS NOT NULL')) {
                return Promise.resolve([{ id: 't-3', ticketNumber: 'TK-003', title: 'VPN', disputedAt: new Date() }]);
            }
            return Promise.resolve([]);
        });

        const result = await service.getActionItems('agent-1', UserRole.AGENT_OPERATIONAL_SUPPORT, 'site-1');

        expect(result.items).toEqual([
            expect.objectContaining({ id: 'tkt-dispute-t-3', title: 'Resolusi Disanggah: TK-003', urgency: ActionItemUrgency.HIGH }),
        ]);
    });

    it('does not count closed tickets as SLA breached', async () => {
        entityManager.query.mockResolvedValue([]);
        await service.getActionItems('agent-1', UserRole.AGENT_OPERATIONAL_SUPPORT, 'site-1');
        const slaSql = entityManager.query.mock.calls.map((c: any[]) => c[0]).find((sql: string) => sql.includes('slaTarget'));
        expect(slaSql).toContain("'CLOSED'");
    });

    it('routes HW/E-Form flow approvals via /client/tickets/:ticketId for USER and /tickets/:ticketId for staff, and skips non-active turn', async () => {
        entityManager.query.mockImplementation((sql: string) => {
            if (sql.includes('FROM request_flows f')) {
                return Promise.resolve([
                    {
                        ticketId: 'tkt-hw-1', kind: 'HARDWARE', route: 'MANAGER_GM', returnedReason: null,
                        managerId: 'approver-u', gmId: 'gm-2', id: 'hw-10', number: 'HR-2026-0010',
                        formType: null, status: 'UNDER_REVIEW', requesterId: 'req-1', createdAt: new Date(),
                        managerSigned: false, gmSigned: false,
                    },
                    {
                        // GM turn only — manager already signed, so not approver-u's turn if approver-u is manager
                        ticketId: 'tkt-hw-2', kind: 'HARDWARE', route: 'MANAGER_GM', returnedReason: null,
                        managerId: 'approver-u', gmId: 'gm-2', id: 'hw-11', number: 'HR-2026-0011',
                        formType: null, status: 'UNDER_REVIEW', requesterId: 'req-1', createdAt: new Date(),
                        managerSigned: true, gmSigned: false,
                    },
                    {
                        ticketId: 'tkt-ef-1', kind: 'EFORM', route: 'MANAGER', returnedReason: null,
                        managerId: 'approver-u', gmId: null, id: 'ef-10', number: 'F/ICT/04/0010',
                        formType: 'VPN', status: 'PENDING_MANAGER', requesterId: 'req-1', createdAt: new Date(),
                        managerSigned: false, gmSigned: false,
                    },
                ]);
            }
            return Promise.resolve([]);
        });

        const userResult = await service.getActionItems('approver-u', UserRole.USER, 'site-1');
        expect(userResult.items.map((i: any) => ({ id: i.id, title: i.title, link: i.link }))).toEqual([
            { id: 'hw-hw-10', title: 'Hardware Approval Pending', link: '/client/tickets/tkt-hw-1' },
            { id: 'ef-ef-10', title: 'E-Form Approval Pending', link: '/client/tickets/tkt-ef-1' },
        ]);

        const agentResult = await service.getActionItems('approver-u', UserRole.AGENT, 'site-2');
        expect(agentResult.items.map((i: any) => ({ id: i.id, link: i.link }))).toEqual([
            { id: 'hw-hw-10', link: '/tickets/tkt-hw-1' },
            { id: 'ef-ef-10', link: '/tickets/tkt-ef-1' },
        ]);
    });

    it('gives AGENT_OPERATIONAL_SUPPORT E-Form review/provisioning items and HW confirmation link to /client/tickets for USER', async () => {
        entityManager.query.mockImplementation((sql: string, params: any[]) => {
            if (sql.includes("ef.status IN ('PENDING_REVIEW', 'PENDING_ICT')")) {
                return Promise.resolve([
                    { id: 'ef-20', formType: 'VPN', status: 'PENDING_ICT', createdAt: new Date(), ticketId: 'tkt-ef-20' },
                ]);
            }
            if (sql.includes('hardware_requests') && sql.includes('AWAITING_USER_CONFIRMATION') && params[0] === 'req-1') {
                return Promise.resolve([
                    { id: 'hw-1', requestNumber: 'HR-001', status: 'AWAITING_USER_CONFIRMATION', createdAt: new Date(), ticketId: 'tkt-hw-1' },
                ]);
            }
            return Promise.resolve([]);
        });

        const opsResult = await service.getActionItems('ops-1', UserRole.AGENT_OPERATIONAL_SUPPORT, 'site-1');
        expect(opsResult.items).toEqual([
            expect.objectContaining({ id: 'ef-ict-ef-20', title: 'E-Form Provisioning Pending', link: '/tickets/tkt-ef-20' }),
        ]);

        const userResult = await service.getActionItems('req-1', UserRole.USER);
        expect(userResult.items).toEqual([
            expect.objectContaining({ id: 'hw-confirm-hw-1', link: '/client/tickets/tkt-hw-1' }),
        ]);
    });
});
