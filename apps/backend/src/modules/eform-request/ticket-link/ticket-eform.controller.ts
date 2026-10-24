import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { ProposeEFormFromTicketDto } from './propose-eform.dto';
import { TicketEFormService } from './ticket-eform.service';

/**
 * E-form access raised from an IT support ticket. The requester completes a proposal with the regular
 * `POST /eform-request` (passing `draftId`), or declines it with `cancel-proposal`. Role and ticket checks live in
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

    @Post('tickets/:ticketId/eform-requests')
    async propose(@Req() req: any, @Param('ticketId', new ParseUUIDPipe()) ticketId: string, @Body() dto: ProposeEFormFromTicketDto) {
        return { success: true, data: await this.service.propose(req.user.userId, ticketId, dto) };
    }

    @Post('eform-request/:id/cancel-proposal')
    async cancelProposal(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
        return { success: true, data: await this.service.cancelProposal(req.user.userId, id) };
    }
}
