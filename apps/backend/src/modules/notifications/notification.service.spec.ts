import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationService, NOTIFICATIONS_READ_EVENT } from './notification.service';
import { Notification, NotificationType, NotificationCategory } from './entities/notification.entity';
import { EventsGateway } from '../ticketing/presentation/gateways/events.gateway';
import { SjaAdapterService } from '../sja-adapter/sja-adapter.service';

describe('NotificationService - Deduplication', () => {
    let service: NotificationService;
    let repo: any;
    let eventsGateway: any;
    let sjaAdapter: any;

    beforeEach(async () => {
        repo = {
            findOne: jest.fn(),
            create: jest.fn((x) => ({ id: 'notif-1', ...x })),
            save: jest.fn((x) => Promise.resolve({ id: 'notif-1', ...x })),
        };
        eventsGateway = {
            server: {
                to: jest.fn().mockReturnValue({ emit: jest.fn() }),
                emit: jest.fn(),
            },
        };
        sjaAdapter = {
            isAvailable: jest.fn().mockResolvedValue(false),
            forwardNotification: jest.fn().mockResolvedValue(null),
            dispatchNotification: jest.fn().mockResolvedValue(null),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                NotificationService,
                { provide: getRepositoryToken(Notification), useValue: repo },
                { provide: EventsGateway, useValue: eventsGateway },
                { provide: SjaAdapterService, useValue: sjaAdapter },
            ],
        }).compile();

        service = module.get<NotificationService>(NotificationService);
    });

    it('deduplicates when referenceId is provided and existing notif found within 24h', async () => {
        const existing = { id: 'existing-1', title: 'Request selesai', referenceId: 'req-1_completed' };
        repo.findOne.mockResolvedValue(existing);

        const result = await service.create({
            userId: 'user-1',
            type: NotificationType.HARDWARE_REQUEST_COMPLETED_LEAD,
            title: 'Request selesai',
            message: 'HR-2026-0017',
            referenceId: 'req-1_completed',
            link: '/hardware-requests/req-1',
        });

        expect(result).toBe(existing);
        expect(repo.save).not.toHaveBeenCalled();
    });

    it('fallback deduplicates when referenceId is missing but same user, type, title, message within 5m', async () => {
        const existing = { id: 'existing-2', title: 'Request selesai', message: 'HR-2026-0017' };
        repo.findOne.mockResolvedValue(existing);

        const result = await service.create({
            userId: 'user-1',
            type: NotificationType.HARDWARE_REQUEST_COMPLETED_LEAD,
            title: 'Request selesai',
            message: 'HR-2026-0017',
            link: '/hardware-requests/req-1',
        });

        expect(result).toBe(existing);
        expect(repo.save).not.toHaveBeenCalled();
    });

    it('creates new notification when no existing duplicate found', async () => {
        repo.findOne.mockResolvedValue(null);

        const result = await service.create({
            userId: 'user-1',
            type: NotificationType.HARDWARE_REQUEST_COMPLETED_LEAD,
            title: 'Request selesai',
            message: 'HR-2026-0017',
            referenceId: 'req-1_completed',
            link: '/hardware-requests/req-1',
        });

        expect(repo.save).toHaveBeenCalled();
        expect(result.id).toBe('notif-1');
    });
});

describe('NotificationService - markReadByTarget', () => {
    const build = (affected: number) => {
        const query: any = {
            update: jest.fn().mockReturnThis(),
            set: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            execute: jest.fn().mockResolvedValue({ affected }),
        };
        const repo = { createQueryBuilder: jest.fn(() => query) };
        const emit = jest.fn();
        const eventsGateway = { server: { to: jest.fn().mockReturnValue({ emit }) } };
        const service = new NotificationService(repo as never, eventsGateway as never, {} as never);
        return { service, query, emit, eventsGateway };
    };

    it('marks only the opened ticket and tells the user\'s other clients', async () => {
        const { service, query, emit, eventsGateway } = build(2);

        const updated = await service.markReadByTarget('user-1', { ticketId: 't-1' });

        expect(updated).toBe(2);
        expect(query.where).toHaveBeenCalledWith('"userId" = :userId', { userId: 'user-1' });
        expect(query.andWhere).toHaveBeenCalledWith('"ticketId" = :ticketId', { ticketId: 't-1' });
        expect(eventsGateway.server.to).toHaveBeenCalledWith('user:user-1');
        expect(emit).toHaveBeenCalledWith(NOTIFICATIONS_READ_EVENT, { userId: 'user-1' });
    });

    it('matches hardware step keys that extend the reference id', async () => {
        const { service, query } = build(1);

        await service.markReadByTarget('user-1', { referenceId: 'req-1' });

        expect(query.andWhere).toHaveBeenCalledWith(
            '("referenceId" = :referenceId OR "referenceId" LIKE :referencePrefix)',
            { referenceId: 'req-1', referencePrefix: 'req-1\\_%' },
        );
    });

    it('marks a whole category', async () => {
        const { service, query } = build(1);

        await service.markReadByTarget('user-1', { category: NotificationCategory.CATEGORY_ZOOM });

        expect(query.andWhere).toHaveBeenCalledWith('"category" = :category', { category: NotificationCategory.CATEGORY_ZOOM });
    });

    it('stays silent when nothing was unread', async () => {
        const { service, emit } = build(0);

        await service.markReadByTarget('user-1', { ticketId: 't-1' });

        expect(emit).not.toHaveBeenCalled();
    });

    it('does nothing without a target', async () => {
        const { service, query } = build(5);

        expect(await service.markReadByTarget('user-1', {})).toBe(0);
        expect(query.execute).not.toHaveBeenCalled();
    });
});
