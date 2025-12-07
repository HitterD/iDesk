import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { WorkflowRule } from '../entities/workflow-rule.entity';
import { WorkflowExecution } from '../entities/workflow-execution.entity';
import { Ticket } from '../../ticketing/entities/ticket.entity';
import { TriggerType, WorkflowExecutionContext, WorkflowExecutionResult } from '../types/workflow.types';
import { ConditionEvaluatorService } from './condition-evaluator.service';
import { ActionExecutorService } from './action-executor.service';

/**
 * WorkflowEngine Service
 * Core engine that processes workflow rules on ticket events
 */
@Injectable()
export class WorkflowEngineService {
    private readonly logger = new Logger(WorkflowEngineService.name);

    // Track currently executing tickets to prevent loops
    private executingTickets: Set<string> = new Set();

    constructor(
        @InjectRepository(WorkflowRule)
        private readonly ruleRepo: Repository<WorkflowRule>,
        @InjectRepository(WorkflowExecution)
        private readonly executionRepo: Repository<WorkflowExecution>,
        @InjectRepository(Ticket)
        private readonly ticketRepo: Repository<Ticket>,
        private readonly conditionEvaluator: ConditionEvaluatorService,
        private readonly actionExecutor: ActionExecutorService,
    ) { }

    /**
     * Trigger workflow processing for an event
     */
    async trigger(
        triggerType: TriggerType,
        ticketId: string,
        context?: Partial<WorkflowExecutionContext>,
    ): Promise<WorkflowExecutionResult[]> {
        // Prevent infinite loops
        const executionKey = `${ticketId}-${triggerType}`;
        if (this.executingTickets.has(executionKey)) {
            this.logger.warn(`Skipping workflow to prevent loop: ${executionKey}`);
            return [];
        }

        this.executingTickets.add(executionKey);
        const results: WorkflowExecutionResult[] = [];

        try {
            // Get ticket with relations
            const ticket = await this.ticketRepo.findOne({
                where: { id: ticketId },
                relations: ['user', 'user.department', 'assignedTo'],
            });

            if (!ticket) {
                this.logger.warn(`Ticket not found for workflow: ${ticketId}`);
                return [];
            }

            // Get active rules for this trigger, ordered by priority
            const rules = await this.getActiveRulesForTrigger(triggerType);

            this.logger.debug(`Found ${rules.length} active rules for trigger ${triggerType}`);

            for (const rule of rules) {
                const startTime = Date.now();
                let result: WorkflowExecutionResult;

                try {
                    // Evaluate conditions
                    const conditionsMet = this.conditionEvaluator.evaluateConditions(
                        rule.conditions,
                        ticket,
                        rule.conditionLogic,
                    );

                    if (conditionsMet) {
                        this.logger.log(`Rule "${rule.name}" matched for ticket ${ticket.ticketNumber}`);

                        // Execute actions
                        const actionResults = await this.actionExecutor.executeActions(
                            rule.actions,
                            ticket,
                            rule.id,
                        );

                        result = {
                            ruleId: rule.id,
                            ruleName: rule.name,
                            conditionsMet: true,
                            actionsExecuted: actionResults,
                            executionTimeMs: Date.now() - startTime,
                        };

                        // Update rule execution count
                        await this.ruleRepo.update(rule.id, {
                            executionCount: () => 'executionCount + 1',
                            lastExecutedAt: new Date(),
                        });
                    } else {
                        result = {
                            ruleId: rule.id,
                            ruleName: rule.name,
                            conditionsMet: false,
                            actionsExecuted: [],
                            executionTimeMs: Date.now() - startTime,
                        };
                    }

                    // Log execution
                    await this.logExecution(rule, ticket, triggerType, result, context?.triggeredBy);

                    results.push(result);

                    // Stop processing if rule says so
                    if (conditionsMet && rule.stopProcessing) {
                        this.logger.debug(`Stopping further rule processing after "${rule.name}"`);
                        break;
                    }
                } catch (error) {
                    this.logger.error(`Error executing rule "${rule.name}": ${error.message}`, error.stack);

                    // Log failed execution
                    await this.executionRepo.save({
                        ruleId: rule.id,
                        ruleName: rule.name,
                        ticketId: ticket.id,
                        ticketNumber: ticket.ticketNumber,
                        triggerEvent: triggerType,
                        conditionsMet: false,
                        actionsExecuted: [],
                        durationMs: Date.now() - startTime,
                        error: error.message,
                        triggeredById: context?.triggeredBy,
                    });
                }
            }

            return results;
        } finally {
            // Remove from executing set after a short delay to prevent rapid re-triggers
            setTimeout(() => {
                this.executingTickets.delete(executionKey);
            }, 1000);
        }
    }

    /**
     * Get active rules for a specific trigger type
     */
    private async getActiveRulesForTrigger(triggerType: TriggerType): Promise<WorkflowRule[]> {
        const rules = await this.ruleRepo.find({
            where: {
                isActive: true,
                deletedAt: IsNull(),
            },
            order: { priority: 'ASC' },
        });

        // Filter by trigger type
        return rules.filter(rule => rule.trigger.type === triggerType);
    }

    /**
     * Log execution to database
     */
    private async logExecution(
        rule: WorkflowRule,
        ticket: Ticket,
        triggerType: TriggerType,
        result: WorkflowExecutionResult,
        triggeredBy?: string,
    ): Promise<void> {
        await this.executionRepo.save({
            ruleId: rule.id,
            ruleName: rule.name,
            ticketId: ticket.id,
            ticketNumber: ticket.ticketNumber,
            triggerEvent: triggerType,
            conditionsMet: result.conditionsMet,
            actionsExecuted: result.actionsExecuted,
            durationMs: result.executionTimeMs,
            triggeredById: triggeredBy,
        });
    }

    /**
     * Test a rule against a ticket without executing actions
     */
    async testRule(ruleId: string, ticketId: string): Promise<{
        conditionsMet: boolean;
        conditionResults: { field: string; result: boolean }[];
        wouldExecute: string[];
    }> {
        const rule = await this.ruleRepo.findOne({ where: { id: ruleId } });
        if (!rule) throw new Error('Rule not found');

        const ticket = await this.ticketRepo.findOne({
            where: { id: ticketId },
            relations: ['user', 'user.department', 'assignedTo'],
        });
        if (!ticket) throw new Error('Ticket not found');

        const conditionResults = rule.conditions.map(condition => ({
            field: condition.field,
            result: this.conditionEvaluator.evaluateCondition(condition, ticket),
        }));

        const conditionsMet = this.conditionEvaluator.evaluateConditions(
            rule.conditions,
            ticket,
            rule.conditionLogic,
        );

        const wouldExecute = conditionsMet
            ? rule.actions.map(a => a.type)
            : [];

        return { conditionsMet, conditionResults, wouldExecute };
    }
}
