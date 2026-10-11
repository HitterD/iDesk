import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { IpopAuthGuard } from './ipop-auth.guard';
import { IpopCatalogService, IpopModuleInfo } from './ipop-catalog.service';
import { IpopMessagesView, IpopTicketService, IpopTicketView } from './ipop-ticket.service';
import { IpopCreateTicketDto, IpopTicketQueryDto } from './dto/ipop-ticket.dto';
import { IpopZoomBookingService, IpopZoomBookingView } from './ipop-zoom-booking.service';
import { IpopZoomBookingQueryDto } from './dto/ipop-zoom-booking.dto';
import { IPOP_HEADERS } from './ipop-signature';

/** Per iPop client: generous for a server, tight enough to stop a runaway loop. */
const IPOP_RATE_LIMIT = { limit: 120, ttl: 60_000 };

/**
 * Server-to-server API for the iPop app (ipop.santos.co.id): create tickets in the
 * queue the user picked and read their progress and public chat. Replying stays in iDesk.
 * Zoom bookings are exposed read-only so iPop can fill its users' calendars.
 * See docs/integrations/ipop-api.md.
 */
@ApiTags('Integrations: iPop')
@ApiHeader({ name: IPOP_HEADERS.clientId, required: true })
@ApiHeader({ name: IPOP_HEADERS.timestamp, required: true, description: 'Unix epoch milliseconds' })
@ApiHeader({ name: IPOP_HEADERS.signature, required: true, description: 'hex HMAC-SHA256 of `${timestamp}.${rawBody}`' })
@Controller('integrations/ipop')
@UseGuards(IpopAuthGuard)
@Throttle({ default: IPOP_RATE_LIMIT })
export class IpopController {
    constructor(
        private readonly catalog: IpopCatalogService,
        private readonly tickets: IpopTicketService,
        private readonly zoomBookings: IpopZoomBookingService,
    ) {}

    @Get('modules')
    @ApiOperation({ summary: 'Ticket modules iPop can file into, with categories and priorities' })
    listModules(): Promise<IpopModuleInfo[]> {
        return this.catalog.listModules();
    }

    @Post('tickets')
    @HttpCode(201)
    @ApiOperation({ summary: 'Create a ticket (idempotent on externalRef)' })
    @ApiResponse({ status: 201, description: 'Created' })
    @ApiResponse({ status: 200, description: 'Already created for this externalRef; returns that ticket' })
    @ApiResponse({ status: 422, description: 'Requester not registered/active in iDesk' })
    async create(@Body() dto: IpopCreateTicketDto, @Res({ passthrough: true }) res: Response): Promise<IpopTicketView> {
        const result = await this.tickets.create(dto);
        if (!result.created) res.status(200);
        return result.ticket;
    }

    @Get('tickets')
    @ApiOperation({ summary: 'Find iPop tickets by externalRef or requester NIK' })
    find(@Query() query: IpopTicketQueryDto): Promise<IpopTicketView[]> {
        return this.tickets.find(query);
    }

    @Get('tickets/:ticketNumber')
    @ApiOperation({ summary: 'Progress of one iPop ticket' })
    get(@Param('ticketNumber') ticketNumber: string): Promise<IpopTicketView> {
        return this.tickets.getByNumber(ticketNumber);
    }

    @Get('tickets/:ticketNumber/messages')
    @ApiOperation({ summary: 'Public chat of a ticket as plain text (no internal notes), read-only' })
    getMessages(@Param('ticketNumber') ticketNumber: string): Promise<IpopMessagesView> {
        return this.tickets.getMessages(ticketNumber);
    }

    @Get('zoom-bookings')
    @ApiOperation({ summary: 'Zoom meetings of a user (booked or invited) in a date range, for the iPop calendar' })
    findZoomBookings(@Query() query: IpopZoomBookingQueryDto): Promise<IpopZoomBookingView[]> {
        return this.zoomBookings.find(query);
    }

    @Get('zoom-bookings/:id')
    @ApiOperation({ summary: 'One Zoom booking as a calendar entry' })
    getZoomBooking(@Param('id', ParseUUIDPipe) id: string): Promise<IpopZoomBookingView> {
        return this.zoomBookings.getById(id);
    }
}
