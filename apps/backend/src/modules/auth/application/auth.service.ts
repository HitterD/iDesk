import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from '../presentation/dto/register.dto';
import { UsersService } from '../../users/users.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
    constructor(
        private jwtService: JwtService,
        private usersService: UsersService,
    ) { }

    async validateUser(email: string, pass: string): Promise<any> {
        // Find user by email (we need to access repo directly or add findByEmail to service)
        // Since UsersService doesn't expose findByEmail, we'll use a trick or update UsersService.
        // Actually, let's update UsersService to expose findByEmail or just use the repo if we can inject it here?
        // Better to use UsersService. But UsersService.findAll is paginated.
        // Let's assume we can add findByEmail to UsersService or use a workaround.
        // For now, I'll assume I can add findByEmail to UsersService.

        // Wait, I can't easily modify UsersService without checking if I can.
        // Let's look at UsersService again. It has `userRepo`.
        // I can inject `UsersService` and use it.

        // Let's add `findByEmail` to `UsersService` first.
        const user = await this.usersService.findByEmail(email);
        if (user && await bcrypt.compare(pass, user.password)) {
            const { password, ...result } = user;
            return result;
        }
        return null;
    }

    async login(user: any) {
        const payload = { username: user.email, sub: user.id, role: user.role };
        return {
            access_token: this.jwtService.sign(payload),
            user: user, // Return user info as well
        };
    }

    async register(registerDto: RegisterDto) {
        return this.usersService.createUser({
            ...registerDto,
            role: registerDto.role || 'USER', // Default role
        } as any);
    }
}
