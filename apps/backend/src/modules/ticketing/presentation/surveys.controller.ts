import { Controller, Post, Body, Get, Query, UseGuards } from '@nestjs/common';
import { SurveysService } from '../surveys.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/core/guards/roles.guard';
import { Roles } from '../../../shared/core/decorators/roles.decorator';
import { UserRole } from '../../users/enums/user-role.enum';
import { Public } from '../../../shared/core/decorators/public.decorator';

@ApiTags('Surveys')
@Controller('surveys')
export class SurveysController {
    constructor(private readonly surveysService: SurveysService) { }

    @Public()
    @Post('submit')
    @ApiOperation({ summary: 'Submit a survey (Public)' })
    @ApiResponse({ status: 200, description: 'Survey submitted successfully.' })
    async submit(
        @Body('token') token: string,
        @Body('rating') rating: number,
        @Body('comment') comment: string,
    ) {
        return this.surveysService.submitSurvey(token, rating, comment);
    }

    @Get('stats')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Get survey stats (Admin only)' })
    async getStats() {
        return this.surveysService.getStats();
    }
}
