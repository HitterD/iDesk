import { AuthMetricsService } from './auth-metrics.service';
import { AUTH_EVENT } from '../application/auth-events';

describe('AuthMetricsService', () => {
    it('records bounded event labels without raw identifiers', () => {
        const service = new AuthMetricsService();
        service.recordEvent(AUTH_EVENT.LOGIN_SUCCEEDED, { method: 'email', outcome: 'success' });
        const snapshot = service.snapshot();
        expect(Object.keys(snapshot)[0]).toContain('login|success|email');
        expect(JSON.stringify(snapshot)).not.toContain('user@example.com');
    });

    it('records refresh reuse separately', () => {
        const service = new AuthMetricsService();
        service.recordEvent(AUTH_EVENT.REFRESH_REUSED, { userId: 'u1' });
        expect(Object.values(service.snapshot())).toEqual([1]);
    });
});
