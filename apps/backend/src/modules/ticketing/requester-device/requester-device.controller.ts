import { Body, Controller, ForbiddenException, Get, HttpCode, Param, ParseUUIDPipe, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { extractClientIp } from '../../../shared/security/client-ip';
import { TicketQueryService } from '../services/ticket-query.service';
import { RequesterDeviceService } from './requester-device.service';
import { DeviceHeartbeatDto } from './device-heartbeat.dto';

/** Heartbeats should come every few minutes; this only stops a misbehaving client. */
const HEARTBEAT_LIMIT_PER_MINUTE = 6;
const MINUTE_MS = 60_000;

@ApiTags('Requester Device')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard)
export class RequesterDeviceController {
    constructor(
        private readonly devices: RequesterDeviceService,
        private readonly ticketQuery: TicketQueryService,
    ) { }

    @Post('devices/heartbeat')
    @HttpCode(200)
    @Throttle({ default: { limit: HEARTBEAT_LIMIT_PER_MINUTE, ttl: MINUTE_MS } })
    @ApiOperation({ summary: 'Desktop app: report the computer the signed-in user is on' })
    @ApiResponse({ status: 200, description: '{ ok: true }' })
    heartbeat(@Request() req: any, @Body() dto: DeviceHeartbeatDto) {
        const ip = extractClientIp(req);
        return this.devices.recordHeartbeat(req.user.userId, dto, ip === 'unknown' ? null : ip);
    }

    /** Ticket handlers only: requesters, participants and other teams never see where a ticket came from. */
    @Get('tickets/:id/requester-device')
    @ApiOperation({ summary: "Requester's IP and computer when the ticket was created (agents/admin)" })
    async forTicket(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
        const viewer = { id: req.user.userId, role: req.user.role, siteId: req.user.siteId ?? null };
        const access = await this.ticketQuery.assertCanView(id, viewer);
        if (access !== 'handler') throw new ForbiddenException('Hanya tim IT/admin yang dapat melihat perangkat pemohon');
        return this.devices.forTicket(id);
    }

}
