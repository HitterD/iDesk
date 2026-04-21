import { IsString, IsBoolean, IsOptional, IsArray, IsNumber, IsObject, ValidateNested, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { WorkflowTrigger, WorkflowCondition, WorkflowAction, TriggerType } from '../types/workflow.types';

/**
 * DTO for creating a workflow rule
 */
export class CreateWorkflowRuleDto {
    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @IsOptional()
    @IsNumber()
    priority?: number;

    @IsObject()
    trigger: WorkflowTrigger;

    @IsOptional()
    @IsArray()
    conditions?: WorkflowCondition[];

    @IsOptional()
    @IsEnum(['AND', 'OR'])
    conditionLogic?: 'AND' | 'OR';

    @IsArray()
    actions: WorkflowAction[];

    @IsOptional()
    @IsBoolean()
    stopProcessing?: boolean;
}

/**
 * DTO for updating a workflow rule
 */
export class UpdateWorkflowRuleDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @IsOptional()
    @IsNumber()
    priority?: number;

    @IsOptional()
    @IsObject()
    trigger?: WorkflowTrigger;

    @IsOptional()
    @IsArray()
    conditions?: WorkflowCondition[];

    @IsOptional()
    @IsEnum(['AND', 'OR'])
    conditionLogic?: 'AND' | 'OR';

    @IsOptional()
    @IsArray()
    actions?: WorkflowAction[];

    @IsOptional()
    @IsBoolean()
    stopProcessing?: boolean;
}

/**
 * DTO for reordering rules
 */
export class ReorderRulesDto {
    @IsArray()
    @IsString({ each: true })
    orderedIds: string[];
}

/**
 * DTO for creating rule from template
 */
export class CreateFromTemplateDto {
    @IsString()
    templateId: string;
}

/**
 * DTO for testing a rule
 */
export class TestRuleDto {
    @IsString()
    ticketId: string;
}

/**
 * Response DTO for workflow rule
 */
export class WorkflowRuleResponseDto {
    id: string;
    name: string;
    description: string | null;
    isActive: boolean;
    priority: number;
    trigger: WorkflowTrigger;
    conditions: WorkflowCondition[];
    conditionLogic: 'AND' | 'OR';
    actions: WorkflowAction[];
    stopProcessing: boolean;
    executionCount: number;
    lastExecutedAt: Date | null;
    createdBy: { id: string; fullName: string } | null;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Response DTO for execution log
 */
export class WorkflowExecutionResponseDto {
    id: string;
    ruleId: string;
    ruleName: string;
    ticketId: string;
    ticketNumber: string;
    triggerEvent: TriggerType;
    conditionsMet: boolean;
    actionsExecuted: any[];
    durationMs: number;
    error: string | null;
    executedAt: Date;
}
