import { Controller, Get, Param, ParseUUIDPipe, Query, Request, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { TicketMentionService } from '../services/ticket-mention.service';

/** The @mention picker of a ticket's chat. */
@ApiTags('Tickets')
@Controller('tickets/:id/mention-candidates')
@UseGuards(JwtAuthGuard)
export class TicketMentionsController {
    constructor(private readonly mentions: TicketMentionService) { }

    @Get()
    @ApiOperation({ summary: 'People the caller may @mention on this ticket' })
    @ApiResponse({ status: 200, description: 'Id, name and avatar of each candidate.' })
    async candidates(@Param('id', ParseUUIDPipe) id: string, @Request() req: any, @Query('search') search?: string) {
        const viewer = { id: req.user.userId || req.user.id, role: req.user.role, siteId: req.user.siteId ?? null };
        return this.mentions.candidates(id, viewer, (search ?? '').slice(0, 60));
    }
}
