import { Injectable, Logger } from '@nestjs/common';
import { Ticket } from '../../ticketing/entities/ticket.entity';
import { WorkflowCondition, ConditionOperator } from '../types/workflow.types';

/**
 * ConditionEvaluator Service
 * Evaluates workflow conditions against ticket data
 */
@Injectable()
export class ConditionEvaluatorService {
    private readonly logger = new Logger(ConditionEvaluatorService.name);

    /**
     * Evaluate all conditions with AND/OR logic
     */
    evaluateConditions(
        conditions: WorkflowCondition[],
        ticket: Ticket & { user?: any },
        logic: 'AND' | 'OR' = 'AND',
    ): boolean {
        if (!conditions || conditions.length === 0) {
            return true; // No conditions = always match
        }

        if (logic === 'AND') {
            return conditions.every(condition => this.evaluateCondition(condition, ticket));
        } else {
            return conditions.some(condition => this.evaluateCondition(condition, ticket));
        }
    }

    /**
     * Evaluate a single condition
     */
    evaluateCondition(condition: WorkflowCondition, ticket: Ticket & { user?: any }): boolean {
        try {
            const fieldValue = this.getFieldValue(ticket, condition.field);
            const result = this.compareValues(fieldValue, condition.operator, condition.value);

            this.logger.debug(
                `Condition: ${condition.field} ${condition.operator} ${condition.value} => ${result}`,
                { fieldValue, conditionValue: condition.value }
            );

            return result;
        } catch (error) {
            this.logger.warn(`Error evaluating condition: ${error.message}`, { condition });
            return false;
        }
    }

    /**
     * Get field value from ticket using dot notation
     */
    private getFieldValue(ticket: any, field: string): any {
        // Handle nested fields like 'user.department.name'
        const parts = field.split('.');
        let value = ticket;

        for (const part of parts) {
            if (value === null || value === undefined) {
                return undefined;
            }
            value = value[part];
        }

        return value;
    }

    /**
     * Compare values based on operator
     */
    private compareValues(fieldValue: any, operator: ConditionOperator, conditionValue: any): boolean {
        // Handle null/undefined
        if (fieldValue === null || fieldValue === undefined) {
            if (operator === ConditionOperator.IS_EMPTY) return true;
            if (operator === ConditionOperator.IS_NOT_EMPTY) return false;
            if (operator === ConditionOperator.NOT_EQUALS) return conditionValue !== null && conditionValue !== undefined;
            return false;
        }

        // Normalize string values
        const normalizedField = typeof fieldValue === 'string' ? fieldValue.toLowerCase().trim() : fieldValue;
        const normalizedCondition = typeof conditionValue === 'string' ? conditionValue.toLowerCase().trim() : conditionValue;

        switch (operator) {
            case ConditionOperator.EQUALS:
                return normalizedField === normalizedCondition;

            case ConditionOperator.NOT_EQUALS:
                return normalizedField !== normalizedCondition;

            case ConditionOperator.CONTAINS:
                return String(normalizedField).includes(String(normalizedCondition));

            case ConditionOperator.NOT_CONTAINS:
                return !String(normalizedField).includes(String(normalizedCondition));

            case ConditionOperator.STARTS_WITH:
                return String(normalizedField).startsWith(String(normalizedCondition));

            case ConditionOperator.ENDS_WITH:
                return String(normalizedField).endsWith(String(normalizedCondition));

            case ConditionOperator.GREATER_THAN:
                return Number(fieldValue) > Number(conditionValue);

            case ConditionOperator.LESS_THAN:
                return Number(fieldValue) < Number(conditionValue);

            case ConditionOperator.GREATER_OR_EQUAL:
                return Number(fieldValue) >= Number(conditionValue);

            case ConditionOperator.LESS_OR_EQUAL:
                return Number(fieldValue) <= Number(conditionValue);

            case ConditionOperator.IN:
                const inArray = Array.isArray(conditionValue) ? conditionValue : [conditionValue];
                return inArray.some(v =>
                    (typeof v === 'string' ? v.toLowerCase() : v) === normalizedField
                );

            case ConditionOperator.NOT_IN:
                const notInArray = Array.isArray(conditionValue) ? conditionValue : [conditionValue];
                return !notInArray.some(v =>
                    (typeof v === 'string' ? v.toLowerCase() : v) === normalizedField
                );

            case ConditionOperator.IS_EMPTY:
                return fieldValue === '' || fieldValue === null || fieldValue === undefined ||
                    (Array.isArray(fieldValue) && fieldValue.length === 0);

            case ConditionOperator.IS_NOT_EMPTY:
                return fieldValue !== '' && fieldValue !== null && fieldValue !== undefined &&
                    !(Array.isArray(fieldValue) && fieldValue.length === 0);

            case ConditionOperator.MATCHES_REGEX:
                try {
                    const regex = new RegExp(conditionValue, 'i');
                    return regex.test(String(fieldValue));
                } catch {
                    this.logger.warn(`Invalid regex pattern: ${conditionValue}`);
                    return false;
                }

            default:
                this.logger.warn(`Unknown operator: ${operator}`);
                return false;
        }
    }
}
