import { Controller, Post, Get, Delete, UseGuards, Req, Body, Patch, Res, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiExcludeEndpoint } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { TelegramService } from './telegram.service';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf, Context } from 'telegraf';
import { Response } from 'express';

@ApiTags('Telegram')
@Controller('telegram')
export class TelegramController {
    constructor(
        private readonly telegramService: TelegramService,
        @InjectBot() private readonly bot: Telegraf<Context>,
    ) {}

    @Post('generate-link-code')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Generate a code to link Telegram account' })
    @ApiResponse({ status: 200, description: 'Link code generated' })
    async generateLinkCode(@Req() req) {
        const code = await this.telegramService.generateLinkCode(req.user.userId);
        return {
            code,
            expiresIn: 300, // 5 minutes
            instruction: 'Kirim kode ini ke bot Telegram @idesk_support_bot',
        };
    }

    @Get('status')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Get Telegram link status' })
    @ApiResponse({ status: 200, description: 'Link status' })
    async getStatus(@Req() req) {
        return this.telegramService.getLinkedStatus(req.user.userId);
    }

    @Delete('unlink')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Unlink Telegram account' })
    @ApiResponse({ status: 200, description: 'Account unlinked' })
    async unlink(@Req() req) {
        // Get user's telegramId first
        const status = await this.telegramService.getLinkedStatus(req.user.userId);
        if (!status.linked) {
            return { success: false, message: 'Akun tidak terhubung dengan Telegram' };
        }

        // Find the session by userId to get telegramId
        // This is a workaround since we don't store telegramId directly accessible
        return { success: true, message: 'Untuk unlink, silakan gunakan /unlink di bot Telegram' };
    }

    @Patch('notifications')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Toggle Telegram notifications' })
    @ApiResponse({ status: 200, description: 'Notification settings updated' })
    async toggleNotifications(@Req() req, @Body('enabled') enabled: boolean) {
        // This would update the user's telegramNotifications setting
        // For now, return the current status
        return { 
            enabled,
            message: enabled ? 'Notifikasi Telegram diaktifkan' : 'Notifikasi Telegram dinonaktifkan'
        };
    }

    /**
     * Webhook endpoint for Telegram updates (Production mode)
     * This endpoint receives updates from Telegram when using webhook mode
     * 
     * Configure with env vars:
     * - TELEGRAM_USE_WEBHOOK=true
     * - TELEGRAM_WEBHOOK_DOMAIN=https://api.yourapp.com
     */
    @Post('webhook')
    @HttpCode(200)
    @ApiExcludeEndpoint() // Hide from Swagger
    async handleWebhook(@Body() update: any, @Res() res: Response) {
        try {
            // Process the update through Telegraf
            await this.bot.handleUpdate(update);
            res.status(200).send('OK');
        } catch (error) {
            console.error('Webhook error:', error);
            res.status(200).send('OK'); // Always return 200 to prevent Telegram retries
        }
    }
}
