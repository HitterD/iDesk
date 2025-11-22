import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { TicketService } from '../ticket.service';

@Controller('webhook')
export class WebhookController {
    constructor(private readonly ticketService: TicketService) { }

    @Post('telegram')
    @HttpCode(HttpStatus.OK)
    async handleTelegramWebhook(@Body() payload: any) {
        try {
            await this.ticketService.handleTelegramWebhook(payload);
            return { status: 'ok' };
        } catch (error) {
            console.error('Error handling webhook:', error);
            // Return OK to prevent Telegram from retrying indefinitely on logic errors
            return { status: 'error', message: error.message };
        }
    }
}
