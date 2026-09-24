import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationService } from './notification.service';
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
