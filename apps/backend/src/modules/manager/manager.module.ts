import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ManagerController } from './manager.controller';
import { ManagerDashboardService } from './manager-dashboard.service';
import { ManagerReportsService } from './manager-reports.service';
import { ManagerReportExportService } from './manager-report-export.service';
import { Ticket } from '../ticketing/entities/ticket.entity';
import { User } from '../users/entities/user.entity';
import { Site } from '../sites/entities/site.entity';
import { AuthModule } from '../auth/auth.module';
import { ReportsModule } from '../reports/reports.module';
import { AuditModule } from '../audit/audit.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Ticket, User, Site]),
        AuthModule,
        // PDFGeneratorService + ManagerReportExcelBuilder untuk export file.
        ReportsModule,
        // Audit REPORT_GENERATE (Q16).
        AuditModule,
    ],
    controllers: [ManagerController],
    providers: [ManagerDashboardService, ManagerReportsService, ManagerReportExportService],
    exports: [ManagerDashboardService, ManagerReportsService],
})
export class ManagerModule { }
