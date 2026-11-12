import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationService, NOTIFICATIONS_READ_EVENT } from './notification.service';
import { Notification, NotificationType, NotificationCategory } from './entities/notification.entity';
import { EventsGateway } from '../ticketing/presentation/gateways/events.gateway';
import { SjaAdapterService } from '../sja-adapter/sja-adapter.service';
import { IsNull } from 'typeorm';

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
        expect(result?.id).toBe('notif-1');
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

describe('NotificationService - readable ticket notices', () => {
    const build = () => {
        const repo = {
            findOne: jest.fn().mockResolvedValue(null),
            create: jest.fn((x) => ({ ...x })),
            save: jest.fn((x) => Promise.resolve({ id: 'n-1', ...x })),
        };
        const emit = jest.fn();
        const eventsGateway = { server: { to: jest.fn().mockReturnValue({ emit }) } };
        const sja = { dispatchNotification: jest.fn() };
        const service = new NotificationService(repo as any, eventsGateway as any, sja as any);
        return { service, repo, emit, sja };
    };

    it('titles an update with the problem and signs it with the PIC', async () => {
        const { service, repo, sja } = build();
        await service.notifyTicketUpdated('u-1', 't-1', '281026-ORD-0012',
            'Status changed from RESOLVED to CLOSED (otomatis, batas konfirmasi terlewati)',
            { title: 'Printer lantai 2 tidak bisa print', assigneeName: 'Rizky Ardiansyah' });

        const stored = repo.create.mock.calls[0][0];
        expect(stored).toMatchObject({
            title: 'Printer lantai 2 tidak bisa print',
            message: 'Ditutup otomatis: tidak dikonfirmasi dalam batas waktu · PIC Rizky Ardiansyah',
        });
        // Display hints are not columns.
        expect(stored).not.toHaveProperty('ticketNumber');
        expect(stored).not.toHaveProperty('senderName');
        expect(sja.dispatchNotification).toHaveBeenCalledWith(expect.objectContaining({
            ticketNumber: '281026-ORD-0012', senderName: 'Rizky Ardiansyah',
        }));
    });

    it('tells the PIC who reported the ticket', async () => {
        const { service, repo, emit } = build();
        await service.notifyTicketAssigned('agent-1', 't-1', '281026-ORD-0012', 'Auto-assign',
            { title: 'Printer lantai 2 tidak bisa print', requesterName: 'Budi Santoso' });

        expect(repo.create.mock.calls[0][0]).toMatchObject({
            title: 'Printer lantai 2 tidak bisa print',
            message: 'Ditugaskan kepada Anda secara otomatis · Dilaporkan oleh Budi Santoso',
        });
        expect(emit).toHaveBeenCalledWith('notification:agent-1', expect.objectContaining({ senderName: 'Budi Santoso', ticketNumber: '281026-ORD-0012' }));
    });

    it('falls back to the ticket number, never an id, without a title', async () => {
        const { service, repo } = build();
        await service.notifyTicketUpdated('u-1', 't-1', '281026-ORD-0012', 'Status changed from RESOLVED to CLOSED');
        expect(repo.create.mock.calls[0][0]).toMatchObject({ title: 'Tiket #281026-ORD-0012', message: 'Status: Selesai → Ditutup' });
    });

    it('lists a new ticket for agents by its problem and reporter', async () => {
        const { service, repo } = build();
        repo.save.mockImplementation((xs: any[]) => Promise.resolve(xs.map((x, i) => ({ id: `n-${i}`, ...x }))));
        await service.notifyNewTicketToAdmins('t-1', '281026-ORD-0012', 'Printer lantai 2 tidak bisa print', 'HIGH', 'HARDWARE', 'Budi Santoso', ['a-1']);
        expect(repo.create.mock.calls[0][0]).toMatchObject({
            title: 'Printer lantai 2 tidak bisa print',
            message: 'Tiket baru · Urgent · Hardware · Dilaporkan oleh Budi Santoso',
        });
    });
});

describe('NotificationService - critical acknowledgement filter', () => {
    // TypeORM drops `undefined` where-values, which used to turn "unacknowledged" into "all".
    it('queries only unacknowledged critical notifications, with a cap', async () => {
        const repo = { find: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) };
        const service = new NotificationService(repo as any, {} as any, {} as any);

        await service.findUnacknowledgedCritical('user-1');
        await service.countUnacknowledgedCritical('user-1');

        const findArgs = repo.find.mock.calls[0][0];
        expect(findArgs.where).toEqual({ userId: 'user-1', requiresAcknowledge: true, acknowledgedAt: IsNull() });
        expect(findArgs.take).toBeGreaterThan(0);
        expect(repo.count.mock.calls[0][0].where.acknowledgedAt).toEqual(IsNull());
    });
});

describe('NotificationService - chat message snippets', () => {
    const build = () => {
        const qb: any = {
            update: jest.fn(() => qb), set: jest.fn(() => qb), where: jest.fn(() => qb), andWhere: jest.fn(() => qb),
            execute: jest.fn().mockResolvedValue({ affected: 2 }),
        };
        const repo: any = {
            findOne: jest.fn().mockResolvedValue(null),
            create: jest.fn((x) => ({ id: 'n-1', ...x })),
            save: jest.fn((x) => Promise.resolve({ id: 'n-1', ...x })),
            createQueryBuilder: jest.fn(() => qb),
        };
        const gateway: any = { server: { to: jest.fn().mockReturnValue({ emit: jest.fn() }) } };
        const sja: any = { isAvailable: jest.fn().mockResolvedValue(false), dispatchNotification: jest.fn() };
        return { service: new NotificationService(repo, gateway, sja), repo, qb };
    };

    it('ties a reply notification to its message, without deduplicating replies', async () => {
        const { service, repo } = build();
        await service.notifyTicketReply('u-1', 't-1', 'GEN-1', 'Budi', 'rahasia', 'm-1');
        expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ referenceId: 'm-1', message: 'Budi: "rahasia"' }));
    });

    it('groups replies per ticket while unread: the next one updates the row instead of adding one', async () => {
        const { service, repo } = build();
        repo.update = jest.fn();
        // First lookup: the unread grouped row; dedup lookups inside create() are not reached.
        repo.findOne.mockResolvedValueOnce({ id: 'n-1', userId: 'u-1', ticketId: 't-1', title: '[#GEN-1] 2 pesan baru', isRead: false });

        await service.notifyTicketReply('u-1', 't-1', 'GEN-1', 'Sari', 'lagi', 'm-3');

        expect(repo.create).not.toHaveBeenCalled();
        expect(repo.update).toHaveBeenCalledWith({ id: 'n-1' }, expect.objectContaining({
            title: '[#GEN-1] 3 pesan baru', message: 'Sari: "lagi"', referenceId: 'm-3',
        }));
    });

    it('replaces the snippet of a deleted message in stored notifications', async () => {
        const { service, qb } = build();
        await service.redactMessageSnippet({ messageId: 'm-1', ticketId: 't-1', ticketNumber: 'GEN-1', senderName: 'Budi', sentAt: new Date('2026-11-01T08:00:00Z') });
        expect(qb.set).toHaveBeenCalledWith({ message: 'Budi membalas tiket #GEN-1' });
        // Flatten the where tree: Brackets are expanded by running their callback on a recorder.
        const parts: string[] = [];
        const record = (cond: any) => {
            if (typeof cond === 'string') { parts.push(cond); return; }
            const sub: any = { where: (c: any) => (record(c), sub), andWhere: (c: any) => (record(c), sub), orWhere: (c: any) => (record(c), sub) };
            cond.whereFactory(sub);
        };
        [qb.where.mock.calls[0][0], ...qb.andWhere.mock.calls.map((c: any[]) => c[0])].forEach(record);
        const where = parts.join(' ');
        expect(where).toContain('"referenceId" = :messageId');
        // Notifications written before referenceId existed are matched by ticket, type and time.
        expect(where).toContain('"ticketId" = :ticketId');
        expect(where).toContain('"createdAt" BETWEEN');
    });
});


describe('NotificationService - user settings', () => {
    const build = (allows: (channel: string) => boolean) => {
        const repo: any = {
            findOne: jest.fn().mockResolvedValue(null),
            create: jest.fn((x) => ({ id: 'n-1', ...x })),
            save: jest.fn((x) => Promise.resolve({ id: 'n-1', ...x })),
        };
        const gateway: any = { server: { to: jest.fn().mockReturnValue({ emit: jest.fn() }) } };
        const sja: any = { dispatchNotification: jest.fn() };
        const push: any = { dispatch: jest.fn() };
        const gate: any = { allows: jest.fn(async (_u: string, channel: string) => allows(channel)) };
        return { service: new NotificationService(repo, gateway, sja, push, undefined, gate), repo, push };
    };
    const input = { userId: 'u-1', type: NotificationType.TICKET_UPDATED, title: 't', message: 'm', link: '/tickets/1' };

    it('stores nothing when the user turned in-app off for the type', async () => {
        const { service, repo, push } = build((c) => c !== 'in_app');
        expect(await service.create(input)).toBeNull();
        expect(repo.save).not.toHaveBeenCalled();
        expect(push.dispatch).not.toHaveBeenCalled();
    });

    it('stores it but does not push when push is off or in quiet hours', async () => {
        const { service, repo, push } = build((c) => c !== 'push');
        await service.create(input);
        expect(repo.save).toHaveBeenCalled();
        expect(push.dispatch).not.toHaveBeenCalled();
    });
});
