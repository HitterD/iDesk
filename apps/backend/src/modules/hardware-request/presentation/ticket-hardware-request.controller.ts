import { Controller, Get, Param, ParseUUIDPipe, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { HardwareRoleGuard } from '../guards/hardware-role.guard';
import { TicketHardwareRequestService } from '../services/ticket-hardware-request.service';

/**
 * Hardware requests once proposed from an IT support ticket (read only now: proposing is gone, IT files a request ticket
 * for the requester). A proposal still waiting is answered with the regular `/hardware-requests/:id/submit` or `/cancel`.
 */
@Controller('tickets/:ticketId/hardware-requests')
@UseGuards(JwtAuthGuard, HardwareRoleGuard)
export class TicketHardwareRequestController {
    constructor(private readonly service: TicketHardwareRequestService) {}

    @Get()
    async list(@Req() req: any, @Param('ticketId', new ParseUUIDPipe()) ticketId: string) {
        return { success: true, data: await this.service.listForTicket(req.user.userId, ticketId) };
    }
}
