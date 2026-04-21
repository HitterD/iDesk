import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Query,
    UseGuards,
    ParseUUIDPipe,
    Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { WorkloadService } from './workload.service';
import { UpdatePriorityWeightDto, AssignTicketDto } from './dto';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/core/guards/roles.guard';
import { Roles } from '../../shared/core/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';

@ApiTags('Workload')
@ApiBearerAuth()
@Controller('workload')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WorkloadController {
    constructor(private readonly workloadService: WorkloadService) { }

    // ==========================================
    // Priority Weights
    // ==========================================

    @Get('priority-weights')
    @ApiOperation({ summary: 'Get all priority weights' })
    @Roles(UserRole.ADMIN, UserRole.MANAGER)
    getPriorityWeights() {
        return this.workloadService.getPriorityWeights();
    }

    @Patch('priority-weights/:priority')
    @ApiOperation({ summary: 'Update priority weight' })
    @Roles(UserRole.ADMIN)
    updatePriorityWeight(
        @Param('priority') priority: string,
        @Body() dto: UpdatePriorityWeightDto,
    ) {
        return this.workloadService.updatePriorityWeight(priority, dto);
    }

    // ==========================================
    // Agent Workloads
    // ==========================================

    @Get('agents')
    @ApiOperation({ summary: 'Get all agent workloads for a site' })
    @ApiQuery({ name: 'siteId', required: true })
    @ApiQuery({ name: 'date', required: false, description: 'YYYY-MM-DD format' })
    @Roles(UserRole.ADMIN, UserRole.MANAGER)
    getAllAgentWorkloads(
        @Query('siteId') siteId: string,
        @Query('date') date?: string,
    ) {
        const workDate = date ? new Date(date) : undefined;
        return this.workloadService.getAllAgentWorkloads(siteId, workDate);
    }

    @Get('agents/:agentId')
    @ApiOperation({ summary: 'Get specific agent workload' })
    @ApiQuery({ name: 'siteId', required: true })
    @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.AGENT)
    getAgentWorkload(
        @Param('agentId', ParseUUIDPipe) agentId: string,
        @Query('siteId') siteId: string,
    ) {
        return this.workloadService.getAgentWorkload(agentId, siteId);
    }

    @Post('agents/:agentId/recalculate')
    @ApiOperation({ summary: 'Recalculate agent workload from tickets' })
    @ApiQuery({ name: 'siteId', required: true })
    @Roles(UserRole.ADMIN)
    recalculateAgentWorkload(
        @Param('agentId', ParseUUIDPipe) agentId: string,
        @Query('siteId') siteId: string,
        @Req() req: any,
    ) {
        return this.workloadService.recalculateAgentWorkload(agentId, siteId, req.user?.id || req.user?.userId);
    }

    // ==========================================
    // Auto-Assignment
    // ==========================================

    @Post('auto-assign')
    @ApiOperation({ summary: 'Auto-assign a ticket to the best available agent' })
    @Roles(UserRole.ADMIN, UserRole.AGENT)
    autoAssignTicket(@Body() dto: AssignTicketDto, @Req() req: any) {
        return this.workloadService.autoAssignTicket(dto.ticketId, req.user?.id || req.user?.userId);
    }

    @Get('best-agent/:siteId')
    @ApiOperation({ summary: 'Find the best agent for assignment (preview)' })
    @Roles(UserRole.ADMIN, UserRole.MANAGER)
    findBestAgent(@Param('siteId', ParseUUIDPipe) siteId: string) {
        return this.workloadService.findBestAgentForAssignment(siteId);
    }

    // ==========================================
    // Summary
    // ==========================================

    @Get('summary')
    @ApiOperation({ summary: 'Get workload summary' })
    @ApiQuery({ name: 'siteId', required: false })
    @Roles(UserRole.ADMIN, UserRole.MANAGER)
    getWorkloadSummary(@Query('siteId') siteId?: string) {
        return this.workloadService.getWorkloadSummary(siteId);
    }
}
