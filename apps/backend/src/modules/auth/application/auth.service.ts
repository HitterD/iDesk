import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from '../presentation/dto/register.dto';
import { ChangePasswordDto } from '../presentation/dto/change-password.dto';
import { UsersService } from '../../users/users.service';
import * as bcrypt from 'bcrypt';

// Login validation result types
export interface LoginValidationResult {
    success: boolean;
    user?: any;
    errorCode?: 'USER_NOT_FOUND' | 'WRONG_PASSWORD' | 'ACCOUNT_DISABLED';
}

@Injectable()
export class AuthService {
    constructor(
        private jwtService: JwtService,
        private usersService: UsersService,
    ) { }

    async changePassword(userId: string, dto: ChangePasswordDto) {
        const user = await this.usersService.findById(userId);
        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        const isMatch = await bcrypt.compare(dto.currentPassword, user.password);
        if (!isMatch) {
            throw new BadRequestException('Current password is incorrect');
        }

        const newPasswordHash = await bcrypt.hash(dto.newPassword, 10);
        await this.usersService.updatePassword(userId, newPasswordHash);

        return { message: 'Password updated successfully' };
    }

    /**
     * Validate user credentials with specific error codes
     * Returns result object with error code instead of just null
     */
    async validateUserWithDetails(email: string, pass: string): Promise<LoginValidationResult> {
        const user = await this.usersService.findByEmail(email);

        // User not found
        if (!user) {
            return {
                success: false,
                errorCode: 'USER_NOT_FOUND',
            };
        }

        // Check if user is active (if such field exists)
        if ((user as any).isActive === false || (user as any).status === 'DISABLED') {
            return {
                success: false,
                errorCode: 'ACCOUNT_DISABLED',
            };
        }

        // Password check
        const isPasswordValid = await bcrypt.compare(pass, user.password);
        if (!isPasswordValid) {
            return {
                success: false,
                errorCode: 'WRONG_PASSWORD',
            };
        }

        // Success - return user without password
        const { password, ...result } = user;
        return {
            success: true,
            user: result,
        };
    }

    async validateUser(email: string, pass: string): Promise<any> {
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
            user: user,
        };
    }

    async register(registerDto: RegisterDto) {
        return this.usersService.createUser({
            ...registerDto,
            role: registerDto.role || 'USER',
        } as any);
    }
}

