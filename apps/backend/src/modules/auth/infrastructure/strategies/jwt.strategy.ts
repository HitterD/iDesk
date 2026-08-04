import { Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedClaims, AuthenticatedUser } from '../../application/auth-user.types';
import { toAuthenticatedUser } from '../../application/auth-user.mapper';

/**
 * Custom JWT extractor that checks cookie first, then Authorization header
 * This supports both cookie-based auth (browser) and header-based auth (API clients)
 */
const cookieOrHeaderExtractor = (req: Request): string | null => {
    let token: string | null = null;

    // First, try to extract from HttpOnly cookie
    if (req && req.cookies) {
        token = req.cookies['access_token'];
    }

    // Fallback to Authorization header for API clients
    if (!token && req.headers.authorization) {
        const [type, headerToken] = req.headers.authorization.split(' ');
        if (type === 'Bearer' && headerToken) {
            token = headerToken;
        }
    }

    return token;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    private readonly logger = new Logger(JwtStrategy.name);

    constructor() {
        // Fail fast if JWT_SECRET is not configured
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            throw new Error('FATAL: JWT_SECRET environment variable is not set. Server cannot start securely.');
        }

        super({
            jwtFromRequest: cookieOrHeaderExtractor,
            ignoreExpiration: false,
            secretOrKey: jwtSecret,
        });
    }

    async validate(payload: AuthenticatedClaims): Promise<AuthenticatedUser> {
        if (!payload?.sub || !payload.username || !payload.role || !payload.fullName) {
            throw new UnauthorizedException('Invalid token payload');
        }

        // Only log user ID in development, never log full payload
        if (process.env.NODE_ENV !== 'production') {
            this.logger.debug(`Validating user: ${payload.sub}`);
        }

        return toAuthenticatedUser({
            id: payload.sub,
            email: payload.username,
            role: payload.role,
            fullName: payload.fullName,
        });
    }
}
