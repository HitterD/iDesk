import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In } from 'typeorm';
import { WorkflowRule } from '../entities/workflow-rule.entity';
import { WorkflowExecution } from '../entities/workflow-execution.entity';
import { CreateWorkflowRuleDto, UpdateWorkflowRuleDto, WorkflowRuleResponseDto } from '../dto/workflow-rule.dto';
import { WORKFLOW_TEMPLATES, WorkflowTemplate } from '../types/workflow.types';
import { AuditService } from '../../audit/audit.service';
import { AuditAction } from '../../audit/entities/audit-log.entity';

/**
 * WorkflowRule Service
 * CRUD operations for workflow automation rules
 */
@Injectable()
export class WorkflowRuleService {
    private readonly logger = new Logger(WorkflowRuleService.name);

    constructor(
        private readonly auditService: AuditService,
        @InjectRepository(WorkflowRule)
        private readonly ruleRepo: Repository<WorkflowRule>,
        @InjectRepository(WorkflowExecution)
        private readonly executionRepo: Repository<WorkflowExecution>,
    ) { }

    /**
     * Get all rules (excluding soft-deleted)
     */
    async findAll(): Promise<WorkflowRuleResponseDto[]> {
        const rules = await this.ruleRepo.find({
            where: { deletedAt: IsNull() },
            order: { priority: 'ASC', createdAt: 'DESC' },
            relations: ['createdBy'],
        });

        return rules.map(this.toResponseDto);
    }

    /**
     * Get active rules only
     */
    async findActive(): Promise<WorkflowRule[]> {
        return this.ruleRepo.find({
            where: { isActive: true, deletedAt: IsNull() },
            order: { priority: 'ASC' },
        });
    }

    /**
     * Get rule by ID
     */
    async findById(id: string): Promise<WorkflowRuleResponseDto> {
        const rule = await this.ruleRepo.findOne({
            where: { id, deletedAt: IsNull() },
            relations: ['createdBy'],
        });

        if (!rule) {
            throw new NotFoundException(`Workflow rule not found: ${id}`);
        }

        return this.toResponseDto(rule);
    }

    /**
     * Create new rule
     */
    async create(dto: CreateWorkflowRuleDto, userId: string): Promise<WorkflowRuleResponseDto> {
        // Get next priority if not specified
        const priority = dto.priority ?? await this.getNextPriority();

        const rule = this.ruleRepo.create({
            name: dto.name,
            description: dto.description,
            isActive: dto.isActive ?? true,
            priority,
            trigger: dto.trigger,
            conditions: dto.conditions || [],
            conditionLogic: dto.conditionLogic || 'AND',
            actions: dto.actions,
            stopProcessing: dto.stopProcessing ?? false,
            createdById: userId,
        });

        const saved = await this.ruleRepo.save(rule);
        this.logger.log(`Created workflow rule: ${saved.name} (${saved.id})`);

        return this.toResponseDto(saved);
    }

    /**
     * Update rule
     */
    async update(id: string, dto: UpdateWorkflowRuleDto, userId?: string): Promise<WorkflowRuleResponseDto> {
        const rule = await this.ruleRepo.findOne({
            where: { id, deletedAt: IsNull() },
        });

        if (!rule) {
            throw new NotFoundException(`Workflow rule not found: ${id}`);
        }

        Object.assign(rule, {
            name: dto.name ?? rule.name,
            description: dto.description ?? rule.description,
            isActive: dto.isActive ?? rule.isActive,
            priority: dto.priority ?? rule.priority,
            trigger: dto.trigger ?? rule.trigger,
            conditions: dto.conditions ?? rule.conditions,
            conditionLogic: dto.conditionLogic ?? rule.conditionLogic,
            actions: dto.actions ?? rule.actions,
            stopProcessing: dto.stopProcessing ?? rule.stopProcessing,
        });

        const saved = await this.ruleRepo.save(rule);
        this.logger.log(`Updated workflow rule: ${saved.name} (${saved.id})`);

        return this.toResponseDto(saved);
    }

    /**
     * Soft delete rule
     */
    async delete(id: string, userId?: string): Promise<void> {
        const rule = await this.ruleRepo.findOne({
            where: { id, deletedAt: IsNull() },
        });

        if (!rule) {
            throw new NotFoundException(`Workflow rule not found: ${id}`);
        }

        await this.ruleRepo.update(id, { deletedAt: new Date() });
        this.logger.log(`Deleted workflow rule: ${rule.name} (${id})`);
    }

    /**
     * Toggle rule active status
     */
    async toggleActive(id: string, userId?: string): Promise<WorkflowRuleResponseDto> {
        const rule = await this.ruleRepo.findOne({
            where: { id, deletedAt: IsNull() },
        });

        if (!rule) {
            throw new NotFoundException(`Workflow rule not found: ${id}`);
        }

        rule.isActive = !rule.isActive;
        const saved = await this.ruleRepo.save(rule);

        this.logger.log(`Toggled rule "${rule.name}" active: ${saved.isActive}`);

        if (userId) {
            this.auditService.logAsync({
                userId,
                action: AuditAction.AUTOMATION_TOGGLE,
                entityType: 'WorkflowRule',
                entityId: saved.id,
                description: `Toggled workflow rule: ${saved.name} (${saved.isActive ? 'Active' : 'Inactive'})`,
                newValue: { isActive: saved.isActive },
            });
        }

        return this.toResponseDto(saved);
    }

    /**
     * Reorder rules
     */
    async reorder(orderedIds: string[]): Promise<void> {
        for (let i = 0; i < orderedIds.length; i++) {
            await this.ruleRepo.update(orderedIds[i], { priority: i + 1 });
        }
        this.logger.log(`Reordered ${orderedIds.length} workflow rules`);
    }

    /**
     * Get execution history for a rule
     */
    async getExecutions(ruleId: string, limit: number = 50): Promise<WorkflowExecution[]> {
        return this.executionRepo.find({
            where: { ruleId },
            order: { executedAt: 'DESC' },
            take: limit,
        });
    }

    /**
     * Get all executions (for admin view)
     */
    async getAllExecutions(limit: number = 100): Promise<WorkflowExecution[]> {
        return this.executionRepo.find({
            order: { executedAt: 'DESC' },
            take: limit,
        });
    }

    /**
     * Get executions for a ticket
     */
    async getTicketExecutions(ticketId: string): Promise<WorkflowExecution[]> {
        return this.executionRepo.find({
            where: { ticketId },
            order: { executedAt: 'DESC' },
        });
    }

    /**
     * Get available templates
     */
    getTemplates(): WorkflowTemplate[] {
        return WORKFLOW_TEMPLATES;
    }

    /**
     * Create rule from template
     */
    async createFromTemplate(templateId: string, userId: string): Promise<WorkflowRuleResponseDto> {
        const template = WORKFLOW_TEMPLATES.find(t => t.id === templateId);
        if (!template) {
            throw new NotFoundException(`Template not found: ${templateId}`);
        }

        const dto: CreateWorkflowRuleDto = {
            name: template.rule.name,
            description: template.description,
            trigger: template.rule.trigger,
            conditions: template.rule.conditions,
            conditionLogic: template.rule.conditionLogic,
            actions: template.rule.actions,
            stopProcessing: template.rule.stopProcessing,
            isActive: false, // Start disabled so user can configure
        };

        return this.create(dto, userId);
    }

    /**
     * Get next priority number
     */
    private async getNextPriority(): Promise<number> {
        const maxRule = await this.ruleRepo.findOne({
            where: { deletedAt: IsNull() },
            order: { priority: 'DESC' },
        });

        return (maxRule?.priority || 0) + 10;
    }

    /**
     * Convert entity to response DTO
     */
    private toResponseDto(rule: WorkflowRule): WorkflowRuleResponseDto {
        return {
            id: rule.id,
            name: rule.name,
            description: rule.description,
            isActive: rule.isActive,
            priority: rule.priority,
            trigger: rule.trigger,
            conditions: rule.conditions,
            conditionLogic: rule.conditionLogic,
            actions: rule.actions,
            stopProcessing: rule.stopProcessing,
            executionCount: rule.executionCount,
            lastExecutedAt: rule.lastExecutedAt,
            createdBy: rule.createdBy ? {
                id: rule.createdBy.id,
                fullName: rule.createdBy.fullName,
            } : null,
            createdAt: rule.createdAt,
            updatedAt: rule.updatedAt,
        };
    }
}
