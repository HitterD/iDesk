import { EventsGateway, TICKET_CROSS_SITE_ROOM, buildCorsOrigin, ticketStaffRoom } from './events.gateway';
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

    // handleJoinTicket menolak id non-UUID sebelum menyentuh DB (tickets.id adalah
    // PrimaryGeneratedColumn('uuid')), jadi fixture wajib UUID asli — bukan 'ticket-1'.
    const TICKET_UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

    it('allows owner ticket room and rejects another user', async () => {
        const client = socket();
        client.data = { userId: 'user-1', role: UserRole.USER, siteId: 'site-1' };
        tickets.findById.mockResolvedValue({ id: TICKET_UUID, userId: 'user-1', category: 'GENERAL', ticketType: 'SERVICE', siteId: 'site-1' });
        await expect(gateway.handleJoinTicket(client, TICKET_UUID)).resolves.toMatchObject({ status: 'ok' });
        client.data.userId = 'user-2';
        await expect(gateway.handleJoinTicket(client, TICKET_UUID)).resolves.toMatchObject({ status: 'error', message: 'Forbidden' });
    });

    it('rejects a non-UUID ticket id before querying the database', async () => {
        const client = socket();
        client.data = { userId: 'user-1', role: UserRole.USER, siteId: 'site-1' };
        await expect(gateway.handleJoinTicket(client, 'ticket-1')).resolves.toEqual({ status: 'error', message: 'Invalid ticket ID format' });
        expect(tickets.findById).not.toHaveBeenCalled();
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

    it('joins the cross-site ticket room only for cross-site roles', () => {
        const manager = connectAs('socket-m', 'manager-1', UserRole.MANAGER);
        const agent = connectAs('socket-a', 'agent-1', UserRole.AGENT);

        expect(manager.join).toHaveBeenCalledWith(TICKET_CROSS_SITE_ROOM);
        expect(agent.join).not.toHaveBeenCalledWith(TICKET_CROSS_SITE_ROOM);
    });

    it('joins the staff room only for non-requester roles', async () => {
        const TICKET_UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
        const owner = socket('socket-owner');
        owner.data = { userId: 'user-1', role: UserRole.USER, siteId: 'site-1' };
        const agent = socket('socket-agent');
        agent.data = { userId: 'agent-1', role: UserRole.AGENT, siteId: 'site-1' };
        tickets.findById.mockResolvedValue({ id: TICKET_UUID, userId: 'user-1', category: 'GENERAL', ticketType: 'SERVICE', siteId: 'site-1' });

        await gateway.handleJoinTicket(owner, TICKET_UUID);
        await gateway.handleJoinTicket(agent, TICKET_UUID);

        expect(owner.join).not.toHaveBeenCalledWith(ticketStaffRoom(TICKET_UUID));
        expect(agent.join).toHaveBeenCalledWith(ticketStaffRoom(TICKET_UUID));
    });

    it('pushes internal notes to the staff room only', () => {
        gateway.notifyNewMessage('t-1', { id: 'm-1', isInternal: true });
        gateway.notifyNewMessage('t-1', { id: 'm-2', isInternal: false });

        expect(gateway.server.to).toHaveBeenNthCalledWith(1, ticketStaffRoom('t-1'));
        expect(gateway.server.to).toHaveBeenNthCalledWith(2, 'ticket:t-1');
    });

    it('sends requesters only public pins and staff all pins', () => {
        const emits: Array<{ room: string; payload: any }> = [];
        gateway.server.to = jest.fn((room: string) => ({ emit: (_e: string, payload: any) => emits.push({ room, payload }) })) as any;
        const pub = { id: 'm-1', isInternal: false };
        const internal = { id: 'm-2', isInternal: true };

        gateway.notifyPinsChanged('t-1', [pub, internal] as any);

        expect(emits).toEqual([
            { room: 'ticket:t-1', payload: { ticketId: 't-1', pins: [pub] } },
            { room: ticketStaffRoom('t-1'), payload: { ticketId: 't-1', pins: [pub, internal] } },
        ]);
    });

    it('sends message edits and deletes to the staff room for internal notes and the ticket room otherwise', () => {
        gateway.notifyMessageUpdated('t-1', { id: 'm-1', isInternal: true });
        gateway.notifyMessageUpdated('t-1', { id: 'm-2', isInternal: false });

        expect(gateway.server.to).toHaveBeenNthCalledWith(1, ticketStaffRoom('t-1'));
        expect(gateway.server.to).toHaveBeenNthCalledWith(2, 'ticket:t-1');
    });

    it('reports whether any of the user\'s tabs has the ticket open', async () => {
        const inRoom = jest.fn().mockReturnValue({
            fetchSockets: jest.fn().mockResolvedValue([
                { rooms: new Set(['user:user-1']) },
                { rooms: new Set(['user:user-1', 'ticket:t-1']) },
            ]),
        });
        gateway.server = { in: inRoom } as any;

        await expect(gateway.isViewingTicket('user-1', 't-1')).resolves.toBe(true);
        await expect(gateway.isViewingTicket('user-1', 't-2')).resolves.toBe(false);
        expect(inRoom).toHaveBeenCalledWith('user:user-1');
    });

    it('emits ticket events to the site and cross-site rooms, never globally', () => {
        gateway.emitToTicketAudience('site-1', 'tickets:listUpdated', { ticketId: 't-1' });
        gateway.emitToTicketAudience(null, 'tickets:listUpdated', { ticketId: 't-2' });

        expect(gateway.server.to).toHaveBeenCalledWith(['site:site-1', TICKET_CROSS_SITE_ROOM]);
        expect(gateway.server.to).toHaveBeenCalledWith([TICKET_CROSS_SITE_ROOM]);
        expect(gateway.server.emit).not.toHaveBeenCalled();
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

    it('never rejects connections from a shared office IP', () => {
        const clients = Array.from({ length: 40 }, (_, i) => connectBehindProxy(gateway, i));
        expect(clients.filter((c) => c.disconnect.mock.calls.length > 0)).toEqual([]);
    });
});
