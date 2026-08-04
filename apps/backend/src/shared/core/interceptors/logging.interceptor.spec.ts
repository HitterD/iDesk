import { LoggingInterceptor } from './logging.interceptor';
import { of } from 'rxjs';

describe('LoggingInterceptor', () => {
    it('does not include raw error text in logs', () => {
        const interceptor = new LoggingInterceptor();
        const errorSpy = jest.spyOn(interceptor.logger, 'error').mockImplementation();
        const context = {
            getType: () => 'http',
            switchToHttp: () => ({ getRequest: () => ({ method: 'GET', url: '/auth/login?token=secret', user: { userId: 'u1' } }) }),
        } as any;
        const next = { handle: () => of(undefined) } as any;
        interceptor.intercept(context, next).subscribe();
        expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('password=secret');
        expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('token=secret');
        errorSpy.mockRestore();
    });
});
