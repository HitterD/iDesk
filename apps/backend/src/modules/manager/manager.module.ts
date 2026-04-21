import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ManagerController } from './manager.controller';
import { ManagerDashboardService } from './manager-dashboard.service';
import { ManagerReportsService } from './manager-reports.service';
import { Ticket } from '../ticketing/entities/ticket.entity';
import { User } from '../users/entities/user.entity';
import { Site } from '../sites/entities/site.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Ticket, User, Site]),
        AuthModule,
    ],
    controllers: [ManagerController],
    providers: [ManagerDashboardService, ManagerReportsService],
    exports: [ManagerDashboardService, ManagerReportsService],
})
export class ManagerModule { }
