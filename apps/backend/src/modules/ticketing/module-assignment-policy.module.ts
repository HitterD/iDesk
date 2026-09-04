import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TicketModule as TicketModuleEntity } from './entities/ticket-module.entity';
import { ModuleAssignmentPolicyService } from './services/module-assignment-policy.service';

/**
 * Deliberately tiny and dependency-free so both TicketingModule and
 * WorkloadModule can import it without a circular reference. The assignment
 * guard must be reachable from every auto-assign path, including the workload
 * controller, which is why it does not live inside TicketingModule.
 */
@Module({
    imports: [TypeOrmModule.forFeature([TicketModuleEntity])],
    providers: [ModuleAssignmentPolicyService],
    exports: [ModuleAssignmentPolicyService],
})
export class ModuleAssignmentPolicyModule { }
