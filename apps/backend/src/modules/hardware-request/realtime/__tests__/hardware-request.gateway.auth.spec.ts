import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HardwareRequestGateway } from '../hardware-request.gateway';
import { WsAuthGuard } from '../ws-auth.guard';
import { HardwareRequest } from '../../domain/entities/hardware-request.entity';

const makeSocket = (token?: string, query?: string) => ({
    id: 'test-socket',
    handshake: {
        auth: token ? { token } : {},
        query: query ? { token: query } : {},
    },
    data: {} as Record<string, unknown>,
    disconnect: jest.fn(),
    join: jest.fn(),
    emit: jest.fn(),
});

const mockJwt = { verify: jest.fn(), sign: jest.fn() };
const mockRepo = { findOne: jest.fn() };
const mockServer = { to: jest.fn().mockReturnThis(), emit: jest.fn() };

describe('WsAuthGuard', () => {
    let guard: WsAuthGuard;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                WsAuthGuard,
                { provide: JwtService, useValue: mockJwt },
            ],
        }).compile();
        guard = module.get(WsAuthGuard);
        jest.clearAllMocks();
    });

    it('no token → disconnect + return false', () => {
        const socket = makeSocket() as any;
        const result = guard.verifyAndAttach(socket);
        expect(result).toBe(false);
        expect(socket.disconnect).toHaveBeenCalledWith(true);
    });

    it('invalid token → disconnect + return false', () => {
        mockJwt.verify.mockImplementation(() => { throw new Error('invalid'); });
        const socket = makeSocket('bad-token') as any;
        const result = guard.verifyAndAttach(socket);
        expect(result).toBe(false);
        expect(socket.disconnect).toHaveBeenCalledWith(true);
    });

    it('valid token → attach user + return true', () => {
        mockJwt.verify.mockReturnValue({ sub: 'user-1', roles: ['USER'] });
        const socket = makeSocket('good-token') as any;
        const result = guard.verifyAndAttach(socket);
        expect(result).toBe(true);
        expect(socket.data.user).toEqual({ id: 'user-1', roles: ['USER'] });
        expect(socket.disconnect).not.toHaveBeenCalled();
    });

    it('token via query string also works', () => {
        mockJwt.verify.mockReturnValue({ sub: 'user-2', roles: [] });
        const socket = makeSocket(undefined, 'query-token') as any;
        const result = guard.verifyAndAttach(socket);
        expect(result).toBe(true);
    });
});

describe('HardwareRequestGateway — handleSubscribe authz', () => {
    let gw: HardwareRequestGateway;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                HardwareRequestGateway,
                { provide: WsAuthGuard, useValue: { verifyAndAttach: jest.fn().mockReturnValue(true) } },
                { provide: getRepositoryToken(HardwareRequest), useValue: mockRepo },
            ],
        }).compile();
        gw = module.get(HardwareRequestGateway);
        (gw as any).server = mockServer;
        jest.clearAllMocks();
    });

    it('valid token + owner → join room', async () => {
        mockRepo.findOne.mockResolvedValue({ id: 'req-1', requesterId: 'user-1' });
        const socket = { ...makeSocket('tok'), data: { user: { id: 'user-1', roles: [] } } } as any;
        const result = await gw.handleSubscribe(socket, { requestId: 'req-1' });
        expect(socket.join).toHaveBeenCalledWith('hw_request_req-1');
        expect(result).toMatchObject({ status: 'ok' });
    });

    it('valid token + not owner + no ICT role → disconnect + error', async () => {
        mockRepo.findOne.mockResolvedValue({ id: 'req-1', requesterId: 'owner-id' });
        const socket = { ...makeSocket('tok'), data: { user: { id: 'other-user', roles: [] } } } as any;
        const result = await gw.handleSubscribe(socket, { requestId: 'req-1' });
        expect(socket.disconnect).toHaveBeenCalledWith(true);
        expect(result).toMatchObject({ status: 'error' });
    });

    it('no user on socket → disconnect', async () => {
        const socket = { ...makeSocket(), data: {} } as any;
        const result = await gw.handleSubscribe(socket, { requestId: 'req-1' });
        expect(socket.disconnect).toHaveBeenCalledWith(true);
        expect(result).toMatchObject({ status: 'error' });
    });
});
