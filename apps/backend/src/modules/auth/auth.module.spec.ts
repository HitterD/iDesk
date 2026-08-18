import { Test } from '@nestjs/testing';
import { AuthMetricsListener } from './auth.module';
import { AuthMetricsService } from './monitoring/auth-metrics.service';
import { AUTH_EVENT } from './application/auth-events';

describe('AuthModule', () => {
    it('resolves AuthMetricsListener with AuthMetricsService', async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [AuthMetricsService, AuthMetricsListener],
        }).compile();

        const listener = moduleRef.get(AuthMetricsListener);
        listener.onLogin({ method: 'email', outcome: 'success' });

        expect(moduleRef.get(AuthMetricsService).snapshot()).toEqual({
            [`login|success|email||`]: 1,
        });
        expect(AUTH_EVENT.LOGIN_SUCCEEDED).toBe('auth.login.succeeded.v1');
        await moduleRef.close();
    });
});
