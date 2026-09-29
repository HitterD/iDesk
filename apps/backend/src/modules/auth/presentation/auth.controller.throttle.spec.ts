import { AuthController, AUTH_RATE_LIMIT } from './auth.controller';
import { ZoomBookingController } from '../../zoom-booking/controllers/zoom-booking.controller';
import { ZoomAdminController } from '../../zoom-booking/controllers/zoom-admin.controller';
import { UsersController } from '../../users/users.controller';

// @nestjs/throttler stores metadata as `${KEY}${throttlerName}`.
const LIMIT_KEY = 'THROTTLER:LIMITdefault';

const handler = (name: keyof AuthController) => AuthController.prototype[name] as unknown as object;

describe('throttling policy', () => {
    it.each(['login', 'changePassword'] as const)('limits credential endpoint %s to 30/min', (name) => {
        expect(AUTH_RATE_LIMIT).toEqual({ limit: 30, ttl: 60000 });
        expect(Reflect.getMetadata(LIMIT_KEY, handler(name))).toBe(AUTH_RATE_LIMIT.limit);
    });

    it.each(['refresh', 'getCsrfToken', 'logout', 'getIpDebug', 'register', 'forgotPassword', 'verifyCredentialS2S'] as const)(
        'does not limit %s',
        (name) => {
            expect(Reflect.getMetadata(LIMIT_KEY, handler(name))).toBeUndefined();
        },
    );

    it('has no limits on other controllers', () => {
        for (const controller of [ZoomBookingController, ZoomAdminController, UsersController]) {
            expect(Reflect.getMetadata(LIMIT_KEY, controller)).toBeUndefined();
            for (const name of Object.getOwnPropertyNames(controller.prototype)) {
                expect(Reflect.getMetadata(LIMIT_KEY, (controller.prototype as any)[name])).toBeUndefined();
            }
        }
    });
});
