/**
 * Workflow Automation Types (Frontend)
 * Mirrors backend types for type safety
 */

export enum TriggerType {
    TICKET_CREATED = 'TICKET_CREATED',
    TICKET_UPDATED = 'TICKET_UPDATED',
    STATUS_CHANGED = 'STATUS_CHANGED',
    PRIORITY_CHANGED = 'PRIORITY_CHANGED',
    ASSIGNMENT_CHANGED = 'ASSIGNMENT_CHANGED',
    MESSAGE_RECEIVED = 'MESSAGE_RECEIVED',
    SLA_BREACH_IMMINENT = 'SLA_BREACH_IMMINENT',
    SLA_BREACHED = 'SLA_BREACHED',
    TICKET_IDLE = 'TICKET_IDLE',
}

export enum ConditionOperator {
    EQUALS = 'EQUALS',
    NOT_EQUALS = 'NOT_EQUALS',
    CONTAINS = 'CONTAINS',
    NOT_CONTAINS = 'NOT_CONTAINS',
    STARTS_WITH = 'STARTS_WITH',
    ENDS_WITH = 'ENDS_WITH',
    GREATER_THAN = 'GREATER_THAN',
    LESS_THAN = 'LESS_THAN',
    IN = 'IN',
    NOT_IN = 'NOT_IN',
    IS_EMPTY = 'IS_EMPTY',
    IS_NOT_EMPTY = 'IS_NOT_EMPTY',
}

export enum ActionType {
    CHANGE_STATUS = 'CHANGE_STATUS',
    CHANGE_PRIORITY = 'CHANGE_PRIORITY',
    CHANGE_ASSIGNEE = 'CHANGE_ASSIGNEE',
    ADD_INTERNAL_NOTE = 'ADD_INTERNAL_NOTE',
    SEND_NOTIFICATION = 'SEND_NOTIFICATION',
    SEND_EMAIL = 'SEND_EMAIL',
    SEND_WEBHOOK = 'SEND_WEBHOOK',
    ADD_TAG = 'ADD_TAG',
}

export interface WorkflowTrigger {
    type: TriggerType;
    config?: {
        idleMinutes?: number;
        warningMinutes?: number;
        fromStatus?: string;
        toStatus?: string;
    };
}

export interface WorkflowCondition {
    field: string;
    operator: ConditionOperator;
    value: any;
    logicalOperator?: 'AND' | 'OR';
}

export interface WorkflowAction {
    type: ActionType;
    config: {
        status?: string;
        priority?: string;
        assigneeId?: string;
        assignmentType?: 'SPECIFIC_USER' | 'ROUND_ROBIN' | 'LEAST_BUSY';
        noteContent?: string;
        message?: string;
        subject?: string;
        webhookUrl?: string;
        webhookMethod?: 'POST' | 'PUT' | 'PATCH';
        recipientType?: 'TICKET_OWNER' | 'ASSIGNEE' | 'SPECIFIC_USER' | 'ROLE' | 'ALL_AGENTS';
        recipientId?: string;
    };
    order?: number;
}

export interface WorkflowRule {
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
    lastExecutedAt: string | null;
    createdBy: { id: string; fullName: string } | null;
    createdAt: string;
    updatedAt: string;
}

export interface WorkflowExecution {
    id: string;
    ruleId: string;
    ruleName: string;
    ticketId: string;
    ticketNumber: string;
    triggerEvent: TriggerType;
    conditionsMet: boolean;
    actionsExecuted: {
        type: ActionType;
        success: boolean;
        error?: string;
    }[];
    durationMs: number;
    error: string | null;
    executedAt: string;
}

export interface WorkflowTemplate {
    id: string;
    name: string;
    description: string;
    category: 'assignment' | 'escalation' | 'notification' | 'automation';
    rule: Omit<WorkflowRule, 'id' | 'isActive' | 'priority' | 'executionCount' | 'lastExecutedAt' | 'createdBy' | 'createdAt' | 'updatedAt'>;
}
