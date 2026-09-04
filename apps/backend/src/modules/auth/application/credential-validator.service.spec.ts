import { AuditService } from '../../audit/audit.service';
import { HrisGatewayAdapter, HrisUnavailableError } from '../../hris-gateway/hris-gateway.adapter';
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

    it('authenticates NIK against HRIS when the HRIS password matches', async () => {
        gateway.verifyPassword.mockResolvedValue({ valid: true, eligible: true, match: true });
        users.findByEmployeeId.mockResolvedValue({
            id: 'u1', email: 'nik@example.com', fullName: 'Karyawan', role: 'USER', isActive: true,
            mustChangePassword: false, password: 'hrisHash',
        });

        await expect(service.validate('00000024', 'hris-pass')).resolves.toMatchObject({
            success: true,
            user: expect.objectContaining({ id: 'u1' }),
        });
        // HRIS already authenticated — no need to check the local password.
        expect(verifyPassword).not.toHaveBeenCalled();
    });

    it('falls back to the local password when HRIS rejects the NIK password (admin reset)', async () => {
        gateway.verifyPassword.mockResolvedValue({ valid: true, eligible: true, match: false });
        users.findByEmployeeId.mockResolvedValue({
            id: 'u1', email: 'nik@example.com', fullName: 'Karyawan', role: 'USER', isActive: true,
            mustChangePassword: true, password: 'localResetHash',
        });
        (verifyPassword as jest.Mock).mockResolvedValue(true);

        await expect(service.validate('00000024', 'ResetedByAdmin1')).resolves.toMatchObject({
            success: true,
            user: expect.objectContaining({ id: 'u1' }),
        });
        expect(verifyPassword).toHaveBeenCalledWith('ResetedByAdmin1', 'localResetHash');
    });

    it('fails closed when HRIS rejects and the local password is also wrong', async () => {
        gateway.verifyPassword.mockResolvedValue({ valid: true, eligible: true, match: false });
        users.findByEmployeeId.mockResolvedValue({ id: 'u1', password: 'localHash', isActive: true });
        (verifyPassword as jest.Mock).mockResolvedValue(false);

        await expect(service.validate('00000024', 'wrong')).resolves.toMatchObject({
            success: false, errorCode: 'WRONG_PASSWORD',
        });
    });

    it('falls back to the local password when HRIS is unavailable', async () => {
        gateway.verifyPassword.mockRejectedValue(new HrisUnavailableError());
        users.findByEmployeeId.mockResolvedValue({
            id: 'u1', email: 'nik@example.com', fullName: 'Karyawan', role: 'USER', isActive: true,
            mustChangePassword: true, password: 'localResetHash',
        });
        (verifyPassword as jest.Mock).mockResolvedValue(true);

        await expect(service.validate('00000024', 'ResetedByAdmin1')).resolves.toMatchObject({
            success: true,
            user: expect.objectContaining({ id: 'u1' }),
        });
    });

    it('denies login for an employee HRIS marks ineligible, even with a matching local password', async () => {
        gateway.verifyPassword.mockResolvedValue({ valid: true, eligible: false, match: false });
        users.findByEmployeeId.mockResolvedValue({ id: 'u1', password: 'localHash', isActive: true });
        (verifyPassword as jest.Mock).mockResolvedValue(true);

        await expect(service.validate('00000024', 'anything')).resolves.toMatchObject({
            success: false, errorCode: 'ACCOUNT_DISABLED',
        });
        // Eligibility is HRIS's authority — the local password must not bypass it.
        expect(verifyPassword).not.toHaveBeenCalled();
    });

    describe('when HRIS login verification is disabled', () => {
        const originalFlag = process.env.HRIS_LOGIN_VERIFY_ENABLED;

        beforeEach(() => { process.env.HRIS_LOGIN_VERIFY_ENABLED = 'false'; });
        afterEach(() => {
            if (originalFlag === undefined) delete process.env.HRIS_LOGIN_VERIFY_ENABLED;
            else process.env.HRIS_LOGIN_VERIFY_ENABLED = originalFlag;
        });

        it('authenticates a NIK against the local password without calling HRIS', async () => {
            users.findByEmployeeId.mockResolvedValue({
                id: 'u1', email: 'nik@example.com', fullName: 'Karyawan', role: 'USER', isActive: true,
                mustChangePassword: false, password: 'localHash',
            });
            (verifyPassword as jest.Mock).mockResolvedValue(true);

            await expect(service.validate('00000024', 'LocalPassword1')).resolves.toMatchObject({
                success: true,
                user: expect.objectContaining({ id: 'u1' }),
            });
            expect(gateway.verifyPassword).not.toHaveBeenCalled();
            expect(verifyPassword).toHaveBeenCalledWith('LocalPassword1', 'localHash');
        });

        it('still rejects a wrong local password', async () => {
            users.findByEmployeeId.mockResolvedValue({ id: 'u1', password: 'localHash', isActive: true });
            (verifyPassword as jest.Mock).mockResolvedValue(false);

            await expect(service.validate('00000024', 'wrong')).resolves.toMatchObject({
                success: false, errorCode: 'WRONG_PASSWORD',
            });
            expect(gateway.verifyPassword).not.toHaveBeenCalled();
        });
    });

    it('rejects an unknown NIK with no local account', async () => {
        gateway.verifyPassword.mockResolvedValue({ valid: false, eligible: false, match: false });
        users.findByEmployeeId.mockResolvedValue(undefined);
        (verifyPassword as jest.Mock).mockResolvedValue(false);

        await expect(service.validate('99999999', 'whatever')).resolves.toMatchObject({
            success: false, errorCode: 'USER_NOT_FOUND',
        });
    });
});
