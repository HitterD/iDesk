import { Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { TicketEFormService } from './ticket-eform.service';

/**
 * E-form access once proposed from an IT support ticket. Proposing is gone (IT files a request ticket for the requester
 * instead); a proposal that is still waiting can be listed and declined or withdrawn with `cancel-proposal`. Role and ticket checks live in
 * the service, which knows the ticket.
 */
@Controller()
@UseGuards(JwtAuthGuard)
export class TicketEFormController {
    constructor(private readonly service: TicketEFormService) {}

    @Get('tickets/:ticketId/eform-requests')
    async list(@Req() req: any, @Param('ticketId', new ParseUUIDPipe()) ticketId: string) {
        return { success: true, data: await this.service.listForTicket(req.user.userId, ticketId) };
    }

    @Post('eform-request/:id/cancel-proposal')
    async cancelProposal(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
        return { success: true, data: await this.service.cancelProposal(req.user.userId, id) };
    }
}
