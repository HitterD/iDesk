import {
    Controller,
    Get,
    Post,
    Put,
    Patch,
    Delete,
    Param,
    Request,
    UseGuards,
    Query,
    Body,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationCenterService } from './notification-center.service';
import { NotificationCategory } from './entities/notification.entity';
import { SnoozeActionItemDto, UnsnoozeActionItemDto } from './dto/snooze-action-item.dto';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { PageAccessGuard } from '../../shared/core/guards/page-access.guard';
import { PageAccess } from '../../shared/core/decorators/page-access.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard, PageAccessGuard)
@PageAccess('notifications')
export class NotificationController {
    constructor(
        private readonly notificationService: NotificationService,
        private readonly notificationCenterService: NotificationCenterService
    ) { }

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

    // === PREFERENCES ENDPOINTS ===

    @Get('preferences')
    @ApiOperation({ summary: 'Get notification preferences for current user' })
    @ApiResponse({ status: 200, description: 'Return notification preferences.' })
    async getPreferences(@Request() req: any) {
        return this.notificationCenterService.getOrCreatePreferences(req.user.userId);
    }

    @Put('preferences')
    @ApiOperation({ summary: 'Update notification preferences (full replace)' })
    @ApiResponse({ status: 200, description: 'Preferences updated.' })
    async replacePreferences(@Request() req: any, @Body() updates: Record<string, any>) {
        return this.notificationCenterService.updatePreferences(req.user.userId, updates);
    }

    @Patch('preferences')
    @ApiOperation({ summary: 'Partially update notification preferences' })
    @ApiResponse({ status: 200, description: 'Preferences updated.' })
    async updatePreferences(@Request() req: any, @Body() updates: Record<string, any>) {
        return this.notificationCenterService.updatePreferences(req.user.userId, updates);
    }

    @Patch('preferences/type-settings')
    @ApiOperation({ summary: 'Update per-type channel settings' })
    @ApiResponse({ status: 200, description: 'Type settings updated.' })
    async updateTypeSettings(
        @Request() req: any,
        @Body() body: { notificationType: string; channels: Record<string, boolean> }
    ) {
        return this.notificationCenterService.updateTypePreference(
            req.user.userId,
            body.notificationType as any,
            body.channels
        );
    }

    // === CRITICAL NOTIFICATION ENDPOINTS ===

    @Get('action-items')
    @ApiOperation({ summary: 'Get current action items for the user based on their role' })
    @ApiResponse({ status: 200, description: 'Return action items.' })
    async getActionItems(@Request() req: any) {
        return this.notificationCenterService.getActionItems(req.user.userId, req.user.role);
    }

    @Post('action-items/snooze')
    @ApiOperation({ summary: 'Snooze an action item' })
    @ApiResponse({ status: 200, description: 'Action item snoozed.' })
    async snoozeActionItem(@Request() req: any, @Body() body: SnoozeActionItemDto) {
        return this.notificationCenterService.snoozeActionItem(
            req.user.userId,
            body.entityType,
            body.entityId,
            body.duration,
        );
    }

    @Delete('action-items/snooze')
    @ApiOperation({ summary: 'Unsnooze an action item' })
    @ApiResponse({ status: 200, description: 'Action item unsnoozed.' })
    async unsnoozeActionItem(@Request() req: any, @Body() body: UnsnoozeActionItemDto) {
        await this.notificationCenterService.unsnoozeActionItem(
            req.user.userId,
            body.entityType,
            body.entityId,
        );
        return { success: true };
    }

    @Get('preferences/categories')
    @ApiOperation({ summary: 'Get action item category settings' })
    async getCategorySettings(@Request() req: any) {
        return this.notificationCenterService.getCategorySettings(req.user.userId);
    }

    @Patch('preferences/categories')
    @ApiOperation({ summary: 'Update action item category settings' })
    async updateCategorySettings(@Request() req: any, @Body() updates: Record<string, boolean>) {
        return this.notificationCenterService.updateCategorySettings(req.user.userId, updates);
    }

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
