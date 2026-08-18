import { Module, Injectable } from '@nestjs/common';
import { AuthService } from './application/auth.service';
import { AuthController } from './presentation/auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './infrastructure/strategies/jwt.strategy';
import { LocalStrategy } from './infrastructure/strategies/local.strategy';
import { UsersModule } from '../users/users.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuditModule } from '../audit/audit.module';
import { HrisGatewayModule } from '../hris-gateway/hris-gateway.module';
import { AppCacheModule } from '../../shared/core/cache/cache.module';
import { RefreshSessionStore } from './infrastructure/refresh-session.store';
import { TokenService } from './application/token.service';
import { SessionService } from './application/session.service';
import { CredentialValidatorService } from './application/credential-validator.service';
import { HrisProvisioningService } from './application/hris-provisioning.service';
import { AuthEventPublisher } from './application/auth-events';
import { AuthMetricsService } from './monitoring/auth-metrics.service';
import { AUTH_EVENT } from './application/auth-events';
import { OnEvent } from '@nestjs/event-emitter';
import { AuthEventPayload } from './application/auth-events';

@Injectable()
export class AuthMetricsListener {
    constructor(private readonly metrics: AuthMetricsService) {}

    @OnEvent(AUTH_EVENT.LOGIN_SUCCEEDED)
    onLogin(payload: AuthEventPayload) { this.metrics.recordEvent(AUTH_EVENT.LOGIN_SUCCEEDED, payload); }

    @OnEvent(AUTH_EVENT.LOGIN_FAILED)
    onFailure(payload: AuthEventPayload) { this.metrics.recordEvent(AUTH_EVENT.LOGIN_FAILED, payload); }

    @OnEvent(AUTH_EVENT.LOGOUT)
    onLogout(payload: AuthEventPayload) { this.metrics.recordEvent(AUTH_EVENT.LOGOUT, payload); }

    @OnEvent(AUTH_EVENT.PASSWORD_CHANGED)
    onPasswordChanged(payload: AuthEventPayload) { this.metrics.recordEvent(AUTH_EVENT.PASSWORD_CHANGED, payload); }

    @OnEvent(AUTH_EVENT.REFRESH_REUSED)
    onReuse(payload: AuthEventPayload) { this.metrics.recordEvent(AUTH_EVENT.REFRESH_REUSED, payload); }
}
import { EventEmitterModule } from '@nestjs/event-emitter';
import { assertRefreshSessionConfig } from '../../shared/core/config/security.config';

// Fail fast if JWT_SECRET is not configured or too short
// Refuse to boot a refresh-session mode this deployment cannot serve: Redis security
// state has no in-memory fallback, so `dual`/`redis` without Redis would accept every
// login and then reject every refresh.
assertRefreshSessionConfig();

@Module({
    imports: [
        UsersModule,
        PassportModule,
        ConfigModule,
        AuditModule,
        HrisGatewayModule,
        AppCacheModule,
        EventEmitterModule,
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => {
                const secret = configService.get<string>('JWT_SECRET');
                if (!secret) {
                    throw new Error('JWT_SECRET is required');
                }
                // TokenService supplies role-based access expiry explicitly.
                return { secret };
            },
            inject: [ConfigService],
        }),
    ],
    providers: [
        AuthService,
        JwtStrategy,
        LocalStrategy,
        RefreshSessionStore,
        TokenService,
        SessionService,
        CredentialValidatorService,
        HrisProvisioningService,
        AuthEventPublisher,
        AuthMetricsService,
        AuthMetricsListener,
    ],
    controllers: [AuthController],
    exports: [AuthService, PassportModule, JwtModule, AuthEventPublisher],
})
export class AuthModule { }
