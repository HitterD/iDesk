import { Controller, Post, Body } from '@nestjs/common';
import { TicketService } from '../ticket.service';

@Controller('telegram')
export class TelegramController {
    constructor(private ticketService: TicketService) { }

    @Post('webhook')
    async handleWebhook(@Body() payload: any) {
        await this.ticketService.handleTelegramWebhook(payload);
        return { status: 'ok' };
    }
}
