/**
 * Workflow Automation Types
 * Defines the structure for triggers, conditions, and actions
 */

// ============================================
// TRIGGER TYPES
// ============================================

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

export interface WorkflowTrigger {
    type: TriggerType;
    config?: {
        // For TICKET_IDLE - minutes of inactivity
        idleMinutes?: number;
        // For SLA_BREACH_IMMINENT - minutes before breach
        warningMinutes?: number;
        // For STATUS_CHANGED - specific statuses
        fromStatus?: string;
        toStatus?: string;
    };
}

// ============================================
// CONDITION TYPES
// ============================================

export enum ConditionOperator {
    EQUALS = 'EQUALS',
    NOT_EQUALS = 'NOT_EQUALS',
    CONTAINS = 'CONTAINS',
    NOT_CONTAINS = 'NOT_CONTAINS',
    STARTS_WITH = 'STARTS_WITH',
    ENDS_WITH = 'ENDS_WITH',
    GREATER_THAN = 'GREATER_THAN',
    LESS_THAN = 'LESS_THAN',
    GREATER_OR_EQUAL = 'GREATER_OR_EQUAL',
    LESS_OR_EQUAL = 'LESS_OR_EQUAL',
    IN = 'IN',
    NOT_IN = 'NOT_IN',
    IS_EMPTY = 'IS_EMPTY',
    IS_NOT_EMPTY = 'IS_NOT_EMPTY',
    MATCHES_REGEX = 'MATCHES_REGEX',
}

export enum ConditionField {
    STATUS = 'status',
    PRIORITY = 'priority',
    CATEGORY = 'category',
    ASSIGNEE_ID = 'assignedToId',
    REQUESTER_ID = 'userId',
    REQUESTER_DEPARTMENT = 'user.department.name',
    TITLE = 'title',
    DESCRIPTION = 'description',
    DEVICE = 'device',
    SOURCE = 'source',
    IS_OVERDUE = 'isOverdue',
    HAS_ASSIGNEE = 'hasAssignee',
}

export interface WorkflowCondition {
    field: string;
    operator: ConditionOperator;
    value: any;
    // For grouping conditions
    logicalOperator?: 'AND' | 'OR';
}

export interface ConditionGroup {
    operator: 'AND' | 'OR';
    conditions: WorkflowCondition[];
}

// ============================================
// ACTION TYPES
// ============================================

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

export enum AssignmentType {
    SPECIFIC_USER = 'SPECIFIC_USER',
    ROUND_ROBIN = 'ROUND_ROBIN',
    LEAST_BUSY = 'LEAST_BUSY',
}

export enum NotificationRecipient {
    TICKET_OWNER = 'TICKET_OWNER',
    ASSIGNEE = 'ASSIGNEE',
    SPECIFIC_USER = 'SPECIFIC_USER',
    ROLE = 'ROLE',
    ALL_AGENTS = 'ALL_AGENTS',
}

export interface WorkflowAction {
    type: ActionType;
    config: {
        // For CHANGE_STATUS
        status?: string;

        // For CHANGE_PRIORITY
        priority?: string;

        // For CHANGE_ASSIGNEE
        assigneeId?: string;
        assignmentType?: AssignmentType;
        assignmentPool?: string[]; // User IDs for round-robin

        // For ADD_INTERNAL_NOTE
        noteContent?: string;

        // For SEND_NOTIFICATION
        notificationType?: 'EMAIL' | 'IN_APP' | 'TELEGRAM' | 'ALL';
        recipientType?: NotificationRecipient;
        recipientId?: string;
        recipientRole?: string;
        message?: string;
        subject?: string;

        // For SEND_WEBHOOK
        webhookUrl?: string;
        webhookMethod?: 'POST' | 'PUT' | 'PATCH';
        webhookHeaders?: Record<string, string>;
        webhookBody?: string; // Template with {{ticket.field}} placeholders

        // For ADD_TAG
        tag?: string;
    };
    // Execution order within the rule
    order?: number;
}

// ============================================
// WORKFLOW RULE
// ============================================

export interface WorkflowRuleDefinition {
    name: string;
    description?: string;
    isActive: boolean;
    priority: number; // Lower = higher priority
    trigger: WorkflowTrigger;
    conditions: WorkflowCondition[];
    conditionLogic?: 'AND' | 'OR'; // How to combine conditions
    actions: WorkflowAction[];
    // Stop processing subsequent rules after this rule matches
    stopProcessing?: boolean;
}

// ============================================
// EXECUTION CONTEXT
// ============================================

export interface WorkflowExecutionContext {
    ticketId: string;
    ticketNumber: string;
    triggerEvent: TriggerType;
    previousValues?: Record<string, any>;
    currentValues?: Record<string, any>;
    triggeredBy?: string; // User ID who triggered the event
    timestamp: Date;
}

export interface WorkflowExecutionResult {
    ruleId: string;
    ruleName: string;
    conditionsMet: boolean;
    actionsExecuted: {
        type: ActionType;
        success: boolean;
        error?: string;
        result?: any;
    }[];
    executionTimeMs: number;
}

// ============================================
// RULE TEMPLATES
// ============================================

export interface WorkflowTemplate {
    id: string;
    name: string;
    description: string;
    category: 'assignment' | 'escalation' | 'notification' | 'automation';
    rule: Omit<WorkflowRuleDefinition, 'isActive' | 'priority'>;
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
    {
        id: 'tpl-high-priority-assign',
        name: 'Auto-assign HIGH priority tickets',
        description: 'Automatically assign HIGH priority tickets to senior support',
        category: 'assignment',
        rule: {
            name: 'Auto-assign HIGH Priority',
            trigger: { type: TriggerType.TICKET_CREATED },
            conditions: [
                { field: ConditionField.PRIORITY, operator: ConditionOperator.EQUALS, value: 'HIGH' }
            ],
            actions: [
                { type: ActionType.CHANGE_ASSIGNEE, config: { assignmentType: AssignmentType.LEAST_BUSY } },
                { type: ActionType.SEND_NOTIFICATION, config: { recipientType: NotificationRecipient.ASSIGNEE, message: 'High priority ticket assigned to you: {{ticket.title}}' } }
            ]
        }
    },
    {
        id: 'tpl-sla-warning',
        name: 'SLA Breach Warning',
        description: 'Send alert when ticket is about to breach SLA',
        category: 'escalation',
        rule: {
            name: 'SLA Breach Warning',
            trigger: { type: TriggerType.SLA_BREACH_IMMINENT, config: { warningMinutes: 30 } },
            conditions: [],
            actions: [
                { type: ActionType.SEND_NOTIFICATION, config: { recipientType: NotificationRecipient.ASSIGNEE, message: '⚠️ SLA Warning: Ticket {{ticket.ticketNumber}} will breach in 30 minutes!' } },
                { type: ActionType.ADD_INTERNAL_NOTE, config: { noteContent: 'SLA breach warning triggered automatically' } }
            ]
        }
    },
    {
        id: 'tpl-auto-escalate',
        name: 'Auto-escalate Overdue Tickets',
        description: 'Change priority to CRITICAL when SLA is breached',
        category: 'escalation',
        rule: {
            name: 'Auto-escalate Overdue',
            trigger: { type: TriggerType.SLA_BREACHED },
            conditions: [],
            actions: [
                { type: ActionType.CHANGE_PRIORITY, config: { priority: 'CRITICAL' } },
                { type: ActionType.SEND_NOTIFICATION, config: { recipientType: NotificationRecipient.ROLE, recipientRole: 'ADMIN', message: '🚨 SLA Breached: Ticket {{ticket.ticketNumber}} - {{ticket.title}}' } }
            ]
        }
    },
    {
        id: 'tpl-network-routing',
        name: 'Route Network Tickets',
        description: 'Auto-assign NETWORK category tickets to network team',
        category: 'assignment',
        rule: {
            name: 'Network Ticket Routing',
            trigger: { type: TriggerType.TICKET_CREATED },
            conditions: [
                { field: ConditionField.CATEGORY, operator: ConditionOperator.EQUALS, value: 'NETWORK' }
            ],
            actions: [
                { type: ActionType.CHANGE_ASSIGNEE, config: { assignmentType: AssignmentType.ROUND_ROBIN } }
            ]
        }
    },
    {
        id: 'tpl-idle-reminder',
        name: 'Idle Ticket Reminder',
        description: 'Notify assignee when ticket is idle for 24 hours',
        category: 'notification',
        rule: {
            name: 'Idle Ticket Reminder',
            trigger: { type: TriggerType.TICKET_IDLE, config: { idleMinutes: 1440 } },
            conditions: [
                { field: ConditionField.STATUS, operator: ConditionOperator.NOT_EQUALS, value: 'RESOLVED' }
            ],
            actions: [
                { type: ActionType.SEND_NOTIFICATION, config: { recipientType: NotificationRecipient.ASSIGNEE, message: '⏰ Reminder: Ticket {{ticket.ticketNumber}} has been idle for 24 hours' } }
            ]
        }
    }
];
