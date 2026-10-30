import { Controller, Get, Param, ParseUUIDPipe, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/core/guards/roles.guard';
import { Roles } from '../../shared/core/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { AgentDashboardService, DEV_AGENT_ROLES, SUPPORT_AGENT_ROLES } from './agent-dashboard.service';

@ApiTags('Agent Dashboard')
@ApiBearerAuth()
@Controller('agent-dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AgentDashboardController {
    constructor(private readonly agentDashboardService: AgentDashboardService) { }

    @Get('me')
    @Roles(...SUPPORT_AGENT_ROLES, ...DEV_AGENT_ROLES)
    @ApiOperation({ summary: 'Personal dashboard of the signed-in agent' })
    @ApiQuery({ name: 'days', required: false, description: '7 | 30 | 90 (default 30)' })
    getMine(@Request() req: any, @Query('days') days?: string) {
        const actor = { userId: req.user.userId, role: req.user.role };
        return this.agentDashboardService.getDashboard(actor, req.user.userId, days);
    }

    @Get('agents/:agentId')
    @Roles(UserRole.ADMIN, UserRole.MANAGER)
    @ApiOperation({ summary: 'Dashboard of one agent (admin, or manager of the same scope)' })
    @ApiQuery({ name: 'days', required: false, description: '7 | 30 | 90 (default 30)' })
    getForAgent(
        @Param('agentId', ParseUUIDPipe) agentId: string,
        @Request() req: any,
        @Query('days') days?: string,
    ) {
        const actor = { userId: req.user.userId, role: req.user.role };
        return this.agentDashboardService.getDashboard(actor, agentId, days);
    }
}
