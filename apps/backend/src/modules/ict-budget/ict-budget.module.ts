import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IctBudgetRequest } from './entities/ict-budget-request.entity';
import { IctBudgetService } from './ict-budget.service';
import { IctBudgetController } from './ict-budget.controller';
import { Ticket } from '../ticketing/entities/ticket.entity';
import { User } from '../users/entities/user.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([IctBudgetRequest, Ticket, User]),
        AuthModule,
    ],
    controllers: [IctBudgetController],
    providers: [IctBudgetService],
    exports: [IctBudgetService],
})
export class IctBudgetModule { }
