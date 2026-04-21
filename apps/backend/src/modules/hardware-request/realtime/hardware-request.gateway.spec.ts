import { Test } from '@nestjs/testing';
import { HardwareRequestGateway } from './hardware-request.gateway';
import { WsAuthGuard } from './ws-auth.guard';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HardwareRequest } from '../domain/entities/hardware-request.entity';

describe('HardwareRequestGateway', () => {
    let gw: HardwareRequestGateway;
    const mockServer = {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
    };

    beforeEach(async () => {
        const mod = await Test.createTestingModule({
            providers: [
                HardwareRequestGateway,
                { provide: WsAuthGuard, useValue: { verifyAndAttach: jest.fn() } },
                { provide: getRepositoryToken(HardwareRequest), useValue: {} },
            ],
        }).compile();
        gw = mod.get(HardwareRequestGateway);
        (gw as any).server = mockServer;
        jest.clearAllMocks();
    });

    it('emits status_changed to request room on submitted', () => {
        gw.onSubmitted({ requestId: 'r1', actorId: 'u1', occurredAt: new Date() } as any);
        expect(mockServer.to).toHaveBeenCalledWith('hw_request_r1');
        expect(mockServer.emit).toHaveBeenCalledWith('status_changed', expect.objectContaining({ requestId: 'r1' }));
    });

    it('emits new_comment to request room on commented', () => {
        gw.onCommented({ requestId: 'r1', actorId: 'u1', commentId: 'c1', body: 'hi', subscribers: [], occurredAt: new Date() } as any);
        expect(mockServer.to).toHaveBeenCalledWith('hw_request_r1');
        expect(mockServer.emit).toHaveBeenCalledWith('new_comment', expect.any(Object));
    });

    it('handleSubscribe joins socket to room', async () => {
        const socket = { join: jest.fn(), id: 'sock1', data: { user: { id: 'u1', roles: ['USER'] } } } as any;
        jest.spyOn(require('./ws-room-authz'), 'wsRoomAuthz').mockResolvedValue(true);
        await gw.handleSubscribe(socket, { requestId: 'r1' });
        expect(socket.join).toHaveBeenCalledWith('hw_request_r1');
    });
});
