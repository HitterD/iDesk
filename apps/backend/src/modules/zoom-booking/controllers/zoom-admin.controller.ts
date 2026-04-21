import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';

import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/core/guards/roles.guard';
import { PageAccessGuard } from '../../../shared/core/guards/page-access.guard';
import { PageAccess } from '../../../shared/core/decorators/page-access.decorator';
import { Roles } from '../../../shared/core/decorators/roles.decorator';
import { UserRole } from '../../users/enums/user-role.enum';

import { ZoomBookingService } from '../services/zoom-booking.service';
import { ZoomAccountService } from '../services/zoom-account.service';
import { ZoomSettingsService } from '../services/zoom-settings.service';
import { ZoomAuditLogService } from '../services/zoom-audit-log.service';
import { ZoomSyncService } from '../services/zoom-sync.service';
import {
    CreateZoomAccountDto,
    UpdateZoomAccountDto,
    UpdateZoomSettingsDto,
    CancelBookingDto,
    RescheduleBookingDto,
} from '../dto';
import { BookingStatus } from '../enums/booking-status.enum';

@ApiTags('Zoom Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PageAccessGuard)
@Roles(UserRole.ADMIN)
@PageAccess('zoom_calendar')
@Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 requests per minute for admin
@Controller('admin/zoom')
export class ZoomAdminController {
    constructor(
        private readonly bookingService: ZoomBookingService,
        private readonly accountService: ZoomAccountService,
        private readonly settingsService: ZoomSettingsService,
        private readonly auditLogService: ZoomAuditLogService,
        private readonly syncService: ZoomSyncService,
    ) { }

    // ==================== ACCOUNTS ====================

    @Get('accounts')
    @ApiOperation({ summary: 'Get all Zoom accounts (including inactive)' })
    async getAllAccounts() {
        return this.accountService.findAll();
    }

    @Post('accounts')
    @ApiOperation({ summary: 'Create a new Zoom account' })
    async createAccount(@Body() dto: CreateZoomAccountDto) {
        return this.accountService.create(dto);
    }

    @Put('accounts/:id')
    @ApiOperation({ summary: 'Update a Zoom account' })
    async updateAccount(
        @Param('id') id: string,
        @Body() dto: UpdateZoomAccountDto,
    ) {
        return this.accountService.update(id, dto);
    }

    @Delete('accounts/:id')
    @ApiOperation({ summary: 'Delete a Zoom account' })
    async deleteAccount(@Param('id') id: string) {
        await this.accountService.delete(id);
        return { success: true };
    }

    @Post('accounts/reorder')
    @ApiOperation({ summary: 'Reorder Zoom accounts' })
    async reorderAccounts(@Body() body: { accountIds: string[] }) {
        return this.accountService.reorder(body.accountIds);
    }

    @Post('accounts/sync')
    @ApiOperation({ summary: 'Sync accounts with Zoom API' })
    async syncAccounts() {
        return this.accountService.syncWithZoom();
    }

    @Post('sync-meetings')
    @ApiOperation({ summary: 'Manually trigger sync meetings from all Zoom accounts' })
    async syncMeetings() {
        const updatedCount = await this.syncService.syncAllAccounts();
        return { success: true, message: 'Sync process completed', updatedCount };
    }

    @Post('accounts/initialize')
    @ApiOperation({ summary: 'Initialize 10 default Zoom accounts' })
    async initializeAccounts(@Body() body: { emails: string[] }) {
        return this.accountService.initializeDefaultAccounts(body.emails);
    }

    // ==================== SETTINGS ====================

    @Get('settings')
    @ApiOperation({ summary: 'Get Zoom booking settings' })
    async getSettings() {
        return this.settingsService.getSettings();
    }

    @Put('settings')
    @ApiOperation({ summary: 'Update Zoom booking settings' })
    async updateSettings(@Body() dto: UpdateZoomSettingsDto) {
        return this.settingsService.updateSettings(dto);
    }

    @Post('settings/blocked-dates')
    @ApiOperation({ summary: 'Add a blocked date' })
    async addBlockedDate(@Body() body: { date: string }) {
        return this.settingsService.addBlockedDate(body.date);
    }

    @Delete('settings/blocked-dates/:date')
    @ApiOperation({ summary: 'Remove a blocked date' })
    async removeBlockedDate(@Param('date') date: string) {
        return this.settingsService.removeBlockedDate(date);
    }

    // ==================== BOOKINGS ====================

    @Get('bookings')
    @ApiOperation({ summary: 'Get all bookings with filters' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'zoomAccountId', required: false })
    @ApiQuery({ name: 'status', required: false, enum: BookingStatus })
    @ApiQuery({ name: 'startDate', required: false })
    @ApiQuery({ name: 'endDate', required: false })
    async getAllBookings(
        @Query('page') page?: number,
        @Query('limit') limit?: number,
        @Query('zoomAccountId') zoomAccountId?: string,
        @Query('status') status?: BookingStatus,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        return this.bookingService.getAllBookings(
            page || 1,
            limit || 20,
            {
                zoomAccountId,
                status,
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined,
            },
        );
    }

    @Post('bookings/:id/cancel')
    @ApiOperation({ summary: 'Cancel a booking' })
    async cancelBooking(
        @Param('id') id: string,
        @Body() dto: CancelBookingDto,
        @Req() req: Request,
    ) {
        const user = req.user as any;
        const ipAddress = req.ip || req.socket.remoteAddress;
        return this.bookingService.cancelBooking(id, dto, user, ipAddress);
    }

    @Post('bookings/:id/retry')
    @ApiOperation({ summary: 'Retry creating Zoom meeting for PENDING booking' })
    async retryZoomMeeting(
        @Param('id') id: string,
        @Req() req: Request,
    ) {
        const user = req.user as any;
        const ipAddress = req.ip || req.socket.remoteAddress;
        return this.bookingService.retryZoomMeeting(id, user, ipAddress);
    }

    @Post('bookings/:id/reschedule')
    @ApiOperation({ summary: 'Reschedule a booking (update date/time)' })
    async rescheduleBooking(
        @Param('id') id: string,
        @Body() dto: RescheduleBookingDto,
        @Req() req: Request,
    ) {
        const user = req.user as any;
        const ipAddress = req.ip || req.socket.remoteAddress;
        return this.bookingService.rescheduleBooking(id, dto, user, ipAddress);
    }

    // ==================== AUDIT LOGS ====================

    @Get('audit-logs')
    @ApiOperation({ summary: 'Get Zoom audit logs' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'action', required: false })
    @ApiQuery({ name: 'startDate', required: false })
    @ApiQuery({ name: 'endDate', required: false })
    async getAuditLogs(
        @Query('page') page?: number,
        @Query('limit') limit?: number,
        @Query('action') action?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        return this.auditLogService.findAll(
            page || 1,
            limit || 20,
            {
                action,
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined,
            },
        );
    }
}
