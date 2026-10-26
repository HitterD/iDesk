import {
    BadRequestException,
    HttpException,
    HttpStatus,
    Injectable,
    Logger,
    ServiceUnavailableException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { UsersService } from '../../users/users.service';
import { UserRole } from '../../users/enums/user-role.enum';
import { User } from '../../users/entities/user.entity';
import { MailDispatchService } from '../../../shared/mail/mail-dispatch.service';
import { BCRYPT_ROUNDS } from '../../../shared/core/config/security.config';
import { CacheService } from '../../../shared/core/cache/cache.service';
import { SessionService } from './session.service';
import { ForgotPasswordDto } from '../presentation/dto/forgot-password.dto';

/** HRIS sync gives employees without an HR email a placeholder that cannot receive mail. */
const PLACEHOLDER_EMAIL_DOMAIN = '@hris.local';
const TEMP_PASSWORD_BYTES = 8;
// Hex alone may lack a letter case; the suffix guarantees the password policy classes.
const TEMP_PASSWORD_SUFFIX = 'Aa1';
/** Blocks double submits: each reset replaces the password mailed by the previous one. */
const RESET_COOLDOWN_SECONDS = 60;
const RESET_COOLDOWN_KEY_PREFIX = 'auth:forgot-password:cooldown:';

export const FORGOT_PASSWORD_MESSAGES = {
    EMAIL_REQUIRED: 'Email terdaftar wajib diisi.',
    // One answer for every refusal, so the form cannot be used to probe which NIKs exist,
    // which accounts are disabled or which ones belong to staff.
    MISMATCH: 'NIK dan email tidak cocok dengan data terdaftar. Hubungi IT jika Anda lupa email yang didaftarkan.',
    SEND_FAILED: 'Gagal mengirim email. Silakan coba beberapa saat lagi atau hubungi admin.',
    COOLDOWN: 'Password sementara baru saja dikirim. Periksa email Anda atau coba lagi dalam 1 menit.',
    SUCCESS: 'Password sementara telah dikirim ke email Anda.',
} as const;

/**
 * Self-service reset from the login page. A NIK is not secret, so the caller must also
 * know the email registered on the account, and the temporary password only ever goes
 * to that registered email. Privileged accounts must still go through an admin.
 */
@Injectable()
export class PasswordResetService {
    private readonly logger = new Logger(PasswordResetService.name);

    constructor(
        private readonly usersService: UsersService,
        private readonly sessionService: SessionService,
        private readonly mailDispatch: MailDispatchService,
        private readonly cache: CacheService,
    ) {}

    async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string; sentTo: string }> {
        const user = await this.resolveUser(dto);

        const cooldownKey = `${RESET_COOLDOWN_KEY_PREFIX}${user.id}`;
        if (await this.cache.getAsync<boolean>(cooldownKey)) {
            throw new HttpException(FORGOT_PASSWORD_MESSAGES.COOLDOWN, HttpStatus.TOO_MANY_REQUESTS);
        }
        await this.cache.setAsync(cooldownKey, true, RESET_COOLDOWN_SECONDS);

        try {
            await this.resetAndMail(user, user.email);
        } catch (error) {
            // Nothing usable reached the user, so a retry must not wait out the cooldown.
            await this.cache.delAsync(cooldownKey);
            throw error;
        }
        return { message: FORGOT_PASSWORD_MESSAGES.SUCCESS, sentTo: user.email };
    }

    /**
     * Save first, mail last: the emailed password is always the stored one. Mailing first
     * let an SMTP timeout after delivery (or a failure in a later step) leave the user with
     * a password that was never saved or was already replaced by a retry.
     */
    private async resetAndMail(user: User, recipient: string): Promise<void> {
        const temporaryPassword = `${randomBytes(TEMP_PASSWORD_BYTES).toString('hex')}${TEMP_PASSWORD_SUFFIX}`;
        const hash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);
        await this.usersService.updatePassword(user.id, hash);
        await this.usersService.update(user.id, { mustChangePassword: true });
        await this.sessionService.invalidateUser(user.id);

        const result = await this.mailDispatch.sendNow({
            to: recipient,
            subject: 'Reset Password iDesk',
            template: 'password-reset',
            context: {
                name: user.fullName,
                nik: user.employeeId || '-',
                email: user.email,
                password: temporaryPassword,
            },
        });
        if (!result.success) {
            this.logger.warn(`Forgot-password email to user ${user.id} failed: ${result.error}`);
            throw new ServiceUnavailableException(FORGOT_PASSWORD_MESSAGES.SEND_FAILED);
        }
    }

    /** Every refusal past input validation shares MISMATCH; see FORGOT_PASSWORD_MESSAGES. */
    private async resolveUser(dto: ForgotPasswordDto): Promise<User> {
        const nik = dto.identifier.trim();
        const email = dto.email?.trim().toLowerCase();
        if (!email) throw new BadRequestException(FORGOT_PASSWORD_MESSAGES.EMAIL_REQUIRED);

        const user = nik.includes('@') ? null : await this.usersService.findByEmployeeId(nik);
        const registered = user?.email?.trim().toLowerCase();
        if (
            !user
            || registered !== email
            || email.endsWith(PLACEHOLDER_EMAIL_DOMAIN)
            || user.isActive === false
            || user.role !== UserRole.USER
        ) {
            throw new BadRequestException(FORGOT_PASSWORD_MESSAGES.MISMATCH);
        }
        return user;
    }
}
