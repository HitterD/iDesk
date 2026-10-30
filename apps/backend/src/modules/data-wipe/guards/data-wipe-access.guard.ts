import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '../../users/enums/user-role.enum';

/**
 * Second gate in front of the data wipe endpoints, layered on top of
 * JwtAuthGuard + RolesGuard.
 *
 * Deliberately fail-closed in every direction: a missing env flag, an empty
 * allowlist, or an unrecognised email all deny. This is the opposite of
 * RolesGuard, which allows a request when no @Roles metadata is present — a
 * behaviour that would be dangerous here, so access is never inferred.
 */
@Injectable()
export class DataWipeAccessGuard implements CanActivate {
    private readonly logger = new Logger(DataWipeAccessGuard.name);

    constructor(private readonly configService: ConfigService) { }

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if (!user) {
            throw new ForbiddenException('Fitur wipe data memerlukan autentikasi.');
        }

        if (user.role !== UserRole.ADMIN) {
            throw new ForbiddenException('Fitur wipe data hanya untuk Administrator.');
        }

        if (!this.isFeatureEnabled()) {
            throw new ForbiddenException(
                'Fitur wipe data sedang dinonaktifkan. Aktifkan ALLOW_DATA_WIPE=true pada environment server untuk menggunakannya.',
            );
        }

        const allowed = this.allowedEmails();
        if (allowed.length === 0) {
            throw new ForbiddenException(
                'Daftar admin yang berhak melakukan wipe data masih kosong. Isi DATA_WIPE_ALLOWED_EMAILS pada environment server.',
            );
        }

        // JwtStrategy exposes the login email as `username`; there is no `email` field.
        const email = (user.username || '').trim().toLowerCase();
        if (!email || !allowed.includes(email)) {
            this.logger.warn(
                `Percobaan akses wipe data ditolak untuk user ${user.userId ?? 'unknown'} (${email || 'tanpa email'})`,
            );
            throw new ForbiddenException(
                'Akun Anda tidak terdaftar pada daftar admin yang berhak melakukan wipe data.',
            );
        }

        return true;
    }

    /** True only for an explicit "true" — any other value, including unset, denies. */
    isFeatureEnabled(): boolean {
        return this.configService.get<string>('ALLOW_DATA_WIPE', 'false').trim().toLowerCase() === 'true';
    }

    /** Normalised allowlist; empty when unset, which denies everyone. */
    allowedEmails(): string[] {
        return this.configService
            .get<string>('DATA_WIPE_ALLOWED_EMAILS', '')
            .split(',')
            .map((e) => e.trim().toLowerCase())
            .filter((e) => e.length > 0);
    }
}
