import { NotificationRetentionService, LOG_RETENTION_DAYS, READ_RETENTION_DAYS, UNREAD_RETENTION_DAYS } from './notification-retention.service';

describe('NotificationRetentionService', () => {
    const now = new Date('2026-11-12T19:30:00Z');
    const day = 86_400_000;
    let dataSource: any;
    let push: any;
    let service: NotificationRetentionService;

    beforeEach(() => {
        dataSource = { query: jest.fn(async (sql: string) => (sql.startsWith('INSERT') ? [{ job: 'x' }] : [[], 3])) };
        push = { cleanupInactiveSubscriptions: jest.fn().mockResolvedValue(2) };
        service = new NotificationRetentionService(dataSource, push);
    });

    it('prunes old logs, read and very old unread notifications, and dead push subscriptions', async () => {
        const result = await service.prune(now);

        expect(result).toEqual({ notifications: 3, logs: 3, subscriptions: 2, jobRuns: 3 });
        const notificationDelete = dataSource.query.mock.calls.find((c: any[]) => c[0].includes('DELETE FROM "notifications"'));
        expect(notificationDelete[0]).toContain('"requiresAcknowledge" = true AND n."acknowledgedAt" IS NULL');
        expect(now.getTime() - notificationDelete[1][0].getTime()).toBe(READ_RETENTION_DAYS * day);
        expect(now.getTime() - notificationDelete[1][1].getTime()).toBe(UNREAD_RETENTION_DAYS * day);
        const logDelete = dataSource.query.mock.calls.find((c: any[]) => c[0].includes('DELETE FROM "notification_logs"'));
        expect(now.getTime() - logDelete[1][0].getTime()).toBe(LOG_RETENTION_DAYS * day);
    });

    it('deletes in batches until a batch comes back short', async () => {
        let calls = 0;
        dataSource.query.mockImplementation(async (sql: string) => {
            if (!sql.includes('DELETE FROM "notifications"')) return [[], 0];
            calls++;
            return [[], calls === 1 ? 5_000 : 10];
        });
        const result = await service.prune(now);
        expect(result.notifications).toBe(5_010);
    });

    it('runs once per night across replicas', async () => {
        dataSource.query.mockResolvedValueOnce([]);
        await service.runNightly(now);
        expect(push.cleanupInactiveSubscriptions).not.toHaveBeenCalled();
    });
});
