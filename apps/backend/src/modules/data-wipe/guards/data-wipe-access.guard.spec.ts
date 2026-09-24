import { ForbiddenException } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';
import { DataWipeAccessGuard } from './data-wipe-access.guard';
import { UserRole } from '../../users/enums/user-role.enum';

describe('DataWipeAccessGuard', () => {
    const makeContext = (user: any): ExecutionContext =>
    ({
        switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as ExecutionContext);

    const makeGuard = (env: Record<string, string>) =>
        new DataWipeAccessGuard({
            get: (key: string, fallback: string) => env[key] ?? fallback,
        } as any);

    const admin = { userId: 'u1', role: UserRole.ADMIN, email: 'admin@corp.com' };

    const enabledEnv = {
        ALLOW_DATA_WIPE: 'true',
        DATA_WIPE_ALLOWED_EMAILS: 'admin@corp.com',
    };

    it('allows an allowlisted admin when the feature flag is on', () => {
        expect(makeGuard(enabledEnv).canActivate(makeContext(admin))).toBe(true);
    });

    describe('fail-closed behaviour', () => {
        it('denies when the feature flag is unset', () => {
            const guard = makeGuard({ DATA_WIPE_ALLOWED_EMAILS: 'admin@corp.com' });
            expect(() => guard.canActivate(makeContext(admin))).toThrow(ForbiddenException);
        });

        it('denies when the feature flag is any value other than "true"', () => {
            for (const value of ['false', '1', 'yes', 'TRUE ', '']) {
                const guard = makeGuard({
                    ALLOW_DATA_WIPE: value,
                    DATA_WIPE_ALLOWED_EMAILS: 'admin@corp.com',
                });
                const shouldPass = value.trim().toLowerCase() === 'true';
                if (shouldPass) {
                    expect(guard.canActivate(makeContext(admin))).toBe(true);
                } else {
                    expect(() => guard.canActivate(makeContext(admin))).toThrow(ForbiddenException);
                }
            }
        });

        it('denies everyone when the allowlist is empty', () => {
            const guard = makeGuard({ ALLOW_DATA_WIPE: 'true', DATA_WIPE_ALLOWED_EMAILS: '' });
            expect(() => guard.canActivate(makeContext(admin))).toThrow(ForbiddenException);
        });

        it('denies an admin whose email is not on the allowlist', () => {
            const guard = makeGuard({
                ALLOW_DATA_WIPE: 'true',
                DATA_WIPE_ALLOWED_EMAILS: 'someone-else@corp.com',
            });
            expect(() => guard.canActivate(makeContext(admin))).toThrow(ForbiddenException);
        });

        it('denies a non-admin role even when allowlisted', () => {
            const guard = makeGuard({
                ALLOW_DATA_WIPE: 'true',
                DATA_WIPE_ALLOWED_EMAILS: 'manager@corp.com',
            });
            const manager = { userId: 'u2', role: UserRole.MANAGER, email: 'manager@corp.com' };
            expect(() => guard.canActivate(makeContext(manager))).toThrow(ForbiddenException);
        });

        it('denies an unauthenticated request', () => {
            expect(() => makeGuard(enabledEnv).canActivate(makeContext(undefined))).toThrow(
                ForbiddenException,
            );
        });

        it('denies a user without an email', () => {
            const guard = makeGuard(enabledEnv);
            const noEmail = { userId: 'u3', role: UserRole.ADMIN, email: '' };
            expect(() => guard.canActivate(makeContext(noEmail))).toThrow(ForbiddenException);
        });
    });

    describe('allowlist parsing', () => {
        it('matches case-insensitively and ignores surrounding whitespace', () => {
            const guard = makeGuard({
                ALLOW_DATA_WIPE: 'true',
                DATA_WIPE_ALLOWED_EMAILS: '  Admin@Corp.com , other@corp.com ',
            });
            expect(guard.canActivate(makeContext(admin))).toBe(true);
        });

        it('ignores empty entries produced by trailing commas', () => {
            const guard = makeGuard({
                ALLOW_DATA_WIPE: 'true',
                DATA_WIPE_ALLOWED_EMAILS: 'admin@corp.com,,',
            });
            expect(guard.allowedEmails()).toEqual(['admin@corp.com']);
        });
    });
});
