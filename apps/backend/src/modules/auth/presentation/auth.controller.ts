import { Controller, Request, Post, UseGuards, Body, HttpCode, Res, Get, Query } from '@nestjs/common';
import { Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from '../application/auth.service';
import { RegisterDto } from './dto/register.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { PasswordResetService } from '../application/password-reset.service';
import { LocalAuthGuard } from '../infrastructure/guards/local-auth.guard';
import { JwtAuthGuard } from '../infrastructure/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../infrastructure/guards/optional-jwt-auth.guard';
import { S2sAuthGuard } from '../infrastructure/guards/s2s-auth.guard';
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
import { IpopGrantRejectedError, IpopOidcClient, newAuthorizationSecrets } from '../infrastructure/ipop-oidc.client';
import { IpopAccountLinker } from '../application/ipop-account-linker.service';

const OIDC_COOKIE_NAME = 'ipop_oidc';
const OIDC_COOKIE_TTL_MS = 5 * 60 * 1000;

/** Only same-origin relative paths; rejects //host, /\host and scheme URLs. */
export function safeReturnTo(value: unknown): string {
    if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/';
    return value;
}

/** Only credential endpoints are throttled; the office network shares one proxy IP. */
export const AUTH_RATE_LIMIT = { limit: 30, ttl: 60000 } as const;

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
    constructor(
        private authService: AuthService,
        private readonly passwordResetService: PasswordResetService,
        private readonly ipopOidc: IpopOidcClient,
        private readonly ipopLinker: IpopAccountLinker,
        private readonly jwtService: JwtService,
    ) { }

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
    @Throttle({ default: AUTH_RATE_LIMIT })
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

    // Needs a valid signed refresh cookie (not guessable), and callers share the office
    // NAT IP here; a throttled refresh used to log users out.
    @Post('refresh')
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
    @Throttle({ default: AUTH_RATE_LIMIT })
    @ApiBearerAuth()
    @HttpCode(200)
    @ApiOperation({ summary: 'Change password' })
    @ApiResponse({ status: 200, description: 'Password changed successfully' })
    @ApiResponse({ status: 400, description: 'Invalid current password' })
    async changePassword(@Request() req: any, @Body() changePasswordDto: ChangePasswordDto) {
        return this.authService.changePassword(req.user.userId, changePasswordDto, req);
    }

    @Post('forgot-password')
    @Throttle({ default: AUTH_RATE_LIMIT })
    @HttpCode(200)
    @ApiOperation({ summary: 'Self-service password reset: emails a temporary password to the registered email (regular users only)' })
    @ApiResponse({ status: 200, description: 'Temporary password sent' })
    @ApiResponse({ status: 400, description: 'NIK and email do not match an eligible account' })
    async forgotPassword(@Body() dto: ForgotPasswordDto) {
        return this.passwordResetService.forgotPassword(dto);
    }

    /**
     * S2S Single-Truth Credential Verification for SJA Notification Hub
     * Allows SJA Notification Center to authenticate employee NIK/Password against iDesk IdP.
     * Dilindungi S2sAuthGuard (HMAC atau x-s2s-token).
     */
    @Post('s2s/verify-credential')
    @UseGuards(S2sAuthGuard)
    @HttpCode(200)
    @ApiOperation({ summary: 'S2S Credential verification for SJA Notification Center' })
    async verifyCredentialS2S(@Body() body: { identifier?: string; password?: string; nik?: string; username?: string }, @Request() req: any) {
        const idInput = body.identifier || body.nik || body.username || '';
        const passwordInput = body.password || '';

        if (!idInput || !passwordInput) {
            return {
                valid: false,
                message: 'NIK/Email dan Password wajib diisi',
            };
        }

        const result = await this.authService.validateUserWithDetails(idInput, passwordInput, req);
        if (!result.success || !result.user) {
            return {
                valid: false,
                errorCode: result.errorCode || 'INVALID_CREDENTIALS',
                message: 'NIK atau Password salah',
            };
        }

        const SITE_ID_MAP: Record<string, string> = {
            '9f8a5c1e-5865-4382-a8fe-8518c0862c4c': 'SPJ',
            'fc32eaff-0c51-40ee-81a6-33d7d317e0f7': 'KRW',
            '39b888a1-6d13-446b-b91a-89ae9de7c9d0': 'JTB',
            'c2b3027b-5506-44f9-9846-a90592b8b8d7': 'SMG',
        };
        const siteCode = result.user.siteId
            ? (SITE_ID_MAP[result.user.siteId] || 'SPJ')
            : (result.user.email?.toLowerCase().includes('krw') ? 'KRW'
               : result.user.email?.toLowerCase().includes('jtb') ? 'JTB'
               : result.user.email?.toLowerCase().includes('smg') ? 'SMG' : 'SPJ');

        return {
            valid: true,
            user: {
                id: result.user.id,
                email: result.user.email,
                fullName: result.user.fullName,
                employeeId: result.user.employeeId || idInput,
                role: result.user.role,
                departmentId: result.user.departmentId,
                siteId: result.user.siteId,
                siteCode,
            },
        };
    }

    /**
     * S2S Resolve Employee NIK to Internal User Identity (GUID & Profile).
     * Dilindungi S2sAuthGuard (HMAC atau x-s2s-token).
     * Mengembalikan respons non-enumerable generic bila user tidak ditemukan atau non-aktif
     * untuk mencegah enumerasi NIK karyawan.
     */
    @Post('s2s/resolve-nik')
    @UseGuards(S2sAuthGuard)
    @HttpCode(200)
    @ApiOperation({ summary: 'S2S Resolve Employee NIK to User GUID' })
    async resolveNikS2S(@Body() body: { nik?: string }) {
        const nik = (body?.nik || '').trim();
        if (!nik) {
            return { found: false };
        }
        const resolved = await this.authService.resolveNik(nik);
        if (!resolved) {
            return { found: false };
        }
        return {
            found: true,
            user: resolved,
        };
    }

    /**
     * S2S Generate One-Time AutoLogin Ticket for SJA Notifications
     * Protected by S2S internal secret token to prevent unauthorized ticket issuance
     */
    @Post('s2s/issue-sso-ticket')
    @UseGuards(S2sAuthGuard)
    @HttpCode(200)
    async issueSsoTicket(
        @Body() body: { userId?: string; nik?: string; identifier?: string },
        @Request() req: any
    ) {
        const id = body.identifier || body.nik || body.userId || '';
        if (!id) {
            return { success: false, message: 'Identifier wajib diisi' };
        }

        const ticket = await this.authService.issueSsoTicket(id);
        if (!ticket) {
            return { success: false, message: 'User tidak ditemukan atau non-aktif' };
        }

        return {
            success: true,
            ticket,
            expiresInSeconds: 60,
        };
    }

    /**
     * AutoLogin Consumer - Creates auth cookie session from SSO ticket and redirects
     */
    @Get('autologin')
    async autoLogin(@Query('ticket') ticket: string, @Query('redirect') redirect: string, @Request() req: any, @Res() res: Response) {
        if (!ticket) {
            return res.redirect(redirect || '/login');
        }

        try {
            const loginResult = await this.authService.consumeSsoTicket(ticket, req);
            if (!loginResult) {
                return res.redirect('/login?error=sso_ticket_expired');
            }

            const maxAgeMs = this.parseExpiresIn(loginResult.expiresIn);
            const refreshMaxAgeMs = this.parseExpiresIn(loginResult.refreshExpiresIn);

            res.cookie(ACCESS_COOKIE_NAME, loginResult.access_token, withCookieMaxAge(maxAgeMs));
            res.cookie(REFRESH_COOKIE_NAME, loginResult.refresh_token, withCookieMaxAge(refreshMaxAgeMs));
            setCsrfCookie(res);

            const target = redirect && redirect.startsWith('/') ? redirect : '/';
            return res.redirect(target);
        } catch {
            return res.redirect('/login?error=sso_failed');
        }
    }

    @Get('oidc/status')
    @ApiOperation({ summary: 'Whether "Sign in with iPop" is configured (login page shows the button)' })
    getOidcStatus() {
        return { enabled: this.ipopOidc.isEnabled() };
    }

    /**
     * "Sign in with iPop": keeps state, nonce and the PKCE verifier in a signed 5-minute HttpOnly cookie and sends the
     * browser to iPop. A user already signed in to iPop comes straight back without being asked. Not throttled: no
     * password is checked here and the whole office shares one NAT IP.
     */
    @Get('oidc/start')
    @ApiOperation({ summary: 'Start Sign in with iPop (redirects to iPop)' })
    async oidcStart(@Query('returnTo') returnTo: string, @Res() res: Response) {
        if (!this.ipopOidc.isEnabled()) return res.redirect('/login?sso_error=ipop_disabled');
        const secrets = newAuthorizationSecrets();
        try {
            const url = await this.ipopOidc.authorizationUrl(secrets);
            const flow = this.jwtService.sign(
                { typ: 'ipop-oidc', state: secrets.state, nonce: secrets.nonce, verifier: secrets.codeVerifier, returnTo: safeReturnTo(returnTo) },
                { expiresIn: OIDC_COOKIE_TTL_MS / 1000 },
            );
            res.cookie(OIDC_COOKIE_NAME, flow, withCookieMaxAge(OIDC_COOKIE_TTL_MS));
            return res.redirect(url);
        } catch {
            return res.redirect('/login?sso_error=ipop_unavailable');
        }
    }

    @Get('oidc/callback')
    @ApiOperation({ summary: 'Sign in with iPop callback (sets the normal iDesk session cookies)' })
    async oidcCallback(@Query() query: Record<string, string>, @Request() req: any, @Res() res: Response) {
        const fail = (code: string) => res.redirect(`/login?sso_error=${code}`);
        const raw = req.cookies?.[OIDC_COOKIE_NAME];
        res.clearCookie(OIDC_COOKIE_NAME, clearCookieOptions());

        let flow: { typ?: string; state?: string; nonce?: string; verifier?: string; returnTo?: string };
        try {
            flow = this.jwtService.verify(raw || '');
        } catch {
            return fail('ipop_expired');
        }
        if (flow.typ !== 'ipop-oidc' || !flow.state || !flow.nonce || !flow.verifier) return fail('ipop_expired');
        if (query.state !== flow.state) return fail('ipop_expired');
        if (query.error) return fail(query.error === 'access_denied' ? 'ipop_denied' : 'ipop_failed');
        if (!query.code) return fail('ipop_failed');

        try {
            const identity = await this.ipopOidc.exchangeCode(query.code, flow.verifier, flow.nonce);
            const link = await this.ipopLinker.resolve(identity, req);
            if (!link.ok) return fail(link.reason === 'ACCOUNT_DISABLED' ? 'account_disabled' : 'ipop_not_linked');

            // iPop checked the password, so iDesk's "must change your iDesk password" step does not apply here.
            const loginResult = await this.authService.login({ ...link.user, mustChangePassword: false }, req, true);
            res.cookie(ACCESS_COOKIE_NAME, loginResult.access_token, withCookieMaxAge(this.parseExpiresIn(loginResult.expiresIn)));
            res.cookie(REFRESH_COOKIE_NAME, loginResult.refresh_token, withCookieMaxAge(this.parseExpiresIn(loginResult.refreshExpiresIn)));
            setCsrfCookie(res);
            return res.redirect(safeReturnTo(flow.returnTo));
        } catch (error) {
            return fail(error instanceof IpopGrantRejectedError ? 'ipop_failed' : 'ipop_unavailable');
        }
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
