import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor() {
        super({
            jwtFromRequest: (req) => {
                const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
                console.log('Auth Header:', req.headers.authorization);
                console.log('Extracted Token:', token);
                return token;
            },
            ignoreExpiration: false,
            secretOrKey: process.env.JWT_SECRET || 'secretKey', // Use env var in production
        });
    }

    async validate(payload: any) {
        console.log('JwtStrategy validating payload:', payload);
        return { userId: payload.sub, username: payload.username, role: payload.role };
    }
}
