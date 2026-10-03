import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ticket } from '../ticketing/entities/ticket.entity';
import { AgentRating } from '../ticketing/entities/agent-rating.entity';
import { User } from '../users/entities/user.entity';
import { AgentDailyWorkload } from '../workload/entities/agent-daily-workload.entity';
import { AuthModule } from '../auth/auth.module';
import { AgentDashboardController } from './agent-dashboard.controller';
import { AgentDashboardService } from './agent-dashboard.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([Ticket, User, AgentDailyWorkload, AgentRating]),
        AuthModule,
    ],
    controllers: [AgentDashboardController],
    providers: [AgentDashboardService],
})
export class AgentDashboardModule { }
