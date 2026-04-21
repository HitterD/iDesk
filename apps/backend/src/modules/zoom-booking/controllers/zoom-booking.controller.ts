import {
    Controller,
    Get,
    Post,
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
import { PageAccessGuard } from '../../../shared/core/guards/page-access.guard';
import { PageAccess } from '../../../shared/core/decorators/page-access.decorator';
import { ZoomBookingService } from '../services/zoom-booking.service';
import { ZoomAccountService } from '../services/zoom-account.service';
import { ZoomSettingsService } from '../services/zoom-settings.service';
import { CreateBookingDto, GetCalendarDto, RescheduleBookingDto, CancelBookingDto } from '../dto';

@ApiTags('Zoom Booking')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PageAccessGuard)
@PageAccess('zoom_calendar')
@Throttle({ default: { limit: 60, ttl: 60000 } }) // 60 requests per minute
@Controller('zoom-booking')
export class ZoomBookingController {
    constructor(
        private readonly bookingService: ZoomBookingService,
        private readonly accountService: ZoomAccountService,
        private readonly settingsService: ZoomSettingsService,
    ) { }

    @Get('accounts')
    @ApiOperation({ summary: 'Get all active Zoom accounts' })
    async getAccounts() {
        return this.accountService.findActive();
    }

    @Get('settings/durations')
    @ApiOperation({ summary: 'Get available duration options' })
    async getDurationOptions() {
        return this.settingsService.getDurationOptions();
    }

    @Get('settings')
    @ApiOperation({ summary: 'Get public calendar settings (time range, working days)' })
    async getPublicSettings() {
        return this.settingsService.getPublicSettings();
    }

    @Get('calendar')
    @ApiOperation({ summary: 'Get calendar data for a Zoom account' })
    @ApiQuery({ name: 'zoomAccountId', required: true })
    @ApiQuery({ name: 'startDate', required: true, description: 'YYYY-MM-DD' })
    @ApiQuery({ name: 'endDate', required: true, description: 'YYYY-MM-DD' })
    async getCalendar(
        @Query('zoomAccountId') zoomAccountId: string,
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
        @Req() req: Request,
    ) {
        const user = req.user as any;
        return this.bookingService.getCalendar(
            zoomAccountId,
            new Date(startDate),
            new Date(endDate),
            user.userId,
        );
    }

    @Post()
    @Throttle({ default: { limit: 10, ttl: 60000 } }) // Stricter: 10 bookings per minute
    @ApiOperation({ summary: 'Create a new booking' })
    async createBooking(
        @Body() dto: CreateBookingDto,
        @Req() req: Request,
    ) {
        const user = req.user as any;
        const ipAddress = req.ip || req.socket.remoteAddress;
        return this.bookingService.createBooking(dto, user, ipAddress);
    }

    @Get('my-bookings')
    @ApiOperation({ summary: 'Get current user\'s bookings' })
    async getMyBookings(@Req() req: Request) {
        const user = req.user as any;
        return this.bookingService.getMyBookings(user.userId);
    }

    @Get('my-upcoming')
    @ApiOperation({ summary: 'Get current user upcoming bookings' })
    async getMyUpcomingBookings(@Req() req: Request) {
        try {
            const user = req.user as any;
            // console.log(`[ZoomController] getMyUpcomingBookings called by ${user?.userId} (${user?.role})`);

            if (!user || !user.userId) {
                console.error('[ZoomController] User ID missing in request');
                return [];
            }

            return await this.bookingService.getMyUpcomingBookings(user.userId);
        } catch (error: any) {
            console.error(`[ZoomController] Error in getMyUpcomingBookings: ${error.message}`, error.stack);
            return []; // Fail safe even in controller
        }
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get booking details' })
    async getBooking(
        @Param('id') id: string,
        @Req() req: Request,
    ) {
        const user = req.user as any;
        return this.bookingService.getBooking(id, user);
    }

    @Post(':id/reschedule')
    @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 reschedules per minute
    @ApiOperation({ summary: 'Reschedule own booking (update date/time)' })
    async rescheduleBooking(
        @Param('id') id: string,
        @Body() dto: RescheduleBookingDto,
        @Req() req: Request,
    ) {
        const user = req.user as any;
        const ipAddress = req.ip || req.socket.remoteAddress;
        return this.bookingService.rescheduleBooking(id, dto, user, ipAddress);
    }

    @Post(':id/cancel')
    @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 cancellations per minute
    @ApiOperation({ summary: 'Cancel own booking' })
    async cancelOwnBooking(
        @Param('id') id: string,
        @Body() dto: CancelBookingDto,
        @Req() req: Request,
    ) {
        const user = req.user as any;
        const ipAddress = req.ip || req.socket.remoteAddress;
        return this.bookingService.cancelBookingByOwner(id, dto, user, ipAddress);
    }
}
