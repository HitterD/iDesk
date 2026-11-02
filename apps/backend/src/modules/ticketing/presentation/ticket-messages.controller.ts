import { Body, Controller, Delete, Param, ParseUUIDPipe, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { TicketMessageEditService } from '../services/ticket-message-edit.service';
import { TicketMessagePinService } from '../services/ticket-message-pin.service';
import { EditMessageDto } from '../dto/edit-message.dto';

/** Edit (sender, 15 min), delete (sender, or admin) and pin (any participant) of a ticket chat message. */
@ApiTags('Tickets')
@Controller('tickets/:id/messages/:messageId')
@UseGuards(JwtAuthGuard)
export class TicketMessagesController {
    constructor(
        private readonly editService: TicketMessageEditService,
        private readonly pinService: TicketMessagePinService,
    ) { }

    @Post('pin')
    @ApiOperation({ summary: 'Pin a chat message (at most three per ticket)' })
    @ApiResponse({ status: 201, description: 'The ticket pins after the change.' })
    async pin(
        @Param('id', ParseUUIDPipe) id: string,
        @Param('messageId', ParseUUIDPipe) messageId: string,
        @Request() req: any,
    ) {
        return this.pinService.pin(id, messageId, this.viewer(req));
    }

    @Delete('pin')
    @ApiOperation({ summary: 'Release a pinned chat message' })
    @ApiResponse({ status: 200, description: 'The ticket pins after the change.' })
    async unpin(
        @Param('id', ParseUUIDPipe) id: string,
        @Param('messageId', ParseUUIDPipe) messageId: string,
        @Request() req: any,
    ) {
        return this.pinService.unpin(id, messageId, this.viewer(req));
    }

    @Patch()
    @ApiOperation({ summary: 'Edit a chat message' })
    @ApiResponse({ status: 200, description: 'The edited message.' })
    async edit(
        @Param('id', ParseUUIDPipe) id: string,
        @Param('messageId', ParseUUIDPipe) messageId: string,
        @Body() dto: EditMessageDto,
        @Request() req: any,
    ) {
        return this.editService.editMessage(id, messageId, this.viewer(req), dto.content);
    }

    @Delete()
    @ApiOperation({ summary: 'Delete a chat message for everyone' })
    @ApiResponse({ status: 200, description: 'The message, now shown as deleted.' })
    async remove(
        @Param('id', ParseUUIDPipe) id: string,
        @Param('messageId', ParseUUIDPipe) messageId: string,
        @Request() req: any,
    ) {
        return this.editService.deleteMessage(id, messageId, this.viewer(req));
    }

    private viewer(req: any) {
        return { id: req.user.userId || req.user.id, role: req.user.role, siteId: req.user.siteId ?? null };
    }
}
