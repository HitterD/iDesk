import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { HardwareRoleGuard } from '../guards/hardware-role.guard';
import { HardwareRoles } from '../guards/roles.decorator';
import { HardwareRole } from '../domain/enums/hardware-role.enum';
import { ProposeFromTicketDto } from '../dto/propose-from-ticket.dto';
import { TicketHardwareRequestService } from '../services/ticket-hardware-request.service';

/**
 * Hardware requests raised from an IT support ticket. The requester answers a proposal with the regular
 * `POST /hardware-requests/:id/submit` (accept) or `/cancel` (decline).
 */
@Controller('tickets/:ticketId/hardware-requests')
@UseGuards(JwtAuthGuard, HardwareRoleGuard)
export class TicketHardwareRequestController {
    constructor(private readonly service: TicketHardwareRequestService) {}

    @Get()
    async list(@Req() req: any, @Param('ticketId', new ParseUUIDPipe()) ticketId: string) {
        return { success: true, data: await this.service.listForTicket(req.user.userId, ticketId) };
    }

    @Post()
    @HardwareRoles(HardwareRole.ICT_STAFF)
    async propose(@Req() req: any, @Param('ticketId', new ParseUUIDPipe()) ticketId: string, @Body() dto: ProposeFromTicketDto) {
        return { success: true, data: await this.service.propose(req.user.userId, ticketId, dto) };
    }
}
