import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { isFreshIpopTimestamp, isValidIpopSignature } from '../ipop/ipop-signature';
import { APP_HEADERS, type AppPermission } from './integration-app.constants';
import { IntegrationAppsService } from './integration-apps.service';
import type { IntegrationApp } from './entities/integration-app.entity';

const PERMISSION_KEY = 'integration-app-permission';

/** The feature a route needs; the calling app must have it ticked in Settings > Integrasi aplikasi. */
export const RequireAppPermission = (permission: AppPermission) => SetMetadata(PERMISSION_KEY, permission);

/** Request after AppAuthGuard: the authenticated app. */
export type AppRequest = Request & { rawBody?: Buffer; integrationApp: IntegrationApp };

/**
 * Authenticates a connected app: its client id + HMAC-SHA256 over `${timestamp}.${rawBody}` with that app's own
 * secret (same scheme as iPop), then checks the route's permission against what the admin granted the app.
 */
@Injectable()
export class AppAuthGuard implements CanActivate {
    private readonly logger = new Logger(AppAuthGuard.name);

    constructor(private readonly apps: IntegrationAppsService, private readonly reflector: Reflector) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const req = context.switchToHttp().getRequest<AppRequest>();
        const header = (name: string) => {
            const value = req.headers[name];
            return typeof value === 'string' ? value.trim() : '';
        };
        const clientId = header(APP_HEADERS.clientId);
        const timestamp = header(APP_HEADERS.timestamp);
        const signature = header(APP_HEADERS.signature);
        if (!clientId || !timestamp || !signature) throw new UnauthorizedException('Missing iDesk authentication headers');

        const resolved = await this.apps.resolveActive(clientId);
        if (!resolved) throw new UnauthorizedException('Unknown or disabled app');
        if (!isFreshIpopTimestamp(timestamp)) throw new UnauthorizedException('Request timestamp is outside the allowed window (5 minutes)');
        if (!isValidIpopSignature(resolved.secret, timestamp, req.rawBody ?? Buffer.alloc(0), signature)) {
            this.logger.warn(`Rejected ${clientId} request with a bad signature: ${req.method} ${req.originalUrl}`);
            throw new UnauthorizedException('Invalid signature');
        }

        const needed = this.reflector.getAllAndOverride<AppPermission | undefined>(PERMISSION_KEY, [context.getHandler(), context.getClass()]);
        if (needed && !resolved.app.permissions.includes(needed)) {
            throw new ForbiddenException(`This app does not have the "${needed}" permission`);
        }
        req.integrationApp = resolved.app;
        void this.apps.touch(resolved.app).catch(() => undefined);
        return true;
    }
}
