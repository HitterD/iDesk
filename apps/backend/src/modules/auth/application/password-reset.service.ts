import {
    BadRequestException,
    ForbiddenException,
    HttpException,
    HttpStatus,
    Injectable,
    Logger,
    NotFoundException,
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
    EMAIL_REQUIRED: 'Email tujuan wajib diisi.',
    NIK_NOT_FOUND: 'NIK tidak ditemukan. Periksa kembali NIK HRIS Anda.',
    EMAIL_NOT_FOUND: 'Email tidak terdaftar. Gunakan NIK HRIS Anda.',
    PLACEHOLDER_EMAIL: 'Email tersebut tidak dapat menerima pesan. Gunakan email aktif Anda.',
    ACCOUNT_DISABLED: 'Akun nonaktif. Silakan hubungi admin.',
    ROLE_NOT_ALLOWED: 'Akun admin/agent/manager tidak bisa reset mandiri. Silakan hubungi admin.',
    SEND_FAILED: 'Gagal mengirim email. Silakan coba beberapa saat lagi atau hubungi admin.',
    COOLDOWN: 'Password sementara baru saja dikirim. Periksa email Anda atau coba lagi dalam 1 menit.',
    SUCCESS: 'Password sementara telah dikirim ke email Anda.',
} as const;

/**
 * Self-service reset from the login page. Only regular users qualify: a NIK is not
 * secret, so privileged accounts must still go through an admin. The typed email only
 * receives the temporary password; it never replaces the email stored on the account.
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
        const { user, recipient } = await this.resolveTarget(dto);
        this.assertEligible(user);

        const cooldownKey = `${RESET_COOLDOWN_KEY_PREFIX}${user.id}`;
        if (await this.cache.getAsync<boolean>(cooldownKey)) {
            throw new HttpException(FORGOT_PASSWORD_MESSAGES.COOLDOWN, HttpStatus.TOO_MANY_REQUESTS);
        }
        await this.cache.setAsync(cooldownKey, true, RESET_COOLDOWN_SECONDS);

        try {
            await this.resetAndMail(user, recipient);
        } catch (error) {
            // Nothing usable reached the user, so a retry must not wait out the cooldown.
            await this.cache.delAsync(cooldownKey);
            throw error;
        }
        return { message: FORGOT_PASSWORD_MESSAGES.SUCCESS, sentTo: recipient };
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

    private async resolveTarget(dto: ForgotPasswordDto): Promise<{ user: User; recipient: string }> {
        const identifier = dto.identifier.trim();

        // Forgotten NIK: the registered email identifies the account and receives the mail.
        if (identifier.includes('@')) {
            const email = identifier.toLowerCase();
            if (email.endsWith(PLACEHOLDER_EMAIL_DOMAIN)) {
                throw new BadRequestException(FORGOT_PASSWORD_MESSAGES.PLACEHOLDER_EMAIL);
            }
            const user = await this.usersService.findByEmail(email);
            if (!user) throw new NotFoundException(FORGOT_PASSWORD_MESSAGES.EMAIL_NOT_FOUND);
            return { user, recipient: user.email };
        }

        const recipient = dto.email?.trim().toLowerCase();
        if (!recipient) throw new BadRequestException(FORGOT_PASSWORD_MESSAGES.EMAIL_REQUIRED);
        if (recipient.endsWith(PLACEHOLDER_EMAIL_DOMAIN)) {
            throw new BadRequestException(FORGOT_PASSWORD_MESSAGES.PLACEHOLDER_EMAIL);
        }
        const user = await this.usersService.findByEmployeeId(identifier);
        if (!user) throw new NotFoundException(FORGOT_PASSWORD_MESSAGES.NIK_NOT_FOUND);
        return { user, recipient };
    }

    private assertEligible(user: User): void {
        if (user.isActive === false) throw new ForbiddenException(FORGOT_PASSWORD_MESSAGES.ACCOUNT_DISABLED);
        if (user.role !== UserRole.USER) throw new ForbiddenException(FORGOT_PASSWORD_MESSAGES.ROLE_NOT_ALLOWED);
    }
}
