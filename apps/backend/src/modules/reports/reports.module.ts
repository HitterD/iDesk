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
import { ScheduledReportsService } from './generators/scheduled-reports.service';

@Module({
    imports: [TypeOrmModule.forFeature([Ticket, User])],
    controllers: [ReportsController],
    providers: [
        ReportsService,
        AgentPerformanceReport,
        TicketVolumeReport,
        PDFGeneratorService,
        ScheduledReportsService,
    ],
    exports: [ReportsService, PDFGeneratorService],
})
export class ReportsModule { }
