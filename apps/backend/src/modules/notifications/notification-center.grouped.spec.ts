import { NotificationCenterService } from './notification-center.service';
import { NotificationType } from './entities/notification.entity';
import { DeliveryChannel } from './entities/notification-log.entity';
import { NOTIFICATIONS_READ_EVENT } from './notification-events';

describe('NotificationCenterService grouped TICKET_NOTE anti-spam', () => {
    it('updates the single unread row in-place and suppresses repeat toast/push during 120s cooldown except when bypassed', async () => {
        const rows: any[] = [];
        const cacheStore = new Map<string, unknown>();
        const emit = jest.fn();
        const eventsGateway = { server: { to: jest.fn(() => ({ emit })) } };
        const notificationRepo = {
            findOne: jest.fn(async ({ where }: any) => {
                if (where.id) return rows.find(r => r.id === where.id && r.userId === where.userId) ?? null;
                return rows.find(
                    r => r.userId === where.userId && r.type === where.type && r.referenceId === where.referenceId && r.isRead === false,
                ) ?? null;
            }),
            create: jest.fn((data: any) => ({ id: data.id ?? `gen-${rows.length + 1}`, ...data })),
            save: jest.fn(async (row: any) => {
                const idx = rows.findIndex(r => r.id === row.id);
                if (idx >= 0) rows[idx] = { ...rows[idx], ...row };
                else rows.push(row);
                return rows[idx >= 0 ? idx : rows.length - 1];
            }),
        };
        const preferenceRepo = {
            findOne: jest.fn(async () => ({
                userId: 'u-1',
                inAppEnabled: true,
                emailEnabled: false,
                pushEnabled: true,
                quietHoursEnabled: false,
                digestEnabled: false,
            })),
        };
        const logRepo = {
            save: jest.fn(async (l: any) => ({ id: `log-${Math.random()}`, ...l })),
            update: jest.fn(async () => undefined),
        };
        const inAppChannel = { isAvailable: () => true, send: jest.fn(async () => ({ success: true, timestamp: new Date() })) };
        const pushChannel = { isAvailable: () => false, send: jest.fn() };
        const emailChannel = { isAvailable: () => false, send: jest.fn() };
        const webPush = { dispatch: jest.fn() };
        const cacheService = {
            getAsync: jest.fn(async (k: string) => cacheStore.get(k) ?? null),
            setAsync: jest.fn(async (k: string, v: unknown) => { cacheStore.set(k, v); }),
        };

        const service = new NotificationCenterService(
            {} as any,
            eventsGateway as any,
            notificationRepo as any,
            preferenceRepo as any,
            logRepo as any,
            { findOne: jest.fn() } as any,
            emailChannel as any,
            inAppChannel as any,
            pushChannel as any,
            {} as any,
            cacheService as any,
            webPush as any,
        );
        service.onModuleInit();

        await service.send({
            id: 'deliv-1',
            userId: 'u-1',
            type: NotificationType.TICKET_NOTE,
            title: 'Catatan internal',
            message: 'Ada pembaruan catatan internal untuk Anda.',
            referenceId: 'note-1',
            link: '/tickets/t1?noteId=note-1',
            groupUnread: true,
            viewingTicketId: 't1',
            pushTag: 'ticket-note:note-1',
            channels: [DeliveryChannel.IN_APP],
        });

        await service.send({
            id: 'deliv-2',
            userId: 'u-1',
            type: NotificationType.TICKET_NOTE,
            title: 'Catatan internal',
            message: 'Ada 2 pembaruan catatan internal untuk Anda.',
            referenceId: 'note-1',
            link: '/tickets/t1?noteId=note-1',
            groupUnread: true,
            viewingTicketId: 't1',
            pushTag: 'ticket-note:note-1',
            channels: [DeliveryChannel.IN_APP],
        });

        expect(rows).toHaveLength(1);
        expect(rows[0].message).toBe('Ada 2 pembaruan catatan internal untuk Anda.');
        expect(inAppChannel.send).toHaveBeenCalledTimes(1);
        expect(webPush.dispatch).toHaveBeenCalledTimes(1);
        expect(emit).toHaveBeenCalledWith(NOTIFICATIONS_READ_EVENT, { userId: 'u-1' });

        await service.send({
            id: 'deliv-3',
            userId: 'u-1',
            type: NotificationType.TICKET_NOTE,
            title: 'Catatan internal',
            message: 'Anda disebut dalam catatan internal (3 pembaruan).',
            referenceId: 'note-1',
            link: '/tickets/t1?noteId=note-1',
            groupUnread: true,
            viewingTicketId: 't1',
            pushTag: 'ticket-note:note-1',
            bypassPushCooldown: true,
            channels: [DeliveryChannel.IN_APP],
        });

        expect(rows).toHaveLength(1);
        expect(rows[0].message).toBe('Anda disebut dalam catatan internal (3 pembaruan).');
        expect(inAppChannel.send).toHaveBeenCalledTimes(2);
        expect(webPush.dispatch).toHaveBeenCalledTimes(2);
    });
});
