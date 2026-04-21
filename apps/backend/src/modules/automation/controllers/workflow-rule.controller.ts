import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Patch,
    Body,
    Param,
    Query,
    UseGuards,
    Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/core/guards/roles.guard';
import { Roles } from '../../../shared/core/decorators/roles.decorator';
import { UserRole } from '../../users/enums/user-role.enum';
import { WorkflowRuleService } from '../services/workflow-rule.service';
import { WorkflowEngineService } from '../services/workflow-engine.service';
import {
    CreateWorkflowRuleDto,
    UpdateWorkflowRuleDto,
    ReorderRulesDto,
    CreateFromTemplateDto,
    TestRuleDto,
} from '../dto/workflow-rule.dto';

/**
 * Workflow Rule Controller
 * REST API for managing automation rules
 */
@Controller('automation')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WorkflowRuleController {
    constructor(
        private readonly ruleService: WorkflowRuleService,
        private readonly engineService: WorkflowEngineService,
    ) { }

    /**
     * Get all workflow rules
     */
    @Get('rules')
    @Roles(UserRole.ADMIN, UserRole.AGENT)
    async findAll() {
        return this.ruleService.findAll();
    }

    /**
     * Get available templates
     */
    @Get('templates')
    @Roles(UserRole.ADMIN)
    async getTemplates() {
        return this.ruleService.getTemplates();
    }

    /**
     * Get execution history
     */
    @Get('executions')
    @Roles(UserRole.ADMIN)
    async getExecutions(@Query('limit') limit?: string) {
        return this.ruleService.getAllExecutions(limit ? parseInt(limit, 10) : 100);
    }

    /**
     * Get executions for a specific ticket
     */
    @Get('executions/ticket/:ticketId')
    @Roles(UserRole.ADMIN, UserRole.AGENT)
    async getTicketExecutions(@Param('ticketId') ticketId: string) {
        return this.ruleService.getTicketExecutions(ticketId);
    }

    /**
     * Get rule by ID
     */
    @Get('rules/:id')
    @Roles(UserRole.ADMIN, UserRole.AGENT)
    async findOne(@Param('id') id: string) {
        return this.ruleService.findById(id);
    }

    /**
     * Get executions for a specific rule
     */
    @Get('rules/:id/executions')
    @Roles(UserRole.ADMIN)
    async getRuleExecutions(
        @Param('id') id: string,
        @Query('limit') limit?: string,
    ) {
        return this.ruleService.getExecutions(id, limit ? parseInt(limit, 10) : 50);
    }

    /**
     * Create new rule
     */
    @Post('rules')
    @Roles(UserRole.ADMIN)
    async create(@Body() dto: CreateWorkflowRuleDto, @Req() req: any) {
        return this.ruleService.create(dto, req.user.id);
    }

    /**
     * Create rule from template
     */
    @Post('rules/from-template')
    @Roles(UserRole.ADMIN)
    async createFromTemplate(@Body() dto: CreateFromTemplateDto, @Req() req: any) {
        return this.ruleService.createFromTemplate(dto.templateId, req.user.id);
    }

    /**
     * Update rule
     */
    @Put('rules/:id')
    @Roles(UserRole.ADMIN)
    async update(@Param('id') id: string, @Body() dto: UpdateWorkflowRuleDto, @Req() req: any) {
        return this.ruleService.update(id, dto, req.user?.id || req.user?.userId);
    }

    /**
     * Delete rule
     */
    @Delete('rules/:id')
    @Roles(UserRole.ADMIN)
    async delete(@Param('id') id: string, @Req() req: any) {
        await this.ruleService.delete(id, req.user?.id || req.user?.userId);
        return { success: true };
    }

    /**
     * Toggle rule active status
     */
    @Patch('rules/:id/toggle')
    @Roles(UserRole.ADMIN)
    async toggleActive(@Param('id') id: string, @Req() req: any) {
        return this.ruleService.toggleActive(id, req.user?.id || req.user?.userId);
    }

    /**
     * Reorder rules
     */
    @Patch('rules/reorder')
    @Roles(UserRole.ADMIN)
    async reorder(@Body() dto: ReorderRulesDto) {
        await this.ruleService.reorder(dto.orderedIds);
        return { success: true };
    }

    /**
     * Test rule against a ticket (dry run)
     */
    @Post('rules/:id/test')
    @Roles(UserRole.ADMIN)
    async testRule(@Param('id') id: string, @Body() dto: TestRuleDto) {
        return this.engineService.testRule(id, dto.ticketId);
    }
}
