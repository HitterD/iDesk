import { Module, Logger } from '@nestjs/common';
import { AuthService } from './application/auth.service';
import { AuthController } from './presentation/auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './infrastructure/strategies/jwt.strategy';
import { LocalStrategy } from './infrastructure/strategies/local.strategy';
import { UsersModule } from '../users/users.module';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Fail fast if JWT_SECRET is not configured
const logger = new Logger('AuthModule');
if (!process.env.JWT_SECRET) {
    logger.error('FATAL: JWT_SECRET environment variable is not set!');
    logger.error('Please set JWT_SECRET in your .env file');
    if (process.env.NODE_ENV === 'production') {
        throw new Error('JWT_SECRET must be set in production');
    }
    logger.warn('Using fallback secret for development only - DO NOT USE IN PRODUCTION');
}

@Module({
    imports: [
        UsersModule,
        PassportModule,
        ConfigModule,
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => ({
                secret: configService.get<string>('JWT_SECRET') || 'dev-only-secret-change-me',
                signOptions: {
                    expiresIn: configService.get<string>('JWT_EXPIRES_IN', '60m'),
                },
            }),
            inject: [ConfigService],
        }),
    ],
    providers: [AuthService, JwtStrategy, LocalStrategy],
    controllers: [AuthController],
    exports: [AuthService, PassportModule, JwtModule],
})
export class AuthModule { }
