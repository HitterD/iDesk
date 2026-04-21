import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Param,
    Body,
    UseGuards,
    Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/core/guards/roles.guard';
import { Roles } from '../../../shared/core/decorators/roles.decorator';
import { UserRole } from '../../users/enums/user-role.enum';
import { TimeTrackingService } from '../services/time-tracking.service';

class StartTimerDto {
    description?: string;
}

class AddManualEntryDto {
    durationMinutes: number;
    description?: string;
    date?: string;
}

class UpdateEntryDto {
    durationMinutes?: number;
    description?: string;
}

@ApiTags('Time Tracking')
@Controller('tickets/:ticketId/time-entries')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class TimeTrackingController {
    constructor(private readonly timeTrackingService: TimeTrackingService) { }

    @Post('start')
    @Roles(UserRole.ADMIN, UserRole.AGENT)
    @ApiOperation({ summary: 'Start a timer for a ticket' })
    @ApiResponse({ status: 201, description: 'Timer started.' })
    async startTimer(
        @Param('ticketId') ticketId: string,
        @Body() dto: StartTimerDto,
        @Request() req: any,
    ) {
        return this.timeTrackingService.startTimer(ticketId, req.user.userId, dto.description);
    }

    @Post('stop')
    @Roles(UserRole.ADMIN, UserRole.AGENT)
    @ApiOperation({ summary: 'Stop the running timer for a ticket' })
    @ApiResponse({ status: 200, description: 'Timer stopped.' })
    async stopTimer(@Param('ticketId') ticketId: string, @Request() req: any) {
        return this.timeTrackingService.stopTimerByTicket(ticketId, req.user.userId);
    }

    @Post()
    @Roles(UserRole.ADMIN, UserRole.AGENT)
    @ApiOperation({ summary: 'Add a manual time entry' })
    @ApiResponse({ status: 201, description: 'Time entry added.' })
    async addManualEntry(
        @Param('ticketId') ticketId: string,
        @Body() dto: AddManualEntryDto,
        @Request() req: any,
    ) {
        return this.timeTrackingService.addManualEntry(
            ticketId,
            req.user.userId,
            dto.durationMinutes,
            dto.description,
            dto.date ? new Date(dto.date) : undefined,
        );
    }

    @Get()
    @Roles(UserRole.ADMIN, UserRole.AGENT)
    @ApiOperation({ summary: 'Get all time entries for a ticket' })
    @ApiResponse({ status: 200, description: 'Returns time entries.' })
    async getTimeEntries(@Param('ticketId') ticketId: string) {
        return this.timeTrackingService.getTicketTimeEntries(ticketId);
    }

    @Get('total')
    @Roles(UserRole.ADMIN, UserRole.AGENT)
    @ApiOperation({ summary: 'Get total time spent on a ticket' })
    @ApiResponse({ status: 200, description: 'Returns total minutes.' })
    async getTotalTime(@Param('ticketId') ticketId: string) {
        const totalMinutes = await this.timeTrackingService.getTicketTotalTime(ticketId);
        return { totalMinutes };
    }

    @Get('running')
    @Roles(UserRole.ADMIN, UserRole.AGENT)
    @ApiOperation({ summary: 'Get running timer for current user' })
    @ApiResponse({ status: 200, description: 'Returns running timer or null.' })
    async getRunningTimer(@Param('ticketId') ticketId: string, @Request() req: any) {
        return this.timeTrackingService.getRunningTimer(ticketId, req.user.userId);
    }

    @Patch(':entryId')
    @Roles(UserRole.ADMIN, UserRole.AGENT)
    @ApiOperation({ summary: 'Update a time entry' })
    @ApiResponse({ status: 200, description: 'Time entry updated.' })
    async updateEntry(
        @Param('entryId') entryId: string,
        @Body() dto: UpdateEntryDto,
        @Request() req: any,
    ) {
        return this.timeTrackingService.updateEntry(entryId, req.user.userId, dto);
    }

    @Delete(':entryId')
    @Roles(UserRole.ADMIN, UserRole.AGENT)
    @ApiOperation({ summary: 'Delete a time entry' })
    @ApiResponse({ status: 200, description: 'Time entry deleted.' })
    async deleteEntry(@Param('entryId') entryId: string, @Request() req: any) {
        await this.timeTrackingService.deleteEntry(entryId, req.user.userId);
        return { success: true };
    }
}
