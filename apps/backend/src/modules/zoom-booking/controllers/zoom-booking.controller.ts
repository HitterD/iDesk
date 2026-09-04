import {
    BadRequestException,
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
import { CreateBookingDto, GetCalendarDto, RescheduleBookingDto, CancelBookingDto, SendReminderDto } from '../dto';
import { extractClientIp } from '../../../shared/security/client-ip';

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

    @Get('calendar/merged')
    @ApiOperation({ summary: 'Get merged calendar data across active Zoom accounts' })
    @ApiQuery({ name: 'startDate', required: true, description: 'YYYY-MM-DD' })
    @ApiQuery({ name: 'endDate', required: true, description: 'YYYY-MM-DD' })
    async getMergedCalendar(
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
        @Req() req: Request,
    ) {
        const user = req.user as any;
        return this.bookingService.getMergedCalendar(
            new Date(startDate),
            new Date(endDate),
            user.userId,
        );
    }

    @Get('availability/slots')
    @ApiOperation({ summary: 'Get day-level slots availability across all Zoom accounts' })
    @ApiQuery({ name: 'date', required: true, description: 'YYYY-MM-DD' })
    @ApiQuery({ name: 'durationMinutes', required: false, example: 60 })
    async getDaySlotsAvailability(
        @Query('date') date: string,
        @Query('durationMinutes') durationMinutes?: string,
    ) {
        const parsedDate = new Date(`${date}T00:00:00`);
        const normalizedDate = `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}-${String(parsedDate.getDate()).padStart(2, '0')}`;
        const dateIsValid = /^\d{4}-\d{2}-\d{2}$/.test(date)
            && !Number.isNaN(parsedDate.getTime())
            && normalizedDate === date;

        if (!dateIsValid) {
            throw new BadRequestException('Parameter date tidak valid (harus YYYY-MM-DD).');
        }

        const duration = durationMinutes ? Number(durationMinutes) : 60;
        if (!Number.isInteger(duration) || duration < 15 || duration > 480) {
            throw new BadRequestException('Parameter durationMinutes tidak valid.');
        }

        return this.bookingService.getDaySlotsAvailability(date, duration);
    }

    @Get('availability')
    @ApiOperation({ summary: 'Check availability without reserving a Zoom account' })
    @ApiQuery({ name: 'date', required: true, description: 'YYYY-MM-DD' })
    @ApiQuery({ name: 'startTime', required: true, description: 'HH:mm' })
    @ApiQuery({ name: 'durationMinutes', required: true, example: 60 })
    async getAvailability(
        @Query('date') date: string,
        @Query('startTime') startTime: string,
        @Query('durationMinutes') durationMinutes: string,
    ) {
        const duration = Number(durationMinutes);
        const parsedDate = new Date(`${date}T00:00:00`);
        const normalizedDate = `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}-${String(parsedDate.getDate()).padStart(2, '0')}`;
        const dateIsValid = /^\d{4}-\d{2}-\d{2}$/.test(date)
            && !Number.isNaN(parsedDate.getTime())
            && normalizedDate === date;

        if (!dateIsValid
            || !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)
            || !Number.isInteger(duration)
            || duration < 30
            || duration > 240) {
            throw new BadRequestException('Parameter availability tidak valid.');
        }

        return this.bookingService.checkAvailability(date, startTime, duration);
    }

    @Post()
    @Throttle({ default: { limit: 10, ttl: 60000 } }) // Stricter: 10 bookings per minute
    @ApiOperation({ summary: 'Create a new booking' })
    async createBooking(
        @Body() dto: CreateBookingDto,
        @Req() req: Request,
    ) {
        const user = req.user as any;
        const ipAddress = extractClientIp(req);
        return this.bookingService.createBooking(dto, user, ipAddress);
    }

    @Get('my-bookings')
    @ApiOperation({ summary: 'Get current user\'s bookings' })
    async getMyBookings(@Req() req: Request) {
        const user = req.user as any;
        return this.bookingService.getMyBookings(user.userId, user.email);
    }

    @Get('my-upcoming')
    @ApiOperation({ summary: 'Get current user upcoming bookings' })
    async getMyUpcomingBookings(@Req() req: Request) {
        try {
            const user = req.user as any;
            // console.log(`[ZoomController] getMyUpcomingBookings called by ${user?.userId} (${user?.role})`);

            if (!user || !user.userId) {
                throw new BadRequestException('Authenticated user is required');
            }

            return await this.bookingService.getMyUpcomingBookings(user.userId);
        } catch (error: unknown) {
            throw error;
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
        const ipAddress = extractClientIp(req);
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
        const ipAddress = extractClientIp(req);
        return this.bookingService.cancelBookingByOwner(id, dto, user, ipAddress);
    }

    @Post(':id/send-reminder')
    @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 reminder requests per minute
    @ApiOperation({ summary: 'Send email reminder & Outlook calendar (.ics) invite for a booking' })
    async sendReminder(
        @Param('id') id: string,
        @Body() dto: SendReminderDto,
        @Req() req: Request,
    ) {
        const user = req.user as any;
        return this.bookingService.sendReminder(id, dto, user);
    }
}
