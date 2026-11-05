import { ForbiddenException } from '@nestjs/common';
import { RequesterDeviceController } from './requester-device.controller';

describe('RequesterDeviceController', () => {
    const devices = { forTicket: jest.fn(async () => ({ requesterIp: '10.10.6.45' })), recordHeartbeat: jest.fn(async () => ({ ok: true })) };
    const ticketQuery = { assertCanView: jest.fn() };
    const controller = new RequesterDeviceController(devices as any, ticketQuery as any);
    const req = (role: string) => ({ user: { userId: 'u-1', role, siteId: 's-1' }, headers: { 'x-forwarded-for': '10.10.6.45' } });

    beforeEach(() => jest.clearAllMocks());

    it('shows the requester device to ticket handlers', async () => {
        ticketQuery.assertCanView.mockResolvedValue('handler');
        await expect(controller.forTicket(req('AGENT_OPERATIONAL_SUPPORT'), 't-1')).resolves.toEqual({ requesterIp: '10.10.6.45' });
        expect(ticketQuery.assertCanView).toHaveBeenCalledWith('t-1', { id: 'u-1', role: 'AGENT_OPERATIONAL_SUPPORT', siteId: 's-1' });
    });

    it('hides it from the requester side (owner, participants)', async () => {
        ticketQuery.assertCanView.mockResolvedValue('requester');
        await expect(controller.forTicket(req('USER'), 't-1')).rejects.toBeInstanceOf(ForbiddenException);
        expect(devices.forTicket).not.toHaveBeenCalled();
    });

    it('records the heartbeat for the signed-in user with the request IP', async () => {
        await controller.heartbeat(req('USER'), { hostname: 'PC012' });
        expect(devices.recordHeartbeat).toHaveBeenCalledWith('u-1', { hostname: 'PC012' }, '10.10.6.45');
    });
});
