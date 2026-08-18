import { AuditService } from '../../audit/audit.service';
import { HrisGatewayAdapter } from '../../hris-gateway/hris-gateway.adapter';
import { HrisSyncService } from '../../hris-gateway/hris-sync.service';
import { UsersService } from '../../users/users.service';
import { HrisProvisioningService } from './hris-provisioning.service';
import { CredentialValidatorService } from './credential-validator.service';

jest.mock('./password-verifier', () => ({
    DUMMY_PASSWORD_HASH: 'dummy',
    verifyPassword: jest.fn(),
}));

import { verifyPassword } from './password-verifier';

describe('CredentialValidatorService', () => {
    const users = { findByEmail: jest.fn(), findByEmployeeId: jest.fn() } as any;
    const audit = { logAsync: jest.fn() } as any;
    const gateway = { verifyPassword: jest.fn() } as any;
    const sync = {} as HrisSyncService;
    const provisioning = { provision: jest.fn() } as any;
    const authEvents = { emit: jest.fn() } as any;
    const service = new CredentialValidatorService(users, audit, gateway, sync, provisioning, authEvents);

    beforeEach(() => jest.clearAllMocks());

    it('normalizes email identifiers and returns safe user data', async () => {
        users.findByEmail.mockResolvedValue({
            id: 'u1', email: 'user@example.com', fullName: 'User', role: 'USER', isActive: true,
            mustChangePassword: false, password: 'hash',
        });
        (verifyPassword as jest.Mock).mockResolvedValue(true);

        await expect(service.validate(' User@Example.com ', 'secret')).resolves.toMatchObject({
            success: true,
            user: expect.not.objectContaining({ password: expect.anything() }),
        });
        expect(users.findByEmail).toHaveBeenCalledWith('user@example.com');
    });

    it('fails closed when HRIS rejects NIK credentials', async () => {
        gateway.verifyPassword.mockResolvedValue({ valid: true, eligible: true, match: false });
        users.findByEmployeeId.mockResolvedValue({ id: 'u1' });

        await expect(service.validate('00000024', 'wrong')).resolves.toMatchObject({
            success: false, errorCode: 'WRONG_PASSWORD',
        });
        expect(verifyPassword).not.toHaveBeenCalled();
    });
});
