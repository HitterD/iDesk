import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { UserRole } from '../../users/enums/user-role.enum';
import { CsiGateway, csiAdminRoom } from './csi.gateway';

describe('CsiGateway', () => {
    const jwt = { verify: jest.fn() };
    const config = { get: jest.fn(() => 'secret') };
    const accessReader = { load: jest.fn() };

    let gateway: CsiGateway;
    const toEmit = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        gateway = new CsiGateway(jwt as any, config as any, accessReader as any);
        gateway.server = { to: jest.fn(() => ({ emit: toEmit })) } as any;
    });

    it('authenticates handshake via access_token cookie and disconnects invalid sockets', () => {
        jwt.verify.mockReturnValueOnce({ sub: 'u-1', type: 'access' });
        const validSocket: any = {
            id: 's-1',
            handshake: { headers: { cookie: 'access_token=jwt-123' }, auth: {} },
            data: {},
            disconnect: jest.fn(),
        };
        gateway.handleConnection(validSocket);
        expect(validSocket.data.userId).toBe('u-1');
        expect(validSocket.disconnect).not.toHaveBeenCalled();

        const noTokenSocket: any = {
            id: 's-2',
            handshake: { headers: {}, auth: {} },
            data: {},
            disconnect: jest.fn(),
        };
        gateway.handleConnection(noTokenSocket);
        expect(noTokenSocket.disconnect).toHaveBeenCalledWith(true);
    });

    it('joins scope admin room only when caller has CSI admin access for that scope', async () => {
        const join = jest.fn();
        const client: any = { id: 's-1', data: { userId: 'u-admin' }, join, leave: jest.fn() };

        accessReader.load.mockResolvedValueOnce({ role: UserRole.USER, pageAccess: {} });
        await expect(gateway.handleSubscribe(client, { scope: 'ict' })).resolves.toEqual({ status: 'error', message: 'Forbidden' });
        expect(join).not.toHaveBeenCalled();

        accessReader.load.mockResolvedValueOnce({ role: UserRole.ADMIN, pageAccess: { csi_admin_ict: true } });
        await expect(gateway.handleSubscribe(client, { scope: 'ict' })).resolves.toEqual({
            status: 'ok',
            room: csiAdminRoom(ServiceScope.ICT),
        });
        expect(join).toHaveBeenCalledWith('csi:admin:ICT');
    });

    it('broadcasts csi.period.updated events to the matching admin scope room', () => {
        gateway.handleCsiUpdated({ scope: ServiceScope.ICT, periodId: 'p-1' });
        expect((gateway.server as any).to).toHaveBeenCalledWith('csi:admin:ICT');
        expect(toEmit).toHaveBeenCalledWith('csi:updated', { scope: ServiceScope.ICT, periodId: 'p-1' });
    });
});
