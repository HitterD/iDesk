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
    async login(@Request() req: any, @Res() res: Response) {
        const result = await this.authService.login(req.user, req);

        // Calculate cookie maxAge based on expiresIn (e.g., '3h' -> 3*60*60*1000)
        const expiresIn = result.expiresIn;
        const maxAgeMs = this.parseExpiresIn(expiresIn);

        // Set HttpOnly cookie with the token
        res.cookie(COOKIE_NAME, result.access_token, {
            ...COOKIE_OPTIONS,
            maxAge: maxAgeMs,
        });

        // Set refresh token in HttpOnly cookie
        res.cookie('refresh_token', result.refresh_token, {
            ...COOKIE_OPTIONS,
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
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
    @UseGuards(JwtAuthGuard)
    @HttpCode(200)
    @ApiOperation({ summary: 'User logout - clears HttpOnly cookie' })
    @ApiResponse({ status: 200, description: 'Logged out successfully' })
    async logout(@Request() req: any, @Res() res: Response) {
        await this.authService.logout(req.user, req);

        // Clear the auth cookie
        res.clearCookie(COOKIE_NAME, {
            httpOnly: COOKIE_OPTIONS.httpOnly,
            secure: COOKIE_OPTIONS.secure,
            sameSite: COOKIE_OPTIONS.sameSite,
            path: COOKIE_OPTIONS.path,
        });
        res.clearCookie('refresh_token', {
            httpOnly: COOKIE_OPTIONS.httpOnly,
            secure: COOKIE_OPTIONS.secure,
            sameSite: COOKIE_OPTIONS.sameSite,
            path: COOKIE_OPTIONS.path,
        });

        return res.json({ message: 'Logged out successfully' });
    }

    @Post('refresh')
    @Throttle({ default: { limit: 10, ttl: 60000 } })
    @ApiOperation({ summary: 'Refresh access token' })
    @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
    async refresh(@Request() req: any, @Res() res: Response) {
        const refreshToken = req.cookies?.refresh_token;
        if (!refreshToken) {
           return res.status(401).json({ message: 'No refresh token provided' });
        }
        
        const result = await this.authService.refreshToken(refreshToken, req);
        
        const maxAgeMs = this.parseExpiresIn(result.expiresIn);
        res.cookie(COOKIE_NAME, result.access_token, {
            ...COOKIE_OPTIONS,
            maxAge: maxAgeMs,
        });
        
        res.cookie('refresh_token', result.refresh_token, {
            ...COOKIE_OPTIONS,
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        
        return res.json({
            user: result.user,
            expiresIn: result.expiresIn,
            expiresAt: new Date(Date.now() + maxAgeMs).toISOString(),
        });
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
    async changePassword(@Request() req: any, @Body() changePasswordDto: ChangePasswordDto) {
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
