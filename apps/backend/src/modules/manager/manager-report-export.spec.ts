// apps/backend/src/modules/manager/manager-report-export.spec.ts
//
// Kasus 6 (Q13): export endpoint harus streaming file dengan header yang benar —
// Content-Type per format, Content-Disposition berisi nama deskriptif dari backend.
// Generator di-mock; isi biner PDF/Excel tidak diverifikasi (rapuh & lambat).

import { BadRequestException } from '@nestjs/common';
import { ManagerReportExportService } from './manager-report-export.service';
import { UserRole } from '../users/enums/user-role.enum';

const ACTOR = { role: UserRole.MANAGER, siteId: 'site-x' };

function mockResponse() {
    return {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
    };
}

describe('ManagerReportExportService — response headers & filename (Q13)', () => {
    let service: ManagerReportExportService;
    let reports: any;
    let pdfGenerator: any;
    let excelBuilder: any;
    let audit: any;

    // Kontrak ManagerReportsService: period = "<start> to <end>" (YYYY-MM-DD).
    const report = {
        reportType: 'CONSOLIDATED',
        period: '2026-08-01 to 2026-08-31',
        generatedAt: new Date(),
        sites: ['SPJ'],
    };

    beforeEach(() => {
        reports = { generateReport: jest.fn().mockResolvedValue(report) };
        pdfGenerator = { generateManagerReportPDF: jest.fn(async () => undefined) };
        excelBuilder = { buildAndStream: jest.fn(async () => undefined) };
        audit = { logAsync: jest.fn(async () => undefined) };

        service = new ManagerReportExportService(reports, pdfGenerator, excelBuilder, audit);
    });

    it('pdf: sets application/pdf and descriptive Content-Disposition filename', async () => {
        const res = mockResponse();

        await service.stream(res as any, ACTOR, 'manager-1', {
            reportType: 'CONSOLIDATED',
            sections: ['tickets'],
            startDate: '2026-08-01',
            endDate: '2026-08-31',
            siteIds: [],
            format: 'pdf',
        } as any);

        expect(pdfGenerator.generateManagerReportPDF).toHaveBeenCalledTimes(1);
        const [, filename] = res.setHeader.mock.calls.find(c => c[0] === 'Content-Disposition');
        expect(filename).toMatch(/^attachment; filename="manager-report-/);
        expect(filename).toContain('2026-08-01_2026-08-31');
        expect(filename).toMatch(/\.pdf"$/);
        const [ctHeader, ctValue] = res.setHeader.mock.calls.find(c => c[0] === 'Content-Type');
        expect(ctValue).toBe('application/pdf');
        // Q16: generate laporan manager dicatat sebagai REPORT_GENERATE
        expect(audit.logAsync).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'REPORT_GENERATE' }),
        );
    });

    it('excel: sets xlsx mime type with .xlsx extension', async () => {
        const res = mockResponse();

        await service.stream(res as any, ACTOR, 'manager-1', {
            reportType: 'PER_SITE',
            sections: ['tickets'],
            startDate: '2026-08-01',
            endDate: '2026-08-31',
            format: 'excel',
        } as any);

        expect(excelBuilder.buildAndStream).toHaveBeenCalledTimes(1);
        expect(pdfGenerator.generateManagerReportPDF).not.toHaveBeenCalled();
        const [ctHeader, ctValue] = res.setHeader.mock.calls.find(c => c[0] === 'Content-Type');
        expect(ctValue).toBe(
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );
    });

    it('rejects unknown export format before touching generators', async () => {
        const res = mockResponse();

        await expect(
            service.stream(res as any, ACTOR, 'manager-1', {
                reportType: 'CONSOLIDATED',
                sections: ['tickets'],
                format: 'word',
            } as any),
        ).rejects.toBeInstanceOf(BadRequestException);

        expect(reports.generateReport).not.toHaveBeenCalled();
        expect(pdfGenerator.generateManagerReportPDF).not.toHaveBeenCalled();
        expect(excelBuilder.buildAndStream).not.toHaveBeenCalled();
    });
});
