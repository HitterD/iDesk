import { Controller, Get, Param, ParseUUIDPipe, Query, Request, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/core/guards/roles.guard';
import { Roles } from '../../../shared/core/decorators/roles.decorator';
import { UserRole } from '../../users/enums/user-role.enum';
import { AgentRatingService } from '../services/agent-rating.service';

@ApiTags('Agent Ratings')
@Controller('agent-ratings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AgentRatingsController {
    constructor(private readonly agentRatingService: AgentRatingService) { }

    @Get('me')
    @ApiOperation({ summary: 'My rating summary (anonymous comments)' })
    async getMine(@Request() req: any) {
        return this.agentRatingService.getMySummary(req.user.userId);
    }

    @Get()
    @Roles(UserRole.ADMIN, UserRole.MANAGER)
    @ApiOperation({ summary: 'Ratings of every agent, with rater names' })
    @ApiQuery({ name: 'siteCode', required: false, description: 'Only agents whose home site has this code (e.g. SPJ)' })
    async getAll(@Query('siteCode') siteCode?: string) {
        return this.agentRatingService.getAllRatings(siteCode?.trim() || undefined);
    }

    @Get('agents/:agentId')
    @Roles(UserRole.ADMIN, UserRole.MANAGER)
    @ApiOperation({ summary: 'Every rating one agent received, with rater names and comments' })
    async getForAgent(@Param('agentId', ParseUUIDPipe) agentId: string) {
        return this.agentRatingService.getAgentRatings(agentId);
    }
}
