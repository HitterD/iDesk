import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { Ticket } from '../ticketing/entities/ticket.entity';
import { User } from '../users/entities/user.entity';

// Report Generators
import { AgentPerformanceReport } from './generators/agent-performance.report';
import { TicketVolumeReport } from './generators/ticket-volume.report';
import { PDFGeneratorService } from './generators/pdf-generator.service';
import { ManagerReportExcelBuilder } from './generators/manager-report-excel.builder';
import { ScheduledReportsService } from './generators/scheduled-reports.service';
import { AuditModule } from '../audit/audit.module';

// Scheduled Reports (NEW)
import { ScheduledReportConfig } from './entities/scheduled-report-config.entity';
import { ScheduledReportExecution } from './entities/scheduled-report-execution.entity';
import { ScheduledReportsController } from './presentation/scheduled-reports.controller';
import { ScheduledReportsCrudService } from './services/scheduled-reports-crud.service';
import { DynamicScheduledReportsService } from './generators/dynamic-scheduled-reports.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Ticket,
            User,
            // Scheduled reports entities
            ScheduledReportConfig,
            ScheduledReportExecution,
        ]),
        AuditModule,
    ],
    controllers: [
        ReportsController,
        // Scheduled reports controller (ADMIN/MANAGER via @PageAccess('reports'))
        ScheduledReportsController,
    ],
    providers: [
        ReportsService,
        AgentPerformanceReport,
        TicketVolumeReport,
        PDFGeneratorService,
        ManagerReportExcelBuilder,
        ScheduledReportsService,

        // Scheduled reports providers
        ScheduledReportsCrudService,
        DynamicScheduledReportsService,
    ],
    exports: [
        ReportsService,
        PDFGeneratorService,
        ManagerReportExcelBuilder,
        // Export scheduled services if other modules need direct access (not required for MVP)
        ScheduledReportsCrudService,
        DynamicScheduledReportsService,
    ],
})
export class ReportsModule { }
