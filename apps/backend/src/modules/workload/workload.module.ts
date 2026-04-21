import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PriorityWeight } from './entities/priority-weight.entity';
import { AgentDailyWorkload } from './entities/agent-daily-workload.entity';
import { WorkloadService } from './workload.service';
import { WorkloadController } from './workload.controller';
import { Ticket } from '../ticketing/entities/ticket.entity';
import { User } from '../users/entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([PriorityWeight, AgentDailyWorkload, Ticket, User]),
        AuthModule,
        AuditModule,
    ],
    controllers: [WorkloadController],
    providers: [WorkloadService],
    exports: [WorkloadService],
})
export class WorkloadModule { }
