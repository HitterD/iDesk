import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Param,
    Request,
    UseGuards,
    Query,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationCategory } from './entities/notification.entity';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
    constructor(private readonly notificationService: NotificationService) {}

    @Get()
    @ApiOperation({ summary: 'Get all notifications for current user' })
    @ApiQuery({ name: 'category', enum: NotificationCategory, required: false })
    @ApiQuery({ name: 'isRead', type: Boolean, required: false })
    @ApiQuery({ name: 'limit', type: Number, required: false })
    @ApiResponse({ status: 200, description: 'Return notifications.' })
    async findAll(
        @Request() req,
        @Query('category') category?: NotificationCategory,
        @Query('isRead') isRead?: string,
        @Query('limit') limit?: number,
    ) {
        return this.notificationService.findAllForUser(req.user.userId, {
            category,
            isRead: isRead !== undefined ? isRead === 'true' : undefined,
            limit: limit ? parseInt(limit.toString()) : 50,
        });
    }

    @Get('unread')
    @ApiOperation({ summary: 'Get unread notifications' })
    @ApiResponse({ status: 200, description: 'Return unread notifications.' })
    async findUnread(@Request() req) {
        return this.notificationService.findUnreadForUser(req.user.userId);
    }

    @Get('count')
    @ApiOperation({ summary: 'Get unread notification count' })
    @ApiResponse({ status: 200, description: 'Return unread count.' })
    async countUnread(@Request() req) {
        const count = await this.notificationService.countUnread(req.user.userId);
        return { count };
    }

    @Get('count/by-category')
    @ApiOperation({ summary: 'Get unread notification count grouped by category' })
    @ApiResponse({ status: 200, description: 'Return unread counts by category.' })
    async countUnreadByCategory(@Request() req) {
        const counts = await this.notificationService.countUnreadByCategory(req.user.userId);
        return counts;
    }

    @Patch(':id/read')
    @ApiOperation({ summary: 'Mark notification as read' })
    @ApiResponse({ status: 200, description: 'Notification marked as read.' })
    async markAsRead(@Param('id') id: string, @Request() req) {
        return this.notificationService.markAsRead(id, req.user.userId);
    }

    @Post('read-all')
    @ApiOperation({ summary: 'Mark all notifications as read' })
    @ApiResponse({ status: 200, description: 'All notifications marked as read.' })
    async markAllAsRead(@Request() req) {
        await this.notificationService.markAllAsRead(req.user.userId);
        return { success: true };
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete a notification' })
    @ApiResponse({ status: 200, description: 'Notification deleted.' })
    async delete(@Param('id') id: string, @Request() req) {
        await this.notificationService.delete(id, req.user.userId);
        return { success: true };
    }

    @Delete()
    @ApiOperation({ summary: 'Delete all notifications' })
    @ApiResponse({ status: 200, description: 'All notifications deleted.' })
    async deleteAll(@Request() req) {
        await this.notificationService.deleteAllForUser(req.user.userId);
        return { success: true };
    }
}
