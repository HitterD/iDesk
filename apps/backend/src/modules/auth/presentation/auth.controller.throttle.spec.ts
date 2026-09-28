import { AuthController } from './auth.controller';
import { ZoomBookingController } from '../../zoom-booking/controllers/zoom-booking.controller';
import { ZoomAdminController } from '../../zoom-booking/controllers/zoom-admin.controller';

// @nestjs/throttler stores metadata as `${KEY}${throttlerName}`.
const SKIP_KEY = 'THROTTLER:SKIPdefault';
const LIMIT_KEY = 'THROTTLER:LIMITdefault';

const handler = (name: keyof AuthController) => AuthController.prototype[name] as unknown as object;

describe('throttling policy', () => {
    it.each(['refresh', 'getCsrfToken', 'logout', 'getIpDebug'] as const)(
        'does not throttle session plumbing: %s',
        (name) => {
            expect(Reflect.getMetadata(SKIP_KEY, handler(name))).toBe(true);
        },
    );

    it('keeps the brute-force limit on login', () => {
        expect(Reflect.getMetadata(SKIP_KEY, handler('login'))).toBeUndefined();
        expect(Reflect.getMetadata(LIMIT_KEY, handler('login'))).toBe(5);
    });

    it('has no controller-wide limit on zoom booking reads', () => {
        expect(Reflect.getMetadata(LIMIT_KEY, ZoomBookingController)).toBeUndefined();
        expect(Reflect.getMetadata(LIMIT_KEY, ZoomAdminController)).toBeUndefined();
    });
});
