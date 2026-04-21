import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';

// Entities
import { WorkflowRule } from './entities/workflow-rule.entity';
import { WorkflowExecution } from './entities/workflow-execution.entity';
import { Ticket } from '../ticketing/entities/ticket.entity';
import { User } from '../users/entities/user.entity';
import { TicketMessage } from '../ticketing/entities/ticket-message.entity';

// Services
import { WorkflowRuleService } from './services/workflow-rule.service';
import { WorkflowEngineService } from './services/workflow-engine.service';
import { ConditionEvaluatorService } from './services/condition-evaluator.service';
import { ActionExecutorService } from './services/action-executor.service';

// Controllers
import { WorkflowRuleController } from './controllers/workflow-rule.controller';

// Listeners
import { TicketWorkflowListener } from './listeners/ticket-workflow.listener';
import { AuditModule } from '../audit/audit.module';

/**
 * Automation Module
 * Provides workflow automation capabilities for ticket handling
 */
@Module({
    imports: [
        TypeOrmModule.forFeature([
            WorkflowRule,
            WorkflowExecution,
            Ticket,
            User,
            TicketMessage,
        ]),
        EventEmitterModule,
        AuditModule,
    ],
    controllers: [WorkflowRuleController],
    providers: [
        // Services
        WorkflowRuleService,
        WorkflowEngineService,
        ConditionEvaluatorService,
        ActionExecutorService,
        // Listeners
        TicketWorkflowListener,
    ],
    exports: [
        WorkflowRuleService,
        WorkflowEngineService,
    ],
})
export class AutomationModule { }
