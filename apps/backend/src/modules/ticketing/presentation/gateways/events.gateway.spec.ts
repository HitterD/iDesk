import { EventsGateway, buildCorsOrigin } from './events.gateway';
import { UserRole } from '../../../users/enums/user-role.enum';

describe('EventsGateway security boundary', () => {
    const jwt = { verify: jest.fn() } as any;
    const config = { get: jest.fn().mockReturnValue('secret') } as any;
    const tickets = { findById: jest.fn() } as any;
    let gateway: EventsGateway;

    const socket = () => ({
        id: 'socket-1',
        handshake: { address: '127.0.0.1', auth: {}, headers: {}, query: {} },
        data: {},
        join: jest.fn(),
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
});
