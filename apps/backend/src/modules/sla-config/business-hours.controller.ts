import { Controller, Get, Put, Post, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/core/guards/roles.guard';
import { Roles } from '../../shared/core/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { BusinessHoursService } from './business-hours.service';
import { UpdateBusinessHoursDto, AddHolidayDto } from './dto/update-business-hours.dto';

@ApiTags('Business Hours')
@Controller('business-hours')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BusinessHoursController {
    constructor(private readonly service: BusinessHoursService) { }

    @Get()
    @Roles(UserRole.ADMIN, UserRole.AGENT)
    @ApiOperation({ summary: 'Get current business hours configuration' })
    @ApiResponse({ status: 200, description: 'Returns business hours configuration' })
    async getConfig() {
        const config = await this.service.getDefault();
        const formatted = this.service.getFormattedHours(config);
        return {
            ...config,
            ...formatted,
        };
    }

    @Put()
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Update business hours configuration' })
    @ApiResponse({ status: 200, description: 'Business hours updated successfully' })
    async updateConfig(@Body() dto: UpdateBusinessHoursDto, @Req() req: any) {
        const config = await this.service.getDefault();
        const updated = await this.service.update(config.id, dto, req.user?.id || req.user?.userId);
        const formatted = this.service.getFormattedHours(updated);
        return {
            ...updated,
            ...formatted,
        };
    }

    @Post('holidays')
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Add a holiday date' })
    @ApiResponse({ status: 201, description: 'Holiday added successfully' })
    async addHoliday(@Body() dto: AddHolidayDto, @Req() req: any) {
        const config = await this.service.getDefault();
        return this.service.addHoliday(config.id, dto.date, req.user?.id || req.user?.userId);
    }

    @Delete('holidays/:date')
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Remove a holiday date' })
    @ApiResponse({ status: 200, description: 'Holiday removed successfully' })
    async removeHoliday(@Param('date') date: string, @Req() req: any) {
        const config = await this.service.getDefault();
        return this.service.removeHoliday(config.id, date, req.user?.id || req.user?.userId);
    }

    @Get('holidays')
    @Roles(UserRole.ADMIN, UserRole.AGENT)
    @ApiOperation({ summary: 'Get all holidays' })
    @ApiResponse({ status: 200, description: 'Returns list of holidays' })
    async getHolidays() {
        const config = await this.service.getDefault();
        return {
            holidays: config.holidays,
            count: config.holidays.length,
        };
    }
}
