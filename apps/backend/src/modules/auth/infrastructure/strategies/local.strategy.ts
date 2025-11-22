import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../../application/auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
    constructor(private authService: AuthService) {
        super({
            usernameField: 'email', // We use email as username
        });
    }

    async validate(email: string, pass: string): Promise<any> {
        const user = await this.authService.validateUser(email, pass);
        if (!user) {
            throw new UnauthorizedException();
        }
        return user;
    }
}
