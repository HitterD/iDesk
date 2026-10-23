import * as webpush from 'web-push';
import { PushSubscriptionController } from './push-subscription.controller';
import { PushChannelService, VAPID_SETTING_KEY } from './channels/push-channel.service';
import { NotificationPushService } from './notification-push.service';
import { NotificationType } from './entities/notification.entity';

jest.mock('web-push', () => ({
    setVapidDetails: jest.fn(),
    generateVAPIDKeys: jest.fn(() => ({ publicKey: 'generated-public', privateKey: 'generated-private' })),
    sendNotification: jest.fn(),
}));

const cipher = { encrypt: (v: string) => `enc(${v})`, decrypt: (v: string) => v.replace(/^enc\((.*)\)$/, '$1') };

function pushService(env: Record<string, string | undefined>, storedRows: Array<Record<string, unknown>> = []) {
    const rows = [...storedRows];
    const settings = {
        findOne: jest.fn(async () => rows[0] ?? null),
        query: jest.fn(async (_sql: string, params: string[]) => {
            if (rows.length === 0) rows.push({ key: params[0], value: JSON.parse(params[1]) });
        }),
    };
    const repo = { manager: { getRepository: () => settings } };
    const config = { get: (key: string) => env[key] };
    const service = new PushChannelService(repo as never, config as never, {} as never, cipher as never);
    return { service, settings };
}

describe('Web Push VAPID keys', () => {
    beforeEach(() => jest.clearAllMocks());

    it('uses the keys from the environment when they are set', async () => {
        const { service, settings } = pushService({ VAPID_PUBLIC_KEY: 'env-public', VAPID_PRIVATE_KEY: 'env-private' });

        await service.onApplicationBootstrap();

        expect(webpush.setVapidDetails).toHaveBeenCalledWith('mailto:admin@idesk.com', 'env-public', 'env-private');
        expect(settings.findOne).not.toHaveBeenCalled();
        expect(service.isAvailable()).toBe(true);
        expect(service.getVapidPublicKey()).toBe('env-public');
    });

    it('generates a pair once and stores the private key encrypted when the environment has none', async () => {
        const { service, settings } = pushService({});

        await service.onApplicationBootstrap();

        const [, params] = settings.query.mock.calls[0];
        expect(params[0]).toBe(VAPID_SETTING_KEY);
        expect(JSON.parse(params[1])).toEqual({ publicKey: 'generated-public', privateKey: 'enc(generated-private)' });
        expect(webpush.setVapidDetails).toHaveBeenCalledWith(expect.any(String), 'generated-public', 'generated-private');
        expect(service.getVapidPublicKey()).toBe('generated-public');
    });

    it('reuses the stored pair on the next boot', async () => {
        const { service, settings } = pushService({}, [{ key: VAPID_SETTING_KEY, value: { publicKey: 'kept-public', privateKey: 'enc(kept-private)' } }]);

        await service.onApplicationBootstrap();

        expect(webpush.generateVAPIDKeys).not.toHaveBeenCalled();
        expect(settings.query).not.toHaveBeenCalled();
        expect(webpush.setVapidDetails).toHaveBeenCalledWith(expect.any(String), 'kept-public', 'kept-private');
    });
});

describe('PushSubscriptionController', () => {
    it('stores the subscription for the signed-in user (the JWT user carries userId, not id)', async () => {
        const push = { subscribe: jest.fn(async () => ({ id: 'sub-1' })) };
        const controller = new PushSubscriptionController(push as never);
        const subscription = { endpoint: 'https://push.example/1', keys: { p256dh: 'p', auth: 'a' } };

        await controller.subscribe({ user: { userId: 'user-1' }, headers: { 'user-agent': 'Chrome' } }, { subscription } as never);

        expect(push.subscribe).toHaveBeenCalledWith('user-1', subscription, 'Chrome', undefined);
    });
});

describe('NotificationPushService', () => {
    const flush = () => new Promise((resolve) => setImmediate(resolve));
    const base = { id: 'n-1', userId: 'u-1', title: 'Tiket baru', message: 'Printer macet', link: '/tickets/t-1', ticketId: 't-1', requiresAcknowledge: false };

    function setup(viewing = false) {
        const push = { isAvailable: () => true, send: jest.fn(async () => ({ success: true })) };
        const gateway = { isViewingTicket: jest.fn(async () => viewing) };
        return { push, gateway, service: new NotificationPushService(push as never, gateway as never) };
    }

    it('pushes a stored notification with its id, so a click can mark it read', async () => {
        const { push, service } = setup();

        service.dispatch({ ...base, type: NotificationType.TICKET_ASSIGNED });
        await flush();

        expect(push.send).toHaveBeenCalledWith(expect.objectContaining({
            notificationId: 'n-1', recipient: 'u-1', title: 'Tiket baru',
            data: expect.objectContaining({ notificationId: 'n-1', link: '/tickets/t-1' }),
        }));
    });

    it('leaves chat replies to the chat push listener', async () => {
        const { push, service } = setup();

        service.dispatch({ ...base, type: NotificationType.TICKET_REPLY });
        await flush();

        expect(push.send).not.toHaveBeenCalled();
    });

    it('skips users who have the ticket open right now', async () => {
        const { push, service } = setup(true);

        service.dispatch({ ...base, type: NotificationType.TICKET_UPDATED });
        await flush();

        expect(push.send).not.toHaveBeenCalled();
    });
});
