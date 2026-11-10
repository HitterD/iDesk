import { ForbiddenException, NotFoundException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { CsiOrgLocation } from '../org/csi-org.constants';
import { CsiServiceReportService } from './csi-service-report.service';

const input = () => ({
    period: { id: 'p1', title: 'CSI HC 2026 – Semarang', startDate: '2026-11-01', endDate: '2026-11-30' },
    scoreBands: { fairMin: 3.5, goodMin: 4.2 },
    pics: [
        { periodRateeId: 'rara', name: 'RARA', jobTitle: 'Staff', serviceCode: 'HCD', bagian: 'HCD', serviceFunction: 'People & Organization Development' },
        { periodRateeId: 'pris', name: 'PRISCILLA', jobTitle: 'Supervisor', serviceCode: 'HCD', bagian: 'HCD', serviceFunction: null },
    ],
    ratings: [
        { responseId: 'r1', periodRateeId: 'rara', location: CsiOrgLocation.SJA4, scores: { Knowledge: 5 }, respondent: { name: 'ELVI CYNTHIA', division: 'OPS', department: 'PROD', bagian: null } },
        { responseId: 'r1', periodRateeId: 'pris', location: CsiOrgLocation.SJA4, scores: { Knowledge: 4 }, respondent: { name: 'ELVI CYNTHIA', division: 'OPS', department: 'PROD', bagian: null } },
    ],
    dimensions: ['Knowledge'],
    userIdOf: new Map<string, string | null>([['rara', 'u-rara'], ['pris', null]]),
});

describe('CsiServiceReportService', () => {
    const access = { assertService: jest.fn(), servicesFor: jest.fn() };
    const reports = { hcRecapInput: jest.fn(async () => input()), getRespondents: jest.fn(async () => ({ pendingByDepartment: [{ department: 'PROD', pending: 1, total: 2 }], pending: [{ fullName: 'SECRET' }] })) };
    const rows = [
        { id: 'p1', scope: 'HC', title: 'CSI HC 2026 – Semarang', startDate: '2026-11-01', endDate: '2026-11-30', publishStatus: 'PUBLISHED', cancelledAt: null },
        { id: 'p-cancel', scope: 'HC', title: 'Batal', startDate: '2026-10-01', endDate: '2026-10-30', publishStatus: 'PUBLISHED', cancelledAt: new Date() },
        { id: 'p-draft', scope: 'HC', title: 'Draft', startDate: '2026-12-01', endDate: '2026-12-30', publishStatus: 'DRAFT', cancelledAt: null },
    ];
    const periods = {
        // Mirrors the where clause: not DRAFT and cancelledAt IS NULL.
        find: jest.fn(async ({ where }: any) => rows.filter((row) => row.scope === where.scope && row.publishStatus !== 'DRAFT' && (where.cancelledAt ? row.cancelledAt === null : true))),
        findOne: jest.fn(async ({ where }: any) => rows.find((row) => row.id === where.id) ?? null),
    };
    // Periods that have at least one rated person with a layanan (serviceCode).
    const rateeRows: { rows: Array<{ periodId: string }> } = { rows: [{ periodId: 'p1' }] };
    const ratees = { find: jest.fn(async () => rateeRows.rows) };
    const service = new CsiServiceReportService(access as any, reports as any, periods as any, ratees as any);

    beforeEach(() => jest.clearAllMocks());

    it('a service owner who is also a rated PIC never sees who rated them', async () => {
        access.assertService.mockResolvedValue({ admin: false });
        const report = await service.get('u-rara', 'p1', 'HCD', ServiceScope.HC);
        expect(access.assertService).toHaveBeenCalledWith('u-rara', ServiceScope.HC, 'HCD');
        const names = report.respondents.flatMap((row) => row.pics.map((pic) => [row.name, pic.name]));
        expect(names).toEqual([['ELVI CYNTHIA', 'PRISCILLA'], ['Anonim', 'RARA']]);
        expect(report.serviceCode).toBe('HCD');
        expect(report.scoreBands).toEqual({ fairMin: 3.5, goodMin: 4.2 });
        expect(report.pending).toEqual([{ department: 'PROD', pending: 1, total: 2 }]);
        expect(JSON.stringify(report)).not.toContain('SECRET');
    });

    it('admins see every rater by name', async () => {
        access.assertService.mockResolvedValue({ admin: true });
        const report = await service.get('admin', 'p1', 'HCD', ServiceScope.HC);
        expect(report.respondents.map((row) => row.name)).toEqual(['ELVI CYNTHIA']);
    });

    it('anyone else gets 403 before any data is read', async () => {
        access.assertService.mockRejectedValue(new ForbiddenException());
        await expect(service.get('budi', 'p1', 'HCD', ServiceScope.HC)).rejects.toBeInstanceOf(ForbiddenException);
        expect(reports.hcRecapInput).not.toHaveBeenCalled();
    });

    it('the Excel export keeps the self rows anonymous', async () => {
        access.assertService.mockResolvedValue({ admin: false });
        const { buffer, filename } = await service.exportWorkbook('u-rara', 'p1', 'HCD', ServiceScope.HC);
        expect(filename).toMatch(/HCD/);
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer as any);
        const text: string[] = [];
        workbook.eachSheet((sheet) => sheet.eachRow((row) => text.push(JSON.stringify(row.values))));
        const raraRows = text.filter((line) => line.includes('"RARA"') && line.includes('Knowledge') === false && line.includes('Anonim'));
        expect(raraRows.length).toBeGreaterThan(0);
        expect(text.some((line) => line.includes('ELVI CYNTHIA') && line.includes('"RARA"'))).toBe(false);
    });

    it('lists HC periods only for users with at least one service', async () => {
        access.servicesFor.mockResolvedValueOnce({ admin: false, services: [] });
        expect(await service.listPeriods('budi', ServiceScope.HC)).toEqual({ services: [], periods: [] });
        access.servicesFor.mockResolvedValueOnce({ admin: false, services: ['HCD'] });
        expect((await service.listPeriods('u-rara', ServiceScope.HC)).periods.map((row) => row.id)).toEqual(['p1']);
    });

    it('cancelled surveys are not listed; draft and cancelled surveys cannot be opened by owners', async () => {
        access.servicesFor.mockResolvedValueOnce({ admin: false, services: ['HCD'] });
        expect((await service.listPeriods('u-rara', ServiceScope.HC)).periods.map((row) => row.id)).toEqual(['p1']);
        access.assertService.mockResolvedValue({ admin: false });
        await expect(service.get('u-rara', 'p-draft', 'HCD', ServiceScope.HC)).rejects.toBeInstanceOf(NotFoundException);
        await expect(service.get('u-rara', 'p-cancel', 'HCD', ServiceScope.HC)).rejects.toBeInstanceOf(NotFoundException);
        await expect(service.get('u-rara', 'missing', 'HCD', ServiceScope.HC)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('ICT: an owner of the Oracle team reads that team only, by ICT period', async () => {
        rows.push({ id: 'p-ict', scope: 'ICT', title: 'CSI ICT Desember', startDate: '2026-12-01', endDate: '2026-12-20', publishStatus: 'PUBLISHED', cancelledAt: null } as any);
        reports.hcRecapInput.mockResolvedValueOnce({
            ...input(), period: { id: 'p-ict', title: 'CSI ICT Desember', startDate: '2026-12-01', endDate: '2026-12-20' },
            pics: [
                { periodRateeId: 'agus', name: 'AGUS', jobTitle: 'Oracle Dev', serviceCode: 'ORACLE', bagian: 'SPJ', serviceFunction: 'Oracle EBS' },
                { periodRateeId: 'tono', name: 'TONO', jobTitle: 'Support', serviceCode: 'OPS', bagian: 'SPJ', serviceFunction: null },
            ],
            ratings: [], userIdOf: new Map(),
        });
        access.assertService.mockResolvedValue({ admin: false });
        const report = await service.get('u-agus', 'p-ict', 'oracle', ServiceScope.ICT);
        expect(access.assertService).toHaveBeenCalledWith('u-agus', ServiceScope.ICT, 'ORACLE');
        expect(reports.hcRecapInput).toHaveBeenCalledWith(ServiceScope.ICT, 'p-ict');
        expect(report.services.map((row) => row.label)).toEqual(['ORACLE · Oracle / K2', 'SPJ', 'AGUS']);
        await expect(service.get('u-agus', 'p1', 'ORACLE', ServiceScope.ICT)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('ICT owners only see ICT surveys that carry team data (older ICT surveys have none)', async () => {
        rows.push(
            { id: 'p-ict-old', scope: 'ICT', title: 'Lama', startDate: '2026-10-01', endDate: '2026-10-05', publishStatus: 'PUBLISHED', cancelledAt: null } as any,
            { id: 'p-ict-new', scope: 'ICT', title: 'Baru', startDate: '2026-12-01', endDate: '2026-12-05', publishStatus: 'PUBLISHED', cancelledAt: null } as any,
        );
        rateeRows.rows = [{ periodId: 'p-ict-new' }];
        access.servicesFor.mockResolvedValueOnce({ admin: false, services: ['OPS'] });
        expect((await service.listPeriods('u-x', ServiceScope.ICT)).periods.map((row) => row.id)).toEqual(['p-ict-new']);
    });
});
