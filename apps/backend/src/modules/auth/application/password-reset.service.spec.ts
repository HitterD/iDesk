import { BadRequestException, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
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

    describe('NIK + registered email', () => {
        it('sends the temporary password to the registered email once NIK and email match', async () => {
            usersService.findByEmployeeId.mockResolvedValue(regularUser);

            const result = await service.forgotPassword({ identifier: ' 12345 ', email: ' BUDI@KapalApi.co.id ' });

            expect(usersService.findByEmployeeId).toHaveBeenCalledWith('12345');
            const mail = mailDispatch.sendNow.mock.calls[0][0];
            expect(mail.to).toBe('budi@kapalapi.co.id');
            expect(mail.template).toBe('password-reset');
            expect(validatePasswordPolicy(mail.context.password).valid).toBe(true);
            expect(bcrypt.hash).toHaveBeenCalledWith(mail.context.password, expect.any(Number));
            expect(usersService.updatePassword).toHaveBeenCalledWith('user-1', 'hashed-temp');
            expect(usersService.update).toHaveBeenCalledWith('user-1', { mustChangePassword: true });
            expect(sessionService.invalidateUser).toHaveBeenCalledWith('user-1');
            expect(result).toEqual({ message: FORGOT_PASSWORD_MESSAGES.SUCCESS, sentTo: 'budi@kapalapi.co.id' });
        });

        // Regression: a NIK is not secret, so mailing to a typed address let anyone take over
        // a regular account by sending its temporary password to their own inbox.
        it('refuses an email that differs from the registered one without touching the account', async () => {
            usersService.findByEmployeeId.mockResolvedValue(regularUser);

            await expect(service.forgotPassword({ identifier: '12345', email: 'attacker@gmail.com' }))
                .rejects.toThrow(new BadRequestException(FORGOT_PASSWORD_MESSAGES.MISMATCH));
            expect(usersService.updatePassword).not.toHaveBeenCalled();
            expect(sessionService.invalidateUser).not.toHaveBeenCalled();
            expect(mailDispatch.sendNow).not.toHaveBeenCalled();
        });

        it('requires the registered email', async () => {
            await expect(service.forgotPassword({ identifier: '12345' })).rejects.toThrow(BadRequestException);
            expect(usersService.findByEmployeeId).not.toHaveBeenCalled();
        });

        it('no longer accepts an email in place of the NIK', async () => {
            await expect(service.forgotPassword({ identifier: 'budi@kapalapi.co.id', email: 'budi@kapalapi.co.id' }))
                .rejects.toThrow(new BadRequestException(FORGOT_PASSWORD_MESSAGES.MISMATCH));
            expect(usersService.findByEmail).not.toHaveBeenCalled();
        });

        it('answers an unknown NIK with the same message as a mismatch', async () => {
            usersService.findByEmployeeId.mockResolvedValue(undefined);
            await expect(service.forgotPassword({ identifier: '99999', email: 'x@gmail.com' }))
                .rejects.toThrow(new BadRequestException(FORGOT_PASSWORD_MESSAGES.MISMATCH));
        });

        it('treats a placeholder account email as unmatchable', async () => {
            usersService.findByEmployeeId.mockResolvedValue({ ...regularUser, email: '12345@hris.local' });
            await expect(service.forgotPassword({ identifier: '12345', email: '12345@hris.local' }))
                .rejects.toThrow(new BadRequestException(FORGOT_PASSWORD_MESSAGES.MISMATCH));
            expect(mailDispatch.sendNow).not.toHaveBeenCalled();
        });
    });

    describe('eligibility', () => {
        it.each([UserRole.ADMIN, UserRole.AGENT, UserRole.AGENT_ORACLE, UserRole.MANAGER])('refuses %s accounts without revealing the role', async (role) => {
            usersService.findByEmployeeId.mockResolvedValue({ ...regularUser, role });
            await expect(service.forgotPassword({ identifier: '12345', email: regularUser.email }))
                .rejects.toThrow(new BadRequestException(FORGOT_PASSWORD_MESSAGES.MISMATCH));
            expect(mailDispatch.sendNow).not.toHaveBeenCalled();
            expect(usersService.updatePassword).not.toHaveBeenCalled();
        });

        it('refuses disabled accounts without revealing their state', async () => {
            usersService.findByEmployeeId.mockResolvedValue({ ...regularUser, isActive: false });
            await expect(service.forgotPassword({ identifier: '12345', email: regularUser.email }))
                .rejects.toThrow(new BadRequestException(FORGOT_PASSWORD_MESSAGES.MISMATCH));
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

            await service.forgotPassword({ identifier: '12345', email: regularUser.email });

            expect(order).toEqual(['save', 'mail']);
        });

        it('reports a failed email and lets the user retry immediately', async () => {
            mailDispatch.sendNow.mockResolvedValue({ success: false, error: 'SMTP down' });

            await expect(service.forgotPassword({ identifier: '12345', email: regularUser.email }))
                .rejects.toThrow(new ServiceUnavailableException(FORGOT_PASSWORD_MESSAGES.SEND_FAILED));
            expect(cache.delAsync).toHaveBeenCalledWith('auth:forgot-password:cooldown:user-1');
        });

        // Nothing is mailed until every step succeeded, so no delivered email can hold a
        // password that a later failure (and the client's resend) made stale.
        it('sends nothing and allows an immediate retry when session invalidation fails', async () => {
            sessionService.invalidateUser.mockRejectedValue(new Error('Redis down'));

            await expect(service.forgotPassword({ identifier: '12345', email: regularUser.email })).rejects.toThrow('Redis down');
            expect(mailDispatch.sendNow).not.toHaveBeenCalled();
            expect(cache.delAsync).toHaveBeenCalledWith('auth:forgot-password:cooldown:user-1');
        });
    });

    describe('cooldown', () => {
        beforeEach(() => usersService.findByEmployeeId.mockResolvedValue(regularUser));

        it('starts a per-user cooldown before resetting', async () => {
            await service.forgotPassword({ identifier: '12345', email: regularUser.email });

            expect(cache.setAsync).toHaveBeenCalledWith('auth:forgot-password:cooldown:user-1', true, 60);
        });

        it('refuses a repeat request inside the cooldown without touching the password', async () => {
            cache.getAsync.mockResolvedValue(true);

            await expect(service.forgotPassword({ identifier: '12345', email: regularUser.email }))
                .rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS, message: FORGOT_PASSWORD_MESSAGES.COOLDOWN });
            expect(usersService.updatePassword).not.toHaveBeenCalled();
            expect(mailDispatch.sendNow).not.toHaveBeenCalled();
        });
    });
});
