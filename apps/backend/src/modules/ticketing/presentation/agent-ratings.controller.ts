import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
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
    async getAll() {
        return this.agentRatingService.getAllRatings();
    }
}
