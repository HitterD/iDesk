import { Injectable } from '@nestjs/common';
import { AuthEventPayload, AUTH_EVENT } from '../application/auth-events';

export type AuthMetricName = 'login' | 'login_failure' | 'refresh_reuse' | 'password_change' | 'session_invalidation';
export type AuthMetricLabels = { outcome: string; method?: string; roleClass?: string; dependency?: string };

@Injectable()
export class AuthMetricsService {
    private readonly counters = new Map<string, number>();

    record(name: AuthMetricName, labels: AuthMetricLabels): void {
        const key = `${name}|${labels.outcome}|${labels.method || ''}|${labels.roleClass || ''}|${labels.dependency || ''}`;
        this.counters.set(key, (this.counters.get(key) || 0) + 1);
    }

    recordEvent(event: string, payload: AuthEventPayload): void {
        if (event === AUTH_EVENT.LOGIN_SUCCEEDED) this.record('login', { outcome: payload.outcome || 'success', method: payload.method || 'unknown' });
        if (event === AUTH_EVENT.LOGIN_FAILED) this.record('login_failure', { outcome: payload.reason || 'failed' });
        if (event === AUTH_EVENT.REFRESH_REUSED) this.record('refresh_reuse', { outcome: 'reused' });
        if (event === AUTH_EVENT.PASSWORD_CHANGED) this.record('password_change', { outcome: 'success' });
        if (event === AUTH_EVENT.LOGOUT) this.record('session_invalidation', { outcome: 'success' });
    }

    snapshot(): Record<string, number> {
        return Object.fromEntries(this.counters);
    }
}
