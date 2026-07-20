import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { AuditService } from '../../audit/audit.service';
import { HrisGatewayAdapter } from '../../hris-gateway/hris-gateway.adapter';
import { HrisSyncService } from '../../hris-gateway/hris-sync.service';
import { UsersService } from '../../users/users.service';

jest.mock('bcrypt');

describe('AuthService HRIS NIK login', () => {
    let service: AuthService;
    let users: { findByEmail: jest.Mock; findByEmployeeId: jest.Mock };
    let gateway: { verifyPassword: jest.Mock; getEmployee: jest.Mock };
    let sync: { provisionEmployee: jest.Mock };

    const user = {
        id: 'user-1',
        employeeId: '00000024',
        email: 'user@example.com',
        fullName: 'Test User',
        role: 'USER',
        password: 'local-hash',
        isActive: true,
    };

    beforeEach(async () => {
        users = { findByEmail: jest.fn(), findByEmployeeId: jest.fn() };
        gateway = { verifyPassword: jest.fn(), getEmployee: jest.fn() };
        sync = { provisionEmployee: jest.fn() };

        const module = await Test.createTestingModule({
            providers: [
                AuthService,
                { provide: UsersService, useValue: users },
                { provide: JwtService, useValue: {} },
                { provide: AuditService, useValue: { logAsync: jest.fn() } },
                { provide: HrisGatewayAdapter, useValue: gateway },
                { provide: HrisSyncService, useValue: sync },
            ],
        }).compile();
        service = module.get(AuthService);
    });

    afterEach(() => jest.clearAllMocks());

    it('keeps email login on existing path', async () => {
        users.findByEmail.mockResolvedValue(undefined);

        await expect(service.validateUserWithDetails('user@example.com', 'password')).resolves.toMatchObject({
            success: false,
            errorCode: 'USER_NOT_FOUND',
        });
        expect(gateway.verifyPassword).not.toHaveBeenCalled();
    });

    it('accepts Gateway-matched NIK user', async () => {
        gateway.verifyPassword.mockResolvedValue({ valid: true, eligible: true, match: true });
        users.findByEmployeeId.mockResolvedValue(user);

        await expect(service.validateUserWithDetails('00000024', 'hris-password')).resolves.toMatchObject({
            success: true,
            user: expect.not.objectContaining({ password: expect.anything() }),
        });
    });

    it.each([
        [{ valid: false, eligible: false, match: false }, 'USER_NOT_FOUND'],
        [{ valid: true, eligible: false, match: false }, 'ACCOUNT_DISABLED'],
    ])('returns %s for rejected HRIS identity', async (result, errorCode) => {
        gateway.verifyPassword.mockResolvedValue(result);

        await expect(service.validateUserWithDetails('00000024', 'x')).resolves.toMatchObject({
            success: false,
            errorCode,
        });
    });

    it('uses local password only as fallback after a valid HRIS identity rejects password', async () => {
        gateway.verifyPassword.mockResolvedValue({ valid: true, eligible: true, match: false });
        users.findByEmployeeId.mockResolvedValue(user);
        (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true).mockResolvedValueOnce(false);

        await expect(service.validateUserWithDetails('00000024', '123456')).resolves.toMatchObject({ success: true });
        await expect(service.validateUserWithDetails('00000024', 'wrong')).resolves.toMatchObject({
            success: false,
            errorCode: 'WRONG_PASSWORD',
        });
    });

    it('uses local password when Gateway is unreachable', async () => {
        gateway.verifyPassword.mockResolvedValue(null);
        users.findByEmployeeId.mockResolvedValue(user);
        (bcrypt.compare as jest.Mock).mockResolvedValue(true);

        await expect(service.validateUserWithDetails('00000024', '123456')).resolves.toMatchObject({ success: true });
    });

    it('provisions a new NIK user only after Gateway match succeeds', async () => {
        gateway.verifyPassword.mockResolvedValue({ valid: true, eligible: true, match: true });
        users.findByEmployeeId.mockResolvedValue(undefined);
        gateway.getEmployee.mockResolvedValue({ nik_hris: '00000024', nama_karyawan: 'New Employee' });
        sync.provisionEmployee.mockResolvedValue(user);

        await expect(service.validateUserWithDetails('00000024', 'hris-password')).resolves.toMatchObject({ success: true });
        expect(sync.provisionEmployee).toHaveBeenCalledWith(expect.objectContaining({ nik_hris: '00000024' }));
    });

    it('does not provision a new user when Gateway is down even with default password', async () => {
        gateway.verifyPassword.mockResolvedValue(null);
        users.findByEmployeeId.mockResolvedValue(undefined);

        await expect(service.validateUserWithDetails('00000024', '123456')).resolves.toMatchObject({
            success: false,
            errorCode: 'USER_NOT_FOUND',
        });
        expect(gateway.getEmployee).not.toHaveBeenCalled();
    });

    it('rejects locally disabled users after successful HRIS verification', async () => {
        gateway.verifyPassword.mockResolvedValue({ valid: true, eligible: true, match: true });
        users.findByEmployeeId.mockResolvedValue({ ...user, isActive: false });

        await expect(service.validateUserWithDetails('00000024', 'hris-password')).resolves.toMatchObject({
            success: false,
            errorCode: 'ACCOUNT_DISABLED',
        });
    });
});
