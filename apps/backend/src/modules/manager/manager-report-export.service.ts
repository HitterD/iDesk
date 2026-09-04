// apps/backend/src/modules/manager/manager-report-export.service.ts
//
// Q13: backend menentukan nama file via Content-Disposition — frontend
// membacanya, bukan hardcode `report-YYYY-MM-DD.pdf`.
// Q16: setiap generate dicatat sebagai REPORT_GENERATE (audit).

import { Injectable, BadRequestException } from '@nestjs/common';
import type { Response } from 'express';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { AuditService } from '../audit/audit.service';
import { SiteActor } from '../../shared/core/utils/site-scope.util';
import { PDFGeneratorService } from '../reports/generators/pdf-generator.service';
import { ManagerReportExcelBuilder } from '../reports/generators/manager-report-excel.builder';
import { ManagerReportsService, ManagerReport } from './manager-reports.service';
import { GenerateManagerReportDto, normalizeReportType } from './dto';

export const PDF_MIME = 'application/pdf';
export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@Injectable()
export class ManagerReportExportService {
    constructor(
        private readonly reportsService: ManagerReportsService,
        // Dari ReportsModule (sudah di-exports): kelas konkret, bukan tipe inline —
        // Nest membaca metadata desain dari tipe runtime.
        private readonly pdfGenerator: PDFGeneratorService,
        private readonly excelBuilder: ManagerReportExcelBuilder,
        private readonly auditService: AuditService,
    ) { }

    async stream(res: Response, actor: SiteActor, userId: string, dto: GenerateManagerReportDto): Promise<void> {
        const format = dto.format ?? 'pdf';

        if (!['pdf', 'excel'].includes(format)) {
            throw new BadRequestException(`Unsupported export format: ${format}`);
        }

        const report = await this.reportsService.generateReport(
            {
                reportType: normalizeReportType(dto.reportType),
                siteIds: dto.siteIds,
                startDate: dto.dateFrom,
                endDate: dto.dateTo,
                sections: dto.sections,
            },
            actor,
        );

        const periodLabel = report.period.replace(' to ', '_');
        const baseName = [
            'manager-report',
            String(report.reportType).toLowerCase(),
            periodLabel,
        ].join('-');

        res.setHeader('Content-Type', format === 'pdf' ? PDF_MIME : XLSX_MIME);
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="${baseName}.${format === 'pdf' ? 'pdf' : 'xlsx'}"`,
        );

        if (format === 'pdf') {
            await this.pdfGenerator.generateManagerReportPDF(res, report, {
                title: 'Manager Report',
            });
        } else {
            await this.excelBuilder.buildAndStream(res, report, `${baseName}.xlsx`);
        }

        this.auditService.logAsync({
            userId,
            action: AuditAction.REPORT_GENERATE,
            entityType: 'Report',
            entityId: `Manager-${String(report.reportType)}-${periodLabel}`,
            description: `Generated manager ${format.toUpperCase()} report (${(report as ManagerReport).sites.length} sites, sections: ${(dto.sections || []).join(', ')})`,
        });
    }
}
