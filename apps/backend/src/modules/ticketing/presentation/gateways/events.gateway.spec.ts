import { EventsGateway, buildCorsOrigin } from './events.gateway';
import { UserRole } from '../../../users/enums/user-role.enum';

describe('EventsGateway security boundary', () => {
    const jwt = { verify: jest.fn() } as any;
    const config = { get: jest.fn().mockReturnValue('secret') } as any;
    const tickets = { findById: jest.fn() } as any;
    let gateway: EventsGateway;

    const socket = (id = 'socket-1') => ({
        id,
        handshake: { address: `10.0.0.${id.length}`, auth: {}, headers: {}, query: {} },
        data: {},
        rooms: new Set([id]),
        join: jest.fn(function (this: any, room: string) { this.rooms.add(room); }),
        leave: jest.fn(),
        emit: jest.fn(),
        disconnect: jest.fn(),
        to: jest.fn().mockReturnValue({ emit: jest.fn() }),
    }) as any;

    beforeEach(() => {
        jest.clearAllMocks();
        gateway = new EventsGateway(jwt, config, tickets);
        gateway.server = { emit: jest.fn(), to: jest.fn().mockReturnValue({ emit: jest.fn() }) } as any;
    });

    it('rejects invalid production WebSocket origins', () => {
        const previous = process.env.NODE_ENV;
        const previousOrigin = process.env.WS_CORS_ORIGIN;
        process.env.NODE_ENV = 'production';
        process.env.WS_CORS_ORIGIN = 'https://app.example.com';
        const callback = jest.fn();
        buildCorsOrigin()('https://evil.example.com', callback);
        expect(callback).toHaveBeenCalledWith(expect.any(Error), false);
        process.env.NODE_ENV = previous;
        process.env.WS_CORS_ORIGIN = previousOrigin;
    });

    it('disconnects clients without a valid token', () => {
        const client = socket();
        gateway.handleConnection(client);
        expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('rejects forged identify identity', () => {
        const client = socket();
        client.data.userId = 'user-1';
        expect(gateway.handleIdentify(client, 'user-2')).toEqual({ status: 'error', message: 'Unauthorized' });
    });

    it('allows owner ticket room and rejects another user', async () => {
        const client = socket();
        client.data = { userId: 'user-1', role: UserRole.USER };
        tickets.findById.mockResolvedValue({ id: 'ticket-1', userId: 'user-1', category: 'GENERAL', ticketType: 'SERVICE' });
        await expect(gateway.handleJoinTicket(client, 'ticket-1')).resolves.toMatchObject({ status: 'ok' });
        client.data.userId = 'user-2';
        await expect(gateway.handleJoinTicket(client, 'ticket-1')).resolves.toMatchObject({ status: 'error', message: 'Forbidden' });
    });

    it('rejects non-admin admin-room join', () => {
        const client = socket();
        client.data.role = UserRole.USER;
        expect(gateway.handleJoinAdmin(client)).toEqual({ status: 'error', message: 'Forbidden' });
    });

    it('allows typing only from an authenticated ticket-room member', () => {
        const client = socket();
        client.data = { userId: 'user-1', fullName: 'Verified User' };
        client.rooms.add('ticket:ticket-1');
        expect(gateway.handleTypingStart(client, { ticketId: 'ticket-1', user: { fullName: 'Forged User' } })).toEqual({ status: 'ok' });
        expect(client.to).toHaveBeenCalledWith('ticket:ticket-1');
        const room = client.to.mock.results[0].value;
        expect(room.emit).toHaveBeenCalledWith('typing:start', expect.objectContaining({
            ticketId: 'ticket-1',
            user: { fullName: 'Verified User' },
        }));
    });

    it('rejects typing for rooms the socket did not join', () => {
        const client = socket();
        client.data.userId = 'user-1';
        expect(gateway.handleTypingStart(client, { ticketId: 'ticket-2' })).toEqual({ status: 'error', message: 'Forbidden' });
        expect(gateway.handleTypingStop(client, { ticketId: 'ticket-2' })).toEqual({ status: 'error', message: 'Forbidden' });
        expect(client.to).not.toHaveBeenCalled();
    });

    it('rejects invalid or cross-ticket typing payloads', () => {
        const client = socket();
        client.data.userId = 'user-1';
        client.rooms.add('ticket:ticket-1');
        expect(gateway.handleTypingStart(client, { ticketId: 'ticket-2' })).toEqual({ status: 'error', message: 'Forbidden' });
        expect(gateway.handleTypingStart(client, { ticketId: ' ' })).toEqual({ status: 'error', message: 'Forbidden' });
        expect(gateway.handleTypingStop(client, { ticketId: 42 })).toEqual({ status: 'error', message: 'Forbidden' });
        expect(client.to).not.toHaveBeenCalled();
    });
});

describe('EventsGateway presence', () => {
    const jwt = { verify: jest.fn() } as any;
    const config = { get: jest.fn().mockReturnValue('secret') } as any;
    const tickets = { findById: jest.fn() } as any;
    let gateway: EventsGateway;

    const socket = (id: string, handshake: Record<string, any> = {}) => ({
        id,
        handshake: { address: '127.0.0.1', auth: {}, headers: {}, query: {}, ...handshake },
        data: {},
        rooms: new Set([id]),
        join: jest.fn(),
        leave: jest.fn(),
        emit: jest.fn(),
        disconnect: jest.fn(),
        to: jest.fn().mockReturnValue({ emit: jest.fn() }),
    }) as any;

    const connectAs = (id: string, userId: string, role: UserRole = UserRole.AGENT) => {
        jwt.verify.mockReturnValueOnce({ sub: userId, role, fullName: `Name ${userId}` });
        const client = socket(id, { auth: { token: 'jwt' } });
        gateway.handleConnection(client);
        return client;
    };

    beforeEach(() => {
        jest.clearAllMocks();
        gateway = new EventsGateway(jwt, config, tickets);
        gateway.server = { emit: jest.fn(), to: jest.fn().mockReturnValue({ emit: jest.fn() }) } as any;
    });

    it('authenticates the socket from the access_token cookie', () => {
        jwt.verify.mockReturnValue({ sub: 'user-1', role: UserRole.USER, fullName: 'Cookie User' });
        const client = socket('socket-cookie', {
            headers: { cookie: 'other=1; access_token=cookie-jwt; csrf-token=abc' },
        });

        gateway.handleConnection(client);

        expect(jwt.verify).toHaveBeenCalledWith('cookie-jwt', { secret: 'secret' });
        expect(client.disconnect).not.toHaveBeenCalled();
        expect(client.data.userId).toBe('user-1');
    });

    it('returns the roster to an identified client', () => {
        const client = connectAs('socket-1', 'user-1');
        connectAs('socket-2', 'user-2');

        expect(gateway.handleIdentify(client, 'user-1')).toEqual({ status: 'ok', userId: 'user-1' });
        expect(client.emit).toHaveBeenCalledWith('users:online', expect.arrayContaining(['user-1', 'user-2']));
    });

    it('emits user:online once per user regardless of tab count', () => {
        connectAs('socket-1', 'user-1');
        connectAs('socket-2', 'user-1');

        const onlineEvents = (gateway.server.emit as jest.Mock).mock.calls.filter(([event]) => event === 'user:online');
        expect(onlineEvents).toEqual([['user:online', { userId: 'user-1' }]]);
    });

    it('keeps a user online until the last connection drops', () => {
        const first = connectAs('socket-1', 'user-1');
        const second = connectAs('socket-2', 'user-1');

        gateway.handleDisconnect(first);
        expect(gateway.server.emit).not.toHaveBeenCalledWith('user:offline', { userId: 'user-1' });

        gateway.handleDisconnect(second);
        expect(gateway.server.emit).toHaveBeenCalledWith('user:offline', { userId: 'user-1' });
    });

    it('rate limits identify floods without killing the connection', () => {
        const client = connectAs('socket-1', 'user-1');
        (client.emit as jest.Mock).mockClear();

        const results = Array.from({ length: 200 }, () => gateway.handleIdentify(client, 'user-1'));

        expect(results[0]).toEqual({ status: 'ok', userId: 'user-1' });
        expect(results.some((r) => r?.status === 'error' && r.message === 'Rate limited')).toBe(true);
        expect(client.disconnect).not.toHaveBeenCalled();
    });

    const connectBehindProxy = (gw: EventsGateway, i: number) => {
        jwt.verify.mockReturnValueOnce({ sub: `user-${i}`, role: UserRole.USER, fullName: 'U' });
        const client = socket(`socket-${i}`, {
            address: '10.0.0.1',
            headers: { 'x-forwarded-for': `203.0.113.${i}, 10.0.0.1` },
            auth: { token: 'jwt' },
        });
        gw.handleConnection(client);
        return client;
    };

    it('gives each proxied client its own connection bucket when the proxy is trusted', () => {
        const previous = process.env.TRUST_PROXY;
        process.env.TRUST_PROXY = 'true';
        try {
            const clients = Array.from({ length: 40 }, (_, i) => connectBehindProxy(gateway, i));
            expect(clients.filter((c) => c.disconnect.mock.calls.length > 0)).toEqual([]);
        } finally {
            process.env.TRUST_PROXY = previous;
        }
    });

    it('ignores client-supplied forwarding headers when the proxy is not trusted', () => {
        const previous = process.env.TRUST_PROXY;
        delete process.env.TRUST_PROXY;
        try {
            const clients = Array.from({ length: 40 }, (_, i) => connectBehindProxy(gateway, i));
            expect(clients.some((c) => c.disconnect.mock.calls.length > 0)).toBe(true);
        } finally {
            process.env.TRUST_PROXY = previous;
        }
    });
});
