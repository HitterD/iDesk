import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { AuditService } from '../../audit/audit.service';
import { HrisGatewayAdapter, HrisInvalidResponseError, HrisUnavailableError } from '../../hris-gateway/hris-gateway.adapter';
import { RefreshSessionStore } from '../infrastructure/refresh-session.store';
import { HrisSyncService } from '../../hris-gateway/hris-sync.service';
import { UsersService } from '../../users/users.service';

jest.mock('bcrypt');

describe('AuthService HRIS NIK login', () => {
    let service: AuthService;
    let users: { findByEmail: jest.Mock; findByEmployeeId: jest.Mock };
    let gateway: { verifyPassword: jest.Mock; getEmployee: jest.Mock };
    let sync: { provisionEmployee: jest.Mock };
    let audit: { logAsync: jest.Mock };

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
        audit = { logAsync: jest.fn() };

        const module = await Test.createTestingModule({
            providers: [
                AuthService,
                { provide: UsersService, useValue: users },
                { provide: JwtService, useValue: {} },
                { provide: AuditService, useValue: audit },
                { provide: HrisGatewayAdapter, useValue: gateway },
                { provide: HrisSyncService, useValue: sync },
                { provide: RefreshSessionStore, useValue: { create: jest.fn(), consume: jest.fn(), invalidateFamily: jest.fn(), invalidateUserSessions: jest.fn() } },
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

    it('never falls back to the local password hash when HRIS rejects the password', async () => {
        gateway.verifyPassword.mockResolvedValue({ valid: true, eligible: true, match: false });
        users.findByEmployeeId.mockResolvedValue(user);
        (bcrypt.compare as jest.Mock).mockResolvedValue(true);

        await expect(service.validateUserWithDetails('00000024', '123456')).resolves.toMatchObject({
            success: false,
            errorCode: 'WRONG_PASSWORD',
        });
        expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it.each([
        [new HrisUnavailableError(), 'unreachable Gateway'],
        [new HrisInvalidResponseError(), 'malformed Gateway response'],
    ])('fails closed on %s instead of using the local password', async (error) => {
        gateway.verifyPassword.mockRejectedValue(error);
        users.findByEmployeeId.mockResolvedValue(user);
        (bcrypt.compare as jest.Mock).mockResolvedValue(true);

        await expect(service.validateUserWithDetails('00000024', '123456')).resolves.toMatchObject({
            success: false,
            errorCode: 'USER_NOT_FOUND',
        });
        expect(bcrypt.compare).not.toHaveBeenCalled();
        expect(users.findByEmployeeId).not.toHaveBeenCalled();
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
        gateway.verifyPassword.mockRejectedValue(new HrisUnavailableError());
        users.findByEmployeeId.mockResolvedValue(undefined);

        await expect(service.validateUserWithDetails('00000024', '123456')).resolves.toMatchObject({
            success: false,
            errorCode: 'USER_NOT_FOUND',
        });
        expect(gateway.getEmployee).not.toHaveBeenCalled();
        expect(sync.provisionEmployee).not.toHaveBeenCalled();
    });

    it('rejects locally disabled users after successful HRIS verification', async () => {
        gateway.verifyPassword.mockResolvedValue({ valid: true, eligible: true, match: true });
        users.findByEmployeeId.mockResolvedValue({ ...user, isActive: false });

        await expect(service.validateUserWithDetails('00000024', 'hris-password')).resolves.toMatchObject({
            success: false,
            errorCode: 'ACCOUNT_DISABLED',
        });
    });

    it('masks the NIK in failed-login audit entries', async () => {
        gateway.verifyPassword.mockResolvedValue({ valid: false, eligible: false, match: false });

        await service.validateUserWithDetails('00000024', 'x');

        expect(audit.logAsync).toHaveBeenCalledWith(expect.objectContaining({
            newValue: { nik: '00***24', reason: 'USER_NOT_FOUND' },
        }));
    });
});
