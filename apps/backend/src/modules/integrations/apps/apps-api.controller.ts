import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { IpopCatalogService, IpopModuleInfo } from '../ipop/ipop-catalog.service';
import { IpopMessagesView, IpopTicketService, IpopTicketView } from '../ipop/ipop-ticket.service';
import { IpopCreateTicketDto, IpopReplyDto, IpopTicketQueryDto } from '../ipop/dto/ipop-ticket.dto';
import { AppAuthGuard, AppRequest, RequireAppPermission } from './app-auth.guard';
import { APP_HEADERS, APP_PERMISSIONS } from './integration-app.constants';
import { scopeOf } from './app-scope';

/** Per app: generous for a server, tight enough to stop a runaway loop. */
const APP_RATE_LIMIT = { limit: 120, ttl: 60_000 };

/**
 * Server-to-server ticket API for connected office apps (EBBK, ...), registered in Settings > Integrasi aplikasi.
 * Same contract as the iPop API, scoped per app. See docs/integrations/aplikasi-terhubung-api.md.
 */
@ApiTags('Integrations: connected apps')
@ApiHeader({ name: APP_HEADERS.clientId, required: true })
@ApiHeader({ name: APP_HEADERS.timestamp, required: true, description: 'Unix epoch milliseconds' })
@ApiHeader({ name: APP_HEADERS.signature, required: true, description: 'hex HMAC-SHA256 of `${timestamp}.${rawBody}`' })
@Controller('integrations/apps')
@UseGuards(AppAuthGuard)
@Throttle({ default: APP_RATE_LIMIT })
export class AppsApiController {
    constructor(private readonly catalog: IpopCatalogService, private readonly tickets: IpopTicketService) {}

    @Get('me')
    @ApiOperation({ summary: 'Who iDesk thinks you are: use it to test signing; lists your modules and permissions' })
    me(@Req() req: AppRequest) {
        const { clientId, name, modules, permissions, webhookUrl } = req.integrationApp;
        return { clientId, name, modules, permissions, webhook: Boolean(webhookUrl) };
    }

    @Get('modules')
    @RequireAppPermission(APP_PERMISSIONS.TICKETS_CREATE)
    @ApiOperation({ summary: 'Modules this app may file into, with categories and priorities' })
    async listModules(@Req() req: AppRequest): Promise<IpopModuleInfo[]> {
        const allowed = req.integrationApp.modules;
        return (await this.catalog.listModules()).filter((m) => allowed.includes(m.slug));
    }

    @Post('tickets')
    @HttpCode(201)
    @RequireAppPermission(APP_PERMISSIONS.TICKETS_CREATE)
    @ApiOperation({ summary: 'Create a ticket (idempotent on externalRef)' })
    @ApiResponse({ status: 200, description: 'Already created for this externalRef; returns that ticket' })
    @ApiResponse({ status: 403, description: 'Module not allowed for this app' })
    @ApiResponse({ status: 422, description: 'Requester or submitter not registered/active in iDesk' })
    async create(@Req() req: AppRequest, @Body() dto: IpopCreateTicketDto, @Res({ passthrough: true }) res: Response): Promise<IpopTicketView> {
        const result = await this.tickets.create(dto, scopeOf(req.integrationApp));
        if (!result.created) res.status(200);
        return result.ticket;
    }

    @Get('tickets')
    @RequireAppPermission(APP_PERMISSIONS.TICKETS_READ)
    @ApiOperation({ summary: "This app's tickets by externalRef or requester NIK" })
    find(@Req() req: AppRequest, @Query() query: IpopTicketQueryDto): Promise<IpopTicketView[]> {
        return this.tickets.find(query, scopeOf(req.integrationApp));
    }

    @Get('tickets/:ticketNumber')
    @RequireAppPermission(APP_PERMISSIONS.TICKETS_READ)
    @ApiOperation({ summary: 'Progress of one ticket filed by this app' })
    get(@Req() req: AppRequest, @Param('ticketNumber') ticketNumber: string): Promise<IpopTicketView> {
        return this.tickets.getByNumber(ticketNumber, scopeOf(req.integrationApp));
    }

    @Get('tickets/:ticketNumber/messages')
    @RequireAppPermission(APP_PERMISSIONS.MESSAGES_READ)
    @ApiOperation({ summary: 'Public chat of the ticket as plain text (no internal notes)' })
    getMessages(@Req() req: AppRequest, @Param('ticketNumber') ticketNumber: string): Promise<IpopMessagesView> {
        return this.tickets.getMessages(ticketNumber, scopeOf(req.integrationApp));
    }

    @Post('tickets/:ref/messages')
    @HttpCode(201)
    @RequireAppPermission(APP_PERMISSIONS.MESSAGES_WRITE)
    @ApiOperation({ summary: 'Reply to the public chat as the person with this NIK (requester side or assigned agent)' })
    reply(@Req() req: AppRequest, @Param('ref') ref: string, @Body() dto: IpopReplyDto): Promise<{ id: string; createdAt: string }> {
        return this.tickets.reply(ref, dto, scopeOf(req.integrationApp));
    }
}
