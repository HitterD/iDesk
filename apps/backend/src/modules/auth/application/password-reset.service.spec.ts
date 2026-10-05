import { BadRequestException, ForbiddenException, HttpStatus, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PasswordResetService, FORGOT_PASSWORD_MESSAGES } from './password-reset.service';
import { UsersService } from '../../users/users.service';
import { SessionService } from './session.service';
import { MailDispatchService } from '../../../shared/mail/mail-dispatch.service';
import { CacheService } from '../../../shared/core/cache/cache.service';
import { UserRole } from '../../users/enums/user-role.enum';
import { User } from '../../users/entities/user.entity';
import { validatePasswordPolicy } from './password-policy';

jest.mock('bcrypt');

describe('PasswordResetService', () => {
    let service: PasswordResetService;
    let usersService: { findByEmail: jest.Mock; findByEmployeeId: jest.Mock; updatePassword: jest.Mock; update: jest.Mock };
    let sessionService: { invalidateUser: jest.Mock };
    let mailDispatch: { sendNow: jest.Mock };
    let cache: { getAsync: jest.Mock; setAsync: jest.Mock; delAsync: jest.Mock };

    const regularUser = {
        id: 'user-1',
        email: 'budi@kapalapi.co.id',
        employeeId: '12345',
        fullName: 'Budi',
        role: UserRole.USER,
        isActive: true,
    } as User;

    beforeEach(() => {
        usersService = {
            findByEmail: jest.fn(),
            findByEmployeeId: jest.fn(),
            updatePassword: jest.fn(),
            update: jest.fn(),
        };
        sessionService = { invalidateUser: jest.fn() };
        mailDispatch = { sendNow: jest.fn().mockResolvedValue({ success: true }) };
        cache = { getAsync: jest.fn().mockResolvedValue(null), setAsync: jest.fn(), delAsync: jest.fn() };
        (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-temp');
        service = new PasswordResetService(
            usersService as unknown as UsersService,
            sessionService as unknown as SessionService,
            mailDispatch as unknown as MailDispatchService,
            cache as unknown as CacheService,
        );
    });

    describe('by NIK', () => {
        it('sends the temporary password to the typed email without changing the account email', async () => {
            usersService.findByEmployeeId.mockResolvedValue(regularUser);

            const result = await service.forgotPassword({ identifier: ' 12345 ', email: 'Budi.Pribadi@Gmail.com' });

            expect(usersService.findByEmployeeId).toHaveBeenCalledWith('12345');
            const mail = mailDispatch.sendNow.mock.calls[0][0];
            expect(mail.to).toBe('budi.pribadi@gmail.com');
            expect(mail.template).toBe('password-reset');
            expect(validatePasswordPolicy(mail.context.password).valid).toBe(true);
            expect(bcrypt.hash).toHaveBeenCalledWith(mail.context.password, expect.any(Number));
            expect(usersService.updatePassword).toHaveBeenCalledWith('user-1', 'hashed-temp');
            expect(usersService.update).toHaveBeenCalledWith('user-1', { mustChangePassword: true });
            expect(usersService.update).not.toHaveBeenCalledWith('user-1', expect.objectContaining({ email: expect.anything() }));
            expect(sessionService.invalidateUser).toHaveBeenCalledWith('user-1');
            expect(result).toEqual({ message: FORGOT_PASSWORD_MESSAGES.SUCCESS, sentTo: 'budi.pribadi@gmail.com' });
        });

        it('requires a destination email', async () => {
            await expect(service.forgotPassword({ identifier: '12345' })).rejects.toThrow(BadRequestException);
            expect(usersService.findByEmployeeId).not.toHaveBeenCalled();
        });

        it('rejects a placeholder destination that cannot receive mail', async () => {
            await expect(service.forgotPassword({ identifier: '12345', email: '12345@hris.local' }))
                .rejects.toThrow(FORGOT_PASSWORD_MESSAGES.PLACEHOLDER_EMAIL);
        });

        it('reports an unknown NIK', async () => {
            usersService.findByEmployeeId.mockResolvedValue(undefined);
            await expect(service.forgotPassword({ identifier: '99999', email: 'x@gmail.com' }))
                .rejects.toThrow(new NotFoundException(FORGOT_PASSWORD_MESSAGES.NIK_NOT_FOUND));
        });
    });

    describe('by registered email', () => {
        it('sends to the stored email and ignores any typed destination', async () => {
            usersService.findByEmail.mockResolvedValue(regularUser);

            await service.forgotPassword({ identifier: 'BUDI@kapalapi.co.id', email: 'attacker@gmail.com' });

            expect(usersService.findByEmail).toHaveBeenCalledWith('budi@kapalapi.co.id');
            expect(mailDispatch.sendNow.mock.calls[0][0].to).toBe('budi@kapalapi.co.id');
        });

        it('reports an unregistered email', async () => {
            usersService.findByEmail.mockResolvedValue(undefined);
            await expect(service.forgotPassword({ identifier: 'nobody@gmail.com' }))
                .rejects.toThrow(new NotFoundException(FORGOT_PASSWORD_MESSAGES.EMAIL_NOT_FOUND));
        });

        it('rejects a placeholder account email', async () => {
            await expect(service.forgotPassword({ identifier: '12345@hris.local' }))
                .rejects.toThrow(FORGOT_PASSWORD_MESSAGES.PLACEHOLDER_EMAIL);
            expect(usersService.findByEmail).not.toHaveBeenCalled();
        });
    });

    describe('eligibility', () => {
        it.each([UserRole.ADMIN, UserRole.AGENT, UserRole.AGENT_ORACLE, UserRole.MANAGER])('refuses %s accounts', async (role) => {
            usersService.findByEmployeeId.mockResolvedValue({ ...regularUser, role });
            await expect(service.forgotPassword({ identifier: '12345', email: 'x@gmail.com' }))
                .rejects.toThrow(new ForbiddenException(FORGOT_PASSWORD_MESSAGES.ROLE_NOT_ALLOWED));
            expect(mailDispatch.sendNow).not.toHaveBeenCalled();
            expect(usersService.updatePassword).not.toHaveBeenCalled();
        });

        it('refuses disabled accounts', async () => {
            usersService.findByEmployeeId.mockResolvedValue({ ...regularUser, isActive: false });
            await expect(service.forgotPassword({ identifier: '12345', email: 'x@gmail.com' }))
                .rejects.toThrow(new ForbiddenException(FORGOT_PASSWORD_MESSAGES.ACCOUNT_DISABLED));
        });
    });

    describe('delivery', () => {
        beforeEach(() => usersService.findByEmployeeId.mockResolvedValue(regularUser));

        // The emailed password must already be the stored one: mailing first meant an SMTP
        // timeout after delivery left the user holding a password that was never saved.
        it('saves the password before sending the email that carries it', async () => {
            const order: string[] = [];
            usersService.updatePassword.mockImplementation(async () => { order.push('save'); });
            mailDispatch.sendNow.mockImplementation(async () => { order.push('mail'); return { success: true }; });

            await service.forgotPassword({ identifier: '12345', email: 'x@gmail.com' });

            expect(order).toEqual(['save', 'mail']);
        });

        it('reports a failed email and lets the user retry immediately', async () => {
            mailDispatch.sendNow.mockResolvedValue({ success: false, error: 'SMTP down' });

            await expect(service.forgotPassword({ identifier: '12345', email: 'x@gmail.com' }))
                .rejects.toThrow(new ServiceUnavailableException(FORGOT_PASSWORD_MESSAGES.SEND_FAILED));
            expect(cache.delAsync).toHaveBeenCalledWith('auth:forgot-password:cooldown:user-1');
        });

        // Nothing is mailed until every step succeeded, so no delivered email can hold a
        // password that a later failure (and the client's resend) made stale.
        it('sends nothing and allows an immediate retry when session invalidation fails', async () => {
            sessionService.invalidateUser.mockRejectedValue(new Error('Redis down'));

            await expect(service.forgotPassword({ identifier: '12345', email: 'x@gmail.com' })).rejects.toThrow('Redis down');
            expect(mailDispatch.sendNow).not.toHaveBeenCalled();
            expect(cache.delAsync).toHaveBeenCalledWith('auth:forgot-password:cooldown:user-1');
        });
    });

    describe('cooldown', () => {
        beforeEach(() => usersService.findByEmployeeId.mockResolvedValue(regularUser));

        it('starts a per-user cooldown before resetting', async () => {
            await service.forgotPassword({ identifier: '12345', email: 'x@gmail.com' });

            expect(cache.setAsync).toHaveBeenCalledWith('auth:forgot-password:cooldown:user-1', true, 60);
        });

        it('refuses a repeat request inside the cooldown without touching the password', async () => {
            cache.getAsync.mockResolvedValue(true);

            await expect(service.forgotPassword({ identifier: '12345', email: 'x@gmail.com' }))
                .rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS, message: FORGOT_PASSWORD_MESSAGES.COOLDOWN });
            expect(usersService.updatePassword).not.toHaveBeenCalled();
            expect(mailDispatch.sendNow).not.toHaveBeenCalled();
        });
    });
});
