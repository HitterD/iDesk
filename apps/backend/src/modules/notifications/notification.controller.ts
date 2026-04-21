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
    Body,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationCategory } from './entities/notification.entity';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { PageAccessGuard } from '../../shared/core/guards/page-access.guard';
import { PageAccess } from '../../shared/core/decorators/page-access.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard, PageAccessGuard)
@PageAccess('notifications')
export class NotificationController {
    constructor(private readonly notificationService: NotificationService) { }

    @Get()
    @ApiOperation({ summary: 'Get all notifications for current user' })
    @ApiQuery({ name: 'category', enum: NotificationCategory, required: false })
    @ApiQuery({ name: 'isRead', type: Boolean, required: false })
    @ApiQuery({ name: 'limit', type: Number, required: false })
    @ApiQuery({ name: 'page', type: Number, required: false })
    @ApiResponse({ status: 200, description: 'Return paginated notifications.' })
    async findAll(
        @Request() req: any,
        @Query('category') category?: NotificationCategory,
        @Query('isRead') isRead?: string,
        @Query('limit') limit?: number,
        @Query('page') page?: number,
    ) {
        return this.notificationService.findAllForUser(req.user.userId, {
            category,
            isRead: isRead !== undefined ? isRead === 'true' : undefined,
            limit: limit ? parseInt(limit.toString()) : 50,
            page: page ? parseInt(page.toString()) : 1,
        });
    }

    @Post('bulk-delete')
    @ApiOperation({ summary: 'Bulk delete notifications' })
    @ApiResponse({ status: 200, description: 'Notifications deleted.' })
    async bulkDelete(@Request() req: any, @Body('ids') ids: string[]) {
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return { success: false, message: 'Invalid ids array' };
        }
        await this.notificationService.bulkDelete(ids, req.user.userId);
        return { success: true };
    }

    @Post('bulk-read')
    @ApiOperation({ summary: 'Bulk mark notifications as read' })
    @ApiResponse({ status: 200, description: 'Notifications marked as read.' })
    async bulkMarkAsRead(@Request() req: any, @Body('ids') ids: string[]) {
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return { success: false, message: 'Invalid ids array' };
        }
        await this.notificationService.bulkMarkAsRead(ids, req.user.userId);
        return { success: true };
    }

    @Get('unread')
    @ApiOperation({ summary: 'Get unread notifications' })
    @ApiResponse({ status: 200, description: 'Return unread notifications.' })
    async findUnread(@Request() req: any) {
        return this.notificationService.findUnreadForUser(req.user.userId);
    }

    // === CRITICAL NOTIFICATION ENDPOINTS ===

    @Get('critical/unacknowledged')
    @ApiOperation({ summary: 'Get unacknowledged critical notifications' })
    @ApiResponse({ status: 200, description: 'Return unacknowledged critical notifications.' })
    async findUnacknowledgedCritical(@Request() req: any) {
        return this.notificationService.findUnacknowledgedCritical(req.user.userId);
    }

    @Post(':id/acknowledge')
    @ApiOperation({ summary: 'Acknowledge a critical notification' })
    @ApiResponse({ status: 200, description: 'Notification acknowledged.' })
    async acknowledgeNotification(@Param('id') id: string, @Request() req: any) {
        const result = await this.notificationService.acknowledgeNotification(id, req.user.userId);
        if (!result) {
            return { success: false, message: 'Notification not found' };
        }
        return { success: true, notification: result };
    }

    @Get('critical/count')
    @ApiOperation({ summary: 'Get count of unacknowledged critical notifications' })
    async countUnacknowledgedCritical(@Request() req: any) {
        const count = await this.notificationService.countUnacknowledgedCritical(req.user.userId);
        return { count };
    }

    @Get('count')
    @ApiOperation({ summary: 'Get unread notification count' })
    @ApiResponse({ status: 200, description: 'Return unread count.' })
    async countUnread(@Request() req: any) {
        const count = await this.notificationService.countUnread(req.user.userId);
        return { count };
    }

    @Get('count/by-category')
    @ApiOperation({ summary: 'Get unread notification count grouped by category' })
    @ApiResponse({ status: 200, description: 'Return unread counts by category.' })
    async countUnreadByCategory(@Request() req: any) {
        const counts = await this.notificationService.countUnreadByCategory(req.user.userId);
        return counts;
    }

    @Get('count/total-by-category')
    @ApiOperation({ summary: 'Get total notification count grouped by category' })
    @ApiResponse({ status: 200, description: 'Return total counts by category.' })
    async countTotalByCategory(@Request() req: any) {
        const counts = await this.notificationService.countTotalByCategory(req.user.userId);
        return counts;
    }

    @Patch(':id/read')
    @ApiOperation({ summary: 'Mark notification as read' })
    @ApiResponse({ status: 200, description: 'Notification marked as read.' })
    async markAsRead(@Param('id') id: string, @Request() req: any) {
        return this.notificationService.markAsRead(id, req.user.userId);
    }

    @Post('read-all')
    @ApiOperation({ summary: 'Mark all notifications as read' })
    @ApiResponse({ status: 200, description: 'All notifications marked as read.' })
    async markAllAsRead(@Request() req: any) {
        await this.notificationService.markAllAsRead(req.user.userId);
        return { success: true };
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete a notification' })
    @ApiResponse({ status: 200, description: 'Notification deleted.' })
    async delete(@Param('id') id: string, @Request() req: any) {
        await this.notificationService.delete(id, req.user.userId);
        return { success: true };
    }

    @Delete()
    @ApiOperation({ summary: 'Delete all notifications' })
    @ApiResponse({ status: 200, description: 'All notifications deleted.' })
    async deleteAll(@Request() req: any) {
        await this.notificationService.deleteAllForUser(req.user.userId);
        return { success: true };
    }
}
