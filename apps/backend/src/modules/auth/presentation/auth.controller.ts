import { Controller, Request, Post, UseGuards, Body, HttpCode, Res, Get } from '@nestjs/common';
import { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from '../application/auth.service';
import { RegisterDto } from './dto/register.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LocalAuthGuard } from '../infrastructure/guards/local-auth.guard';
import { JwtAuthGuard } from '../infrastructure/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../infrastructure/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../../../shared/core/guards/roles.guard';
import { Roles } from '../../../shared/core/decorators/roles.decorator';
import { UserRole } from '../../users/enums/user-role.enum';
import { ApiOperation, ApiResponse, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { setCsrfCookie } from '../../../shared/core/middleware/csrf.middleware';
import {
    ACCESS_COOKIE_NAME,
    REFRESH_COOKIE_NAME,
    clearCookieOptions,
    withCookieMaxAge,
} from './cookie-options';

import { extractClientIp } from '../../../shared/security/client-ip';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    @Get('ip-debug')
    @ApiOperation({ summary: 'Diagnostic endpoint to check incoming proxy headers and resolved client IP' })
    async getIpDebug(@Request() req: any) {
        return {
            resolvedClientIp: extractClientIp(req),
            headers: {
                'x-forwarded-for': req.headers['x-forwarded-for'] || null,
                'x-real-ip': req.headers['x-real-ip'] || null,
                'x-client-ip': req.headers['x-client-ip'] || null,
                'x-cluster-client-ip': req.headers['x-cluster-client-ip'] || null,
                'cf-connecting-ip': req.headers['cf-connecting-ip'] || null,
                'forwarded': req.headers['forwarded'] || null,
                'host': req.headers['host'] || null,
                'user-agent': req.headers['user-agent'] || null,
            },
            expressIp: req.ip || null,
            socketRemoteAddress: req.socket?.remoteAddress || null,
        };
    }

    @UseGuards(LocalAuthGuard)
    @Post('login')
    @Throttle({ default: { limit: 5, ttl: 60000 } })
    @ApiOperation({ summary: 'User login - sets HttpOnly cookie' })
    @ApiResponse({ status: 200, description: 'Login successful, cookie set' })
    async login(@Request() req: any, @Res() res: Response) {
        const rememberMe = req.body?.rememberMe === true;
        const result = await this.authService.login(req.user, req, rememberMe);

        // Calculate cookie maxAge based on expiresIn (e.g., '8h' -> 8*60*60*1000)
        const expiresIn = result.expiresIn;
        const maxAgeMs = this.parseExpiresIn(expiresIn);
        const refreshMaxAgeMs = this.parseExpiresIn(result.refreshExpiresIn);

        // Set HttpOnly cookie with the token
        res.cookie(ACCESS_COOKIE_NAME, result.access_token, withCookieMaxAge(maxAgeMs));

        // Set refresh token in HttpOnly cookie
        res.cookie(REFRESH_COOKIE_NAME, result.refresh_token, withCookieMaxAge(refreshMaxAgeMs));

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
    @UseGuards(OptionalJwtAuthGuard)
    @HttpCode(200)
    @ApiOperation({ summary: 'User logout - clears HttpOnly cookie' })
    @ApiResponse({ status: 200, description: 'Logged out successfully' })
    async logout(@Request() req: any, @Res() res: Response) {
        if (req.user) {
            await this.authService.logout(req.user, req);
        }

        // Clear the auth cookie unconditionally
        res.clearCookie(ACCESS_COOKIE_NAME, clearCookieOptions());
        res.clearCookie(REFRESH_COOKIE_NAME, clearCookieOptions());

        return res.json({ message: 'Logged out successfully' });
    }

    @Post('refresh')
    @Throttle({ default: { limit: 30, ttl: 60000 } })
    @ApiOperation({ summary: 'Refresh access token' })
    @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
    async refresh(@Request() req: any, @Res() res: Response) {
        const refreshToken = req.cookies?.refresh_token;
        if (!refreshToken) {
           return res.status(401).json({ message: 'No refresh token provided' });
        }
        
        const result = await this.authService.refreshToken(refreshToken, req);

        const maxAgeMs = this.parseExpiresIn(result.expiresIn);
        const refreshMaxAgeMs = this.parseExpiresIn(result.refreshExpiresIn);
        res.cookie(ACCESS_COOKIE_NAME, result.access_token, withCookieMaxAge(maxAgeMs));

        res.cookie(REFRESH_COOKIE_NAME, result.refresh_token, withCookieMaxAge(refreshMaxAgeMs));
        
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
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 registrations per minute
    @ApiBearerAuth()
    @ApiOperation({ summary: 'User registration (Admin only)' })
    @ApiResponse({ status: 201, description: 'User created successfully.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
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
