import { ForbiddenException, NotFoundException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { CsiOrgLocation } from '../org/csi-org.constants';
import { CsiServiceReportService } from './csi-service-report.service';

const input = () => ({
    period: { id: 'p1', title: 'CSI HC 2026 – Semarang', startDate: '2026-11-01', endDate: '2026-11-30' },
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
        find: jest.fn(async ({ where }: any) => rows.filter((row) => row.publishStatus !== 'DRAFT' && (where.cancelledAt ? row.cancelledAt === null : true))),
        findOne: jest.fn(async ({ where }: any) => rows.find((row) => row.id === where.id) ?? null),
    };
    const service = new CsiServiceReportService(access as any, reports as any, periods as any);

    beforeEach(() => jest.clearAllMocks());

    it('a service owner who is also a rated PIC never sees who rated them', async () => {
        access.assertService.mockResolvedValue({ admin: false });
        const report = await service.get('u-rara', 'p1', 'HCD');
        expect(access.assertService).toHaveBeenCalledWith('u-rara', ServiceScope.HC, 'HCD');
        const names = report.respondents.flatMap((row) => row.pics.map((pic) => [row.name, pic.name]));
        expect(names).toEqual([['ELVI CYNTHIA', 'PRISCILLA'], ['Anonim', 'RARA']]);
        expect(report.serviceCode).toBe('HCD');
        expect(report.pending).toEqual([{ department: 'PROD', pending: 1, total: 2 }]);
        expect(JSON.stringify(report)).not.toContain('SECRET');
    });

    it('admins see every rater by name', async () => {
        access.assertService.mockResolvedValue({ admin: true });
        const report = await service.get('admin', 'p1', 'HCD');
        expect(report.respondents.map((row) => row.name)).toEqual(['ELVI CYNTHIA']);
    });

    it('anyone else gets 403 before any data is read', async () => {
        access.assertService.mockRejectedValue(new ForbiddenException());
        await expect(service.get('budi', 'p1', 'HCD')).rejects.toBeInstanceOf(ForbiddenException);
        expect(reports.hcRecapInput).not.toHaveBeenCalled();
    });

    it('the Excel export keeps the self rows anonymous', async () => {
        access.assertService.mockResolvedValue({ admin: false });
        const { buffer, filename } = await service.exportWorkbook('u-rara', 'p1', 'HCD');
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
        expect(await service.listPeriods('budi')).toEqual({ services: [], periods: [] });
        access.servicesFor.mockResolvedValueOnce({ admin: false, services: ['HCD'] });
        expect((await service.listPeriods('u-rara')).periods.map((row) => row.id)).toEqual(['p1']);
    });

    it('cancelled surveys are not listed; draft and cancelled surveys cannot be opened by owners', async () => {
        access.servicesFor.mockResolvedValueOnce({ admin: false, services: ['HCD'] });
        expect((await service.listPeriods('u-rara')).periods.map((row) => row.id)).toEqual(['p1']);
        access.assertService.mockResolvedValue({ admin: false });
        await expect(service.get('u-rara', 'p-draft', 'HCD')).rejects.toBeInstanceOf(NotFoundException);
        await expect(service.get('u-rara', 'p-cancel', 'HCD')).rejects.toBeInstanceOf(NotFoundException);
        await expect(service.get('u-rara', 'missing', 'HCD')).rejects.toBeInstanceOf(NotFoundException);
    });
});
