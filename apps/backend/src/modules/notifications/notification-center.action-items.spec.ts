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
    const telegramChannel = {} as any;
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
            telegramChannel,
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
                    { id: 't-2', ticketNumber: 'TK-002', title: 'Printer Issue', updatedAt: new Date() },
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
                    urgency: ActionItemUrgency.NORMAL,
                }),
                expect.objectContaining({
                    entityType: ActionItemEntityType.HARDWARE_REQUEST,
                    title: 'Konfirmasi Penerimaan Hardware',
                    urgency: ActionItemUrgency.HIGH,
                }),
            ])
        );
    });
});
