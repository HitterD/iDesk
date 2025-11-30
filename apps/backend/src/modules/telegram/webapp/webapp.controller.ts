import { Controller, Post, Body, UseGuards, Logger, Get, Headers, UnauthorizedException } from '@nestjs/common';
import { WebAppService } from './webapp.service';
import { WebAppTicketDto, WebAppTicketResponseDto } from '../dto/webapp-ticket.dto';
import { TelegramWebAppGuard } from '../middleware/auth.middleware';

/**
 * Web App Controller for Telegram Mini App (17.4.2)
 */
@Controller('telegram/webapp')
export class WebAppController {
    private readonly logger = new Logger(WebAppController.name);

    constructor(private readonly webAppService: WebAppService) {}

    /**
     * Create ticket from Telegram Web App
     */
    @Post('ticket')
    async createTicket(
        @Body() dto: WebAppTicketDto,
        @Headers('x-telegram-init-data') initDataHeader?: string,
    ): Promise<WebAppTicketResponseDto> {
        // Use init data from body or header
        const initData = dto.initData || initDataHeader;
        if (!initData) {
            throw new UnauthorizedException('Missing Telegram init data');
        }

        // Validate and get user
        if (!this.webAppService.validateWebAppData(initData)) {
            throw new UnauthorizedException('Invalid Telegram Web App data');
        }

        const webAppUser = this.webAppService.parseUserFromInitData(initData);
        if (!webAppUser) {
            throw new UnauthorizedException('Could not parse user data');
        }

        this.logger.log(`Web App ticket creation request from user ${webAppUser.telegramId}`);

        return this.webAppService.createTicketFromWebApp(dto, webAppUser);
    }

    /**
     * Get user's tickets for Web App
     */
    @Get('tickets')
    async getTickets(
        @Headers('x-telegram-init-data') initData: string,
    ) {
        if (!initData || !this.webAppService.validateWebAppData(initData)) {
            throw new UnauthorizedException('Invalid Telegram Web App data');
        }

        const webAppUser = this.webAppService.parseUserFromInitData(initData);
        if (!webAppUser) {
            throw new UnauthorizedException('Could not parse user data');
        }

        // This would return user's tickets - implement as needed
        return { success: true, tickets: [] };
    }

    /**
     * Health check for Web App
     */
    @Get('health')
    async health() {
        return { status: 'ok', timestamp: new Date().toISOString() };
    }
}
