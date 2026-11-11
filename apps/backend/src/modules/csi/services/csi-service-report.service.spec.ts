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
        { periodRateeId: 'tim', name: 'TIM REKRUT', jobTitle: null, serviceCode: 'HCD', bagian: null, serviceFunction: null, team: true },
    ],
    ratings: [
        { responseId: 'r1', periodRateeId: 'rara', location: CsiOrgLocation.SJA4, scores: { Knowledge: 5 }, respondent: { name: 'ELVI CYNTHIA', division: 'OPS', department: 'PROD', bagian: null } },
        { responseId: 'r1', periodRateeId: 'pris', location: CsiOrgLocation.SJA4, scores: { Knowledge: 4 }, respondent: { name: 'ELVI CYNTHIA', division: 'OPS', department: 'PROD', bagian: null } },
        { responseId: 'r2', periodRateeId: 'tim', location: CsiOrgLocation.SJA4, scores: { Knowledge: 3 }, respondent: { name: 'BUDI RAHASIA', division: 'OPS', department: 'PROD', bagian: null } },
    ],
    dimensions: ['Knowledge'],
    ownersOf: new Map<string, string[]>([['rara', ['u-rara']], ['pris', []], ['tim', ['u-dewi', 'u-eko']]]),
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
        expect(names).toEqual([['BUDI RAHASIA', 'Tim · TIM REKRUT'], ['ELVI CYNTHIA', 'PRISCILLA'], ['Anonim', 'RARA']]);
        expect(report.serviceCode).toBe('HCD');
        expect(report.scoreBands).toEqual({ fairMin: 3.5, goodMin: 4.2 });
        // PROD has 2 raters (< CSI_ANON_MIN_GROUP): merged, its name is not shown to the service owner.
        expect(report.pending).toEqual([{ department: 'Departemen kecil (gabungan)', pending: 1, total: 2 }]);
        expect(JSON.stringify(report)).not.toContain('SECRET');
    });

    it('a member of a rated team who owns the service sees that team like an own PIC row: masked, raters anonymous', async () => {
        access.assertService.mockResolvedValue({ admin: false });
        const report = await service.get('u-eko', 'p1', 'HCD', ServiceScope.HC);
        const names = report.respondents.flatMap((row) => row.pics.map((pic) => [row.name, pic.name]));
        expect(names).toEqual([['ELVI CYNTHIA', 'PRISCILLA'], ['ELVI CYNTHIA', 'RARA'], ['Anonim', 'Tim · TIM REKRUT']]);
        expect(JSON.stringify(report)).not.toContain('BUDI RAHASIA');
        const team = report.services.find((row) => row.key === 'p:tim')!;
        // One rating (< CSI_OWN_ROW_MIN_RATINGS): count only, no score, no location split.
        expect(team.all).toEqual({ average: null, ratings: 1 });
        expect(Object.values(team.byLocation).every((cell) => cell.average === null && cell.ratings === 0)).toBe(true);
    });

    it('admins see every rater by name', async () => {
        access.assertService.mockResolvedValue({ admin: true });
        const report = await service.get('admin', 'p1', 'HCD', ServiceScope.HC);
        expect(report.respondents.map((row) => row.name)).toEqual(['BUDI RAHASIA', 'ELVI CYNTHIA']);
    });

    it('anyone else gets 403 before any data is read', async () => {
        access.assertService.mockRejectedValue(new ForbiddenException());
        await expect(service.get('budi', 'p1', 'HCD', ServiceScope.HC)).rejects.toBeInstanceOf(ForbiddenException);
        expect(reports.hcRecapInput).not.toHaveBeenCalled();
    });

    const textOf = async (buffer: Buffer) => {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer as any);
        const text: string[] = [];
        workbook.eachSheet((sheet) => sheet.eachRow((row) => text.push(JSON.stringify(row.values))));
        return { workbook, text };
    };

    it('the main Excel export is anonymous: numbered recap sheets, pending per department merged, no rater names', async () => {
        access.assertService.mockResolvedValue({ admin: true });
        const { buffer, filename } = await service.exportWorkbook('admin', 'p1', 'HCD', ServiceScope.HC);
        expect(filename).toBe('csi-hc-HCD-p1.xlsx');
        const { workbook, text } = await textOf(buffer);
        expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['1 Per layanan', '2 Layanan-bagian-PIC', '3 Rekap responden', '4 Belum menilai']);
        expect(text.join(' | ')).not.toMatch(/ELVI CYNTHIA|BUDI RAHASIA|SECRET/);
        expect(text.join(' | ')).toContain('Departemen kecil (gabungan)');
        expect(text.join(' | ')).toContain('PRISCILLA');
    });

    it('the pending department name is sanitised against formula injection', async () => {
        access.assertService.mockResolvedValue({ admin: true });
        reports.getRespondents.mockResolvedValueOnce({ pendingByDepartment: [{ department: '=CMD()', pending: 1, total: 5 }], pending: [] } as any);
        const { text } = await textOf((await service.exportWorkbook('admin', 'p1', 'HCD', ServiceScope.HC)).buffer);
        expect(text.join(' | ')).toContain("'=CMD()");
    });

    it('the raw export names the raters of the service but keeps the owner own ratings anonymous', async () => {
        access.assertService.mockResolvedValue({ admin: false });
        const { buffer, filename } = await service.exportRawWorkbook('u-rara', 'p1', 'HCD', ServiceScope.HC);
        expect(filename).toBe('csi-hc-HCD-p1 - DATA MENTAH (RAHASIA).xlsx');
        const { workbook, text } = await textOf(buffer);
        expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['HC Jawaban Responden']);
        expect(String(workbook.worksheets[0].getCell('A1').value)).toMatch(/^RAHASIA/);
        expect(text.some((line) => line.includes('ELVI CYNTHIA') && line.includes('"PRISCILLA"'))).toBe(true);
        expect(text.some((line) => line.includes('ELVI CYNTHIA') && line.includes('"RARA"'))).toBe(false);
        expect(text.some((line) => line.includes('Anonim') && line.includes('"RARA"'))).toBe(true);
    });

    it('the raw export of another service is refused before any data is read', async () => {
        access.assertService.mockRejectedValue(new ForbiddenException());
        await expect(service.exportRawWorkbook('u-rara', 'p1', 'HCC', ServiceScope.HC)).rejects.toBeInstanceOf(ForbiddenException);
        expect(reports.hcRecapInput).not.toHaveBeenCalled();
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
            ratings: [], ownersOf: new Map(),
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
