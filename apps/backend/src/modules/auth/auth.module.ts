import { Module, Logger } from '@nestjs/common';
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
import { EventEmitterModule } from '@nestjs/event-emitter';
import { assertRefreshSessionConfig } from '../../shared/core/config/security.config';

// Fail fast if JWT_SECRET is not configured or too short
const logger = new Logger('AuthModule');
const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
    logger.error('FATAL: JWT_SECRET environment variable is not set!');
    logger.error('Please set JWT_SECRET in your .env file');
    throw new Error('JWT_SECRET must be set. Server cannot start without it.');
}

if (jwtSecret.length < 32) {
    logger.error('FATAL: JWT_SECRET is too short!');
    logger.error('JWT_SECRET must be at least 32 characters for security');
    throw new Error('JWT_SECRET must be at least 32 characters long.');
}

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
                return {
                    secret,
                    signOptions: {
                        expiresIn: configService.get<string>('JWT_EXPIRES_IN', '60m') as `${number}${'s' | 'm' | 'h' | 'd'}`,
                    },
                };
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
    ],
    controllers: [AuthController],
    exports: [AuthService, PassportModule, JwtModule, AuthEventPublisher],
})
export class AuthModule { }
