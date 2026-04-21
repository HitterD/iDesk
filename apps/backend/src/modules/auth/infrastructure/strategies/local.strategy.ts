import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException, HttpException, HttpStatus } from '@nestjs/common';
import { AuthService } from '../../application/auth.service';

// Custom exception with error code for frontend
class LoginException extends HttpException {
    constructor(message: string, errorCode: string) {
        super(
            {
                statusCode: HttpStatus.UNAUTHORIZED,
                message,
                errorCode,
            },
            HttpStatus.UNAUTHORIZED,
        );
    }
}

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
    constructor(private authService: AuthService) {
        super({
            usernameField: 'email', // We use email as username
        });
    }

    async validate(email: string, pass: string): Promise<any> {
        const result = await this.authService.validateUserWithDetails(email, pass);

        if (!result.success) {
            switch (result.errorCode) {
                case 'USER_NOT_FOUND':
                    throw new LoginException(
                        'No account found with this email address',
                        'USER_NOT_FOUND'
                    );
                case 'WRONG_PASSWORD':
                    throw new LoginException(
                        'Incorrect password. Please try again',
                        'WRONG_PASSWORD'
                    );
                case 'ACCOUNT_DISABLED':
                    throw new LoginException(
                        'Your account has been disabled. Contact administrator',
                        'ACCOUNT_DISABLED'
                    );
                default:
                    throw new UnauthorizedException('Login failed');
            }
        }

        return result.user;
    }
}

