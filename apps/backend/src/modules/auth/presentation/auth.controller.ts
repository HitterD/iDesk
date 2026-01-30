import { Controller, Request, Post, UseGuards, Body, HttpCode, Res, Get } from '@nestjs/common';
import { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from '../application/auth.service';
import { RegisterDto } from './dto/register.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LocalAuthGuard } from '../infrastructure/guards/local-auth.guard';
import { JwtAuthGuard } from '../infrastructure/guards/jwt-auth.guard';
import { ApiOperation, ApiResponse, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { setCsrfCookie } from '../../../shared/core/middleware/csrf.middleware';

// Cookie configuration constants
const COOKIE_NAME = 'access_token';
const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
};

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    @UseGuards(LocalAuthGuard)
    @Post('login')
    @Throttle({ default: { limit: 5, ttl: 60000 } })
    @ApiOperation({ summary: 'User login - sets HttpOnly cookie' })
    @ApiResponse({ status: 200, description: 'Login successful, cookie set' })
    async login(@Request() req, @Res() res: Response) {
        const result = await this.authService.login(req.user, req);

        // Calculate cookie maxAge based on expiresIn (e.g., '3h' -> 3*60*60*1000)
        const expiresIn = result.expiresIn;
        const maxAgeMs = this.parseExpiresIn(expiresIn);

        // Set HttpOnly cookie with the token
        res.cookie(COOKIE_NAME, result.access_token, {
            ...COOKIE_OPTIONS,
            maxAge: maxAgeMs,
        });

        // Set CSRF token cookie after successful login
        // This allows subsequent state-changing requests to include the token
        setCsrfCookie(res);

        // Return user data without token (token is in HttpOnly cookie)
        return res.json({
            user: result.user,
            expiresIn: result.expiresIn,
            expiresAt: new Date(Date.now() + maxAgeMs).toISOString(),
        });
    }

    @Post('logout')
    @HttpCode(200)
    @ApiOperation({ summary: 'User logout - clears HttpOnly cookie' })
    @ApiResponse({ status: 200, description: 'Logged out successfully' })
    async logout(@Res() res: Response) {
        // Clear the auth cookie
        res.clearCookie(COOKIE_NAME, {
            httpOnly: COOKIE_OPTIONS.httpOnly,
            secure: COOKIE_OPTIONS.secure,
            sameSite: COOKIE_OPTIONS.sameSite,
            path: COOKIE_OPTIONS.path,
        });

        return res.json({ message: 'Logged out successfully' });
    }

    @Get('csrf-token')
    @ApiOperation({ summary: 'Get CSRF token for state-changing requests' })
    @ApiResponse({ status: 200, description: 'CSRF token generated and set in cookie' })
    getCsrfToken(@Res() res: Response) {
        const token = setCsrfCookie(res);
        return res.json({ csrfToken: token });
    }

    @Post('register')
    @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 registrations per minute
    @ApiOperation({ summary: 'User registration' })
    async register(@Body() registerDto: RegisterDto) {
        return this.authService.register(registerDto);
    }

    @Post('change-password')
    @UseGuards(JwtAuthGuard)
    @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 attempts per minute
    @ApiBearerAuth()
    @HttpCode(200)
    @ApiOperation({ summary: 'Change password' })
    @ApiResponse({ status: 200, description: 'Password changed successfully' })
    @ApiResponse({ status: 400, description: 'Invalid current password' })
    async changePassword(@Request() req, @Body() changePasswordDto: ChangePasswordDto) {
        return this.authService.changePassword(req.user.userId, changePasswordDto, req);
    }

    /**
     * Parse expiresIn string to milliseconds
     * @example '1h' -> 3600000, '3h' -> 10800000, '60m' -> 3600000
     */
    private parseExpiresIn(expiresIn: string): number {
        const match = expiresIn.match(/^(\d+)([smhd])$/);
        if (!match) {
            return 3600000; // Default 1 hour
        }

        const value = parseInt(match[1], 10);
        const unit = match[2];

        switch (unit) {
            case 's': return value * 1000;
            case 'm': return value * 60 * 1000;
            case 'h': return value * 60 * 60 * 1000;
            case 'd': return value * 24 * 60 * 60 * 1000;
            default: return 3600000;
        }
    }
}
