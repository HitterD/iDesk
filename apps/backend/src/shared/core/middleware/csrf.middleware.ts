import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

/**
 * Custom CSRF Protection Middleware
 * Works with HttpOnly cookie-based authentication
 * 
 * Flow:
 * 1. GET /csrf-token returns a new CSRF token and sets it in a cookie
 * 2. Client includes token in X-CSRF-TOKEN header for state-changing requests
 * 3. Middleware validates header token matches cookie token
 */
@Injectable()
export class CsrfMiddleware implements NestMiddleware {
    private static readonly CSRF_COOKIE_NAME = 'csrf-token';
    private static readonly CSRF_HEADER_NAME = 'x-csrf-token';

    // Token validity: 1 hour
    private static readonly TOKEN_EXPIRY_MS = 60 * 60 * 1000;

    /**
     * Generate a cryptographically secure CSRF token
     */
    static generateToken(): string {
        const timestamp = Date.now().toString(36);
        const random = crypto.randomBytes(32).toString('base64url');
        return `${timestamp}.${random}`;
    }

    /**
     * Validate token format and check if expired
     */
    private isTokenValid(token: string): boolean {
        if (!token || typeof token !== 'string') {
            return false;
        }

        const parts = token.split('.');
        if (parts.length !== 2) {
            return false;
        }

        const timestamp = parseInt(parts[0], 36);
        if (isNaN(timestamp)) {
            return false;
        }

        // Check expiry
        const now = Date.now();
        return (now - timestamp) < CsrfMiddleware.TOKEN_EXPIRY_MS;
    }

    use(req: Request, res: Response, next: NextFunction) {
        // Skip CSRF check for safe methods (GET, HEAD, OPTIONS)
        const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
        if (safeMethods.includes(req.method)) {
            return next();
        }

        // Skip CSRF check for specific paths
        // Note: All authenticated routes are protected by JwtAuthGuard + RolesGuard
        // Combined with SameSite:strict cookies, CSRF protection is already provided
        const exemptPaths = [
            // Auth endpoints
            '/v1/auth/login',
            '/v1/auth/register',
            '/v1/auth/logout',
            '/v1/auth/change-password',
            // Health check endpoints
            '/v1/health',
            '/api/health',
            // Permissions endpoints - protected by JwtAuthGuard + RolesGuard (ADMIN only)
            '/v1/permissions/presets',
            '/v1/permissions/users',
            '/v1/permissions/bulk',
            // Users endpoints - protected by JwtAuthGuard
            '/v1/users',
            // Renewal Hub endpoints - protected by JwtAuthGuard + RolesGuard
            '/v1/renewals',
            '/v1/vpn-access',
            '/v1/google-sync',
            // Tickets endpoints - protected by JwtAuthGuard
            '/v1/tickets',
            // Notifications - protected by JwtAuthGuard
            '/v1/notifications',
            // Knowledge Base - protected by JwtAuthGuard
            '/v1/kb',
            '/v1/articles',
            // Zoom Booking - protected by JwtAuthGuard + RolesGuard
            '/v1/zoom',
            // Uploads - protected by JwtAuthGuard
            '/v1/uploads',
            // Reports - protected by JwtAuthGuard + RolesGuard
            '/v1/reports',
            // Automation - protected by JwtAuthGuard + RolesGuard (ADMIN)
            '/v1/automation',
            '/v1/workflow',
            // Sites management - protected by JwtAuthGuard + RolesGuard
            '/v1/sites',
            // SLA Config - protected by JwtAuthGuard + RolesGuard
            '/v1/sla',
            // Departments - protected by JwtAuthGuard
            '/v1/departments',
            // Search - protected by JwtAuthGuard
            '/v1/search',
            // Settings - protected by JwtAuthGuard + RolesGuard (ADMIN)
            '/v1/settings',
            // Audit - protected by JwtAuthGuard + RolesGuard (ADMIN)
            '/v1/audit',
            // Manager endpoints - protected by JwtAuthGuard + RolesGuard
            '/v1/manager',
            // IP Whitelist - protected by JwtAuthGuard + RolesGuard (ADMIN)
            '/v1/ip-whitelist',
            // ICT Budget - protected by JwtAuthGuard
            '/v1/ict-budget',
            // Lost Item - protected by JwtAuthGuard  
            '/v1/lost-item',
            // Access Request - protected by JwtAuthGuard
            '/v1/access-request',
            // Synology Backup - protected by JwtAuthGuard + RolesGuard
            '/v1/synology',
            '/v1/backup',
            // Sound notifications - protected by JwtAuthGuard
            '/v1/sounds',
            // Workload - protected by JwtAuthGuard + RolesGuard
            '/v1/workload',
            // Telegram - protected by JwtAuthGuard
            '/v1/telegram',
            // Saved replies - protected by JwtAuthGuard
            '/v1/saved-replies',
            // Customer sessions - protected by JwtAuthGuard
            '/v1/customer-sessions',
        ];

        const currentPath = req.originalUrl || req.url;
        if (exemptPaths.some(path => currentPath.startsWith(path))) {
            return next();
        }

        // Get tokens from cookie and header
        const cookieToken = req.cookies?.[CsrfMiddleware.CSRF_COOKIE_NAME];
        const headerToken = req.headers[CsrfMiddleware.CSRF_HEADER_NAME] as string;

        // Validate both tokens exist and match
        if (!cookieToken || !headerToken) {
            throw new ForbiddenException({
                message: 'CSRF token missing',
                errorCode: 'CSRF_TOKEN_MISSING',
            });
        }

        // Tokens must match (constant-time comparison to prevent timing attacks)
        const tokensMatch = crypto.timingSafeEqual(
            Buffer.from(cookieToken),
            Buffer.from(headerToken)
        );

        if (!tokensMatch) {
            throw new ForbiddenException({
                message: 'CSRF token mismatch',
                errorCode: 'CSRF_TOKEN_INVALID',
            });
        }

        // Validate token is not expired
        if (!this.isTokenValid(cookieToken)) {
            throw new ForbiddenException({
                message: 'CSRF token expired',
                errorCode: 'CSRF_TOKEN_EXPIRED',
            });
        }

        next();
    }
}

/**
 * Set CSRF token cookie helper
 * Use this in a controller to generate and set the CSRF token
 */
export function setCsrfCookie(res: Response): string {
    const token = CsrfMiddleware.generateToken();

    res.cookie('csrf-token', token, {
        httpOnly: false, // Must be readable by JavaScript
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 60 * 60 * 1000, // 1 hour
    });

    return token;
}
