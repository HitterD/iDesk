import { Injectable, Logger, Inject, forwardRef, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket } from '../../ticketing/entities/ticket.entity';
import { User } from '../../users/entities/user.entity';
import { TicketMessage } from '../../ticketing/entities/ticket-message.entity';
import { WorkflowAction, ActionType, AssignmentType, NotificationRecipient } from '../types/workflow.types';
import { UserRole } from '../../users/enums/user-role.enum';
import { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * ActionExecutor Service
 * Executes workflow actions on tickets
 */
@Injectable()
export class ActionExecutorService {
    private readonly logger = new Logger(ActionExecutorService.name);

    // Round-robin index tracking per rule
    private roundRobinIndex: Map<string, number> = new Map();

    constructor(
        @InjectRepository(Ticket)
        private readonly ticketRepo: Repository<Ticket>,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(TicketMessage)
        private readonly messageRepo: Repository<TicketMessage>,
        private readonly eventEmitter: EventEmitter2,
    ) { }

    /**
     * Execute a single action
     */
    async executeAction(
        action: WorkflowAction,
        ticket: Ticket,
        ruleId?: string,
    ): Promise<{ success: boolean; error?: string; result?: any }> {
        try {
            this.logger.debug(`Executing action: ${action.type}`, { ticketId: ticket.id, config: action.config });

            let result: any;

            switch (action.type) {
                case ActionType.CHANGE_STATUS:
                    result = await this.changeStatus(ticket, action.config.status!);
                    break;

                case ActionType.CHANGE_PRIORITY:
                    result = await this.changePriority(ticket, action.config.priority!);
                    break;

                case ActionType.CHANGE_ASSIGNEE:
                    result = await this.changeAssignee(ticket, action.config, ruleId as string);
                    break;

                case ActionType.ADD_INTERNAL_NOTE:
                    result = await this.addInternalNote(ticket, action.config.noteContent!);
                    break;

                case ActionType.SEND_NOTIFICATION:
                    result = await this.sendNotification(ticket, action.config);
                    break;

                case ActionType.SEND_WEBHOOK:
                    result = await this.sendWebhook(ticket, action.config);
                    break;

                case ActionType.SEND_EMAIL:
                    result = await this.sendEmail(ticket, action.config);
                    break;

                case ActionType.ADD_TAG:
                    // Tags not implemented yet, log for future
                    this.logger.log(`ADD_TAG action: ${action.config.tag}`);
                    result = { tag: action.config.tag };
                    break;

                default:
                    throw new Error(`Unknown action type: ${action.type}`);
            }

            return { success: true, result };
        } catch (error) {
            this.logger.error(`Failed to execute action ${action.type}: ${error.message}`, error.stack);
            return { success: false, error: error.message };
        }
    }

    /**
     * Execute multiple actions in order
     */
    async executeActions(
        actions: WorkflowAction[],
        ticket: Ticket,
        ruleId?: string,
    ): Promise<{ type: ActionType; success: boolean; error?: string; result?: any }[]> {
        const sortedActions = [...actions].sort((a, b) => (a.order || 0) - (b.order || 0));
        const results = [];

        for (const action of sortedActions) {
            const result = await this.executeAction(action, ticket, ruleId as string);
            results.push({
                type: action.type,
                ...result,
            });

            // If action failed and is critical, consider stopping
            // For now, continue with other actions
        }

        return results;
    }

    // ============================================
    // ACTION IMPLEMENTATIONS
    // ============================================

    private async changeStatus(ticket: Ticket, status: string): Promise<any> {
        const oldStatus = ticket.status;
        await this.ticketRepo.update(ticket.id, { status: status as any });

        this.logger.log(`Workflow: Changed status from ${oldStatus} to ${status} for ticket ${ticket.ticketNumber}`);

        return { oldStatus, newStatus: status };
    }

    private async changePriority(ticket: Ticket, priority: string): Promise<any> {
        const oldPriority = ticket.priority;
        await this.ticketRepo.update(ticket.id, { priority: priority as any });

        this.logger.log(`Workflow: Changed priority from ${oldPriority} to ${priority} for ticket ${ticket.ticketNumber}`);

        return { oldPriority, newPriority: priority };
    }

    private async changeAssignee(
        ticket: Ticket,
        config: WorkflowAction['config'],
        ruleId?: string,
    ): Promise<any> {
        let newAssigneeId: string;

        switch (config.assignmentType) {
            case AssignmentType.SPECIFIC_USER:
                newAssigneeId = config.assigneeId!;
                break;

            case AssignmentType.ROUND_ROBIN:
                newAssigneeId = await this.getNextRoundRobinAgent(config.assignmentPool!, ruleId as string);
                break;

            case AssignmentType.LEAST_BUSY:
                newAssigneeId = await this.getLeastBusyAgent(config.assignmentPool);
                break;

            default:
                newAssigneeId = config.assigneeId!;
        }

        if (!newAssigneeId) {
            throw new Error('No assignee available for assignment');
        }

        const oldAssigneeId = ticket.assignedToId;
        await this.ticketRepo.update(ticket.id, { assignedToId: newAssigneeId });

        this.logger.log(`Workflow: Assigned ticket ${ticket.ticketNumber} to ${newAssigneeId}`);

        return { oldAssigneeId, newAssigneeId, assignmentType: config.assignmentType };
    }

    private async getNextRoundRobinAgent(pool: string[] | undefined, ruleId: string): Promise<string> {
        // Get available agents
        let agents: User[];
        if (pool && pool.length > 0) {
            agents = await this.userRepo.findBy({ id: (id: any) => pool.includes(id as any) } as any);
        } else {
            agents = await this.userRepo.find({ where: { role: UserRole.AGENT } });
        }

        if (agents.length === 0) {
            // Fallback to any admin
            const admins = await this.userRepo.find({ where: { role: UserRole.ADMIN }, take: 1 });
            if (admins.length > 0) return admins[0].id;
            throw new Error('No agents available for round-robin');
        }

        // Get current index for this rule
        const currentIndex = this.roundRobinIndex.get(ruleId) || 0;
        const nextIndex = (currentIndex + 1) % agents.length;
        this.roundRobinIndex.set(ruleId, nextIndex);

        return agents[nextIndex].id;
    }

    private async getLeastBusyAgent(pool: string[] | undefined): Promise<string> {
        // Query agent with least open tickets
        const qb = this.ticketRepo
            .createQueryBuilder('t')
            .select('t.assignedToId', 'agentId')
            .addSelect('COUNT(*)', 'ticketCount')
            .where('t.status NOT IN (:...closedStatuses)', { closedStatuses: ['RESOLVED', 'CANCELLED'] })
            .andWhere('t.assignedToId IS NOT NULL')
            .groupBy('t.assignedToId')
            .orderBy('COUNT(*)', 'ASC');

        if (pool && pool.length > 0) {
            qb.andWhere('t.assignedToId IN (:...pool)', { pool });
        }

        const results = await qb.getRawMany();

        if (results.length > 0) {
            return results[0].agentId;
        }

        // No tickets assigned yet, get first agent
        const agents = await this.userRepo.find({
            where: { role: UserRole.AGENT },
            take: 1
        });

        if (agents.length > 0) return agents[0].id;

        throw new Error('No agents available');
    }

    private async addInternalNote(ticket: Ticket, content: string): Promise<any> {
        // Replace template variables
        const processedContent = this.processTemplate(content, ticket);

        const message = this.messageRepo.create({
            ticketId: ticket.id,
            content: `[Automation] ${processedContent}`,
            isInternal: true,
            isSystemMessage: true,
        });

        await this.messageRepo.save(message);

        this.logger.log(`Workflow: Added internal note to ticket ${ticket.ticketNumber}`);

        return { messageId: message.id };
    }

    private async sendNotification(ticket: Ticket, config: WorkflowAction['config']): Promise<any> {
        const recipients = await this.resolveRecipients(ticket, config);
        const message = this.processTemplate(config.message || '', ticket);

        // Emit notification event
        for (const recipient of recipients) {
            this.eventEmitter.emit('notification.send', {
                userId: recipient.id,
                type: config.notificationType || 'IN_APP',
                title: `Workflow Notification`,
                message,
                ticketId: ticket.id,
            });
        }

        this.logger.log(`Workflow: Sent notification to ${recipients.length} recipients`);

        return { recipientCount: recipients.length, recipients: recipients.map(r => r.id) };
    }

    private async resolveRecipients(ticket: Ticket, config: WorkflowAction['config']): Promise<User[]> {
        const recipients: User[] = [];

        switch (config.recipientType) {
            case NotificationRecipient.TICKET_OWNER:
                if (ticket.userId) {
                    const owner = await this.userRepo.findOne({ where: { id: ticket.userId } });
                    if (owner) recipients.push(owner);
                }
                break;

            case NotificationRecipient.ASSIGNEE:
                if (ticket.assignedToId) {
                    const assignee = await this.userRepo.findOne({ where: { id: ticket.assignedToId } });
                    if (assignee) recipients.push(assignee);
                }
                break;

            case NotificationRecipient.SPECIFIC_USER:
                if (config.recipientId) {
                    const user = await this.userRepo.findOne({ where: { id: config.recipientId } });
                    if (user) recipients.push(user);
                }
                break;

            case NotificationRecipient.ROLE:
                const roleUsers = await this.userRepo.find({
                    where: { role: config.recipientRole as any }
                });
                recipients.push(...roleUsers);
                break;

            case NotificationRecipient.ALL_AGENTS:
                const agents = await this.userRepo.find({
                    where: [{ role: UserRole.AGENT }, { role: UserRole.ADMIN }]
                });
                recipients.push(...agents);
                break;
        }

        return recipients;
    }

    private async sendWebhook(ticket: Ticket, config: WorkflowAction['config']): Promise<any> {
        if (!config.webhookUrl) {
            throw new Error('Webhook URL is required');
        }

        const body = config.webhookBody
            ? this.processTemplate(config.webhookBody, ticket)
            : JSON.stringify({
                event: 'workflow_triggered',
                ticket: {
                    id: ticket.id,
                    ticketNumber: ticket.ticketNumber,
                    title: ticket.title,
                    status: ticket.status,
                    priority: ticket.priority,
                },
                timestamp: new Date().toISOString(),
            });

        try {
            const response = await fetch(config.webhookUrl, {
                method: config.webhookMethod || 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...config.webhookHeaders,
                },
                body,
            });

            this.logger.log(`Workflow: Webhook sent to ${config.webhookUrl}, status: ${response.status}`);

            return {
                status: response.status,
                ok: response.ok,
                url: config.webhookUrl
            };
        } catch (error) {
            throw new Error(`Webhook failed: ${error.message}`);
        }
    }

    private async sendEmail(ticket: Ticket, config: WorkflowAction['config']): Promise<any> {
        // Emit email event (handled by notification module)
        const subject = this.processTemplate(config.subject || 'Ticket Update', ticket);
        const message = this.processTemplate(config.message || '', ticket);

        this.eventEmitter.emit('email.send', {
            ticketId: ticket.id,
            subject,
            body: message,
            recipientType: config.recipientType,
            recipientId: config.recipientId,
        });

        return { emailQueued: true };
    }

    /**
     * Process template variables like {{ticket.title}}
     */
    private processTemplate(template: string, ticket: Ticket): string {
        if (!template) return '';

        return template.replace(/\{\{(\w+)\.(\w+)\}\}/g, (match, obj, field) => {
            if (obj === 'ticket') {
                const value = (ticket as any)[field];
                return value !== undefined ? String(value) : match;
            }
            return match;
        });
    }
}
