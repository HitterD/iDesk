import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { WorkflowEngineService } from '../services/workflow-engine.service';
import { TriggerType } from '../types/workflow.types';

/**
 * Ticket Workflow Listener
 * Listens to ticket events and triggers workflow processing
 */
@Injectable()
export class TicketWorkflowListener {
    private readonly logger = new Logger(TicketWorkflowListener.name);

    constructor(private readonly workflowEngine: WorkflowEngineService) { }

    /**
     * Handle ticket created event
     */
    @OnEvent('ticket.created')
    async handleTicketCreated(event: { ticketId: string; userId?: string }) {
        this.logger.debug(`Ticket created event: ${event.ticketId}`);
        await this.workflowEngine.trigger(TriggerType.TICKET_CREATED, event.ticketId, {
            triggeredBy: event.userId,
        });
    }

    /**
     * Handle ticket updated event
     */
    @OnEvent('ticket.updated')
    async handleTicketUpdated(event: {
        ticketId: string;
        userId?: string;
        changes?: {
            status?: { from: string; to: string };
            priority?: { from: string; to: string };
            assignee?: { from: string; to: string };
        };
    }) {
        this.logger.debug(`Ticket updated event: ${event.ticketId}`, event.changes);

        // Trigger specific events based on what changed
        if (event.changes?.status) {
            await this.workflowEngine.trigger(TriggerType.STATUS_CHANGED, event.ticketId, {
                triggeredBy: event.userId,
                previousValues: { status: event.changes.status.from },
                currentValues: { status: event.changes.status.to },
            });
        }

        if (event.changes?.priority) {
            await this.workflowEngine.trigger(TriggerType.PRIORITY_CHANGED, event.ticketId, {
                triggeredBy: event.userId,
                previousValues: { priority: event.changes.priority.from },
                currentValues: { priority: event.changes.priority.to },
            });
        }

        if (event.changes?.assignee) {
            await this.workflowEngine.trigger(TriggerType.ASSIGNMENT_CHANGED, event.ticketId, {
                triggeredBy: event.userId,
                previousValues: { assignee: event.changes.assignee.from },
                currentValues: { assignee: event.changes.assignee.to },
            });
        }

        // Also trigger generic updated event
        await this.workflowEngine.trigger(TriggerType.TICKET_UPDATED, event.ticketId, {
            triggeredBy: event.userId,
        });
    }

    /**
     * Handle message received event
     */
    @OnEvent('ticket.message')
    async handleMessageReceived(event: {
        ticketId: string;
        messageId: string;
        userId?: string;
        isInternal?: boolean;
    }) {
        // Skip internal notes for workflow triggers
        if (event.isInternal) return;

        this.logger.debug(`Message received event: ${event.ticketId}`);
        await this.workflowEngine.trigger(TriggerType.MESSAGE_RECEIVED, event.ticketId, {
            triggeredBy: event.userId,
        });
    }

    /**
     * Handle SLA breach imminent
     */
    @OnEvent('ticket.sla.warning')
    async handleSlaWarning(event: { ticketId: string; minutesRemaining: number }) {
        this.logger.debug(`SLA warning event: ${event.ticketId}, ${event.minutesRemaining} min remaining`);
        await this.workflowEngine.trigger(TriggerType.SLA_BREACH_IMMINENT, event.ticketId);
    }

    /**
     * Handle SLA breached
     */
    @OnEvent('ticket.sla.breached')
    async handleSlaBreached(event: { ticketId: string }) {
        this.logger.debug(`SLA breached event: ${event.ticketId}`);
        await this.workflowEngine.trigger(TriggerType.SLA_BREACHED, event.ticketId);
    }

    /**
     * Handle ticket idle
     */
    @OnEvent('ticket.idle')
    async handleTicketIdle(event: { ticketId: string; idleMinutes: number }) {
        this.logger.debug(`Ticket idle event: ${event.ticketId}, ${event.idleMinutes} min idle`);
        await this.workflowEngine.trigger(TriggerType.TICKET_IDLE, event.ticketId);
    }
}
