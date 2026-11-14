import * as ExcelJS from 'exceljs';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { CsiRateeKind } from '../csi.constants';
import { PAIRS_SHEET, CsiPairsExcelService } from './csi-pairs-excel.service';

describe('CsiPairsExcelService', () => {
    const periods = { findOne: jest.fn() };
    const ratees = { find: jest.fn() };
    const raters = { find: jest.fn() };
    const pairs = { find: jest.fn() };
    const pics = { find: jest.fn() };
    const people = { find: jest.fn() };
    const users = { find: jest.fn() };
    const dataSource = { transaction: jest.fn() };
    const service = new CsiPairsExcelService(
        periods as any, ratees as any, raters as any, pairs as any, pics as any, people as any, users as any, dataSource as any,
    );

    beforeEach(() => {
        jest.clearAllMocks();
        periods.findOne.mockResolvedValue({ id: 'p-1', scope: ServiceScope.HC });
        ratees.find.mockResolvedValue([
            { id: 'rt-1', periodId: 'p-1', kind: CsiRateeKind.PERSON, picId: 'pic-1', userId: 'u-pic', displayName: '=MaliciousPic', serviceCode: 'HCD', bagian: '+Bag', jobTitle: '@Role' },
        ]);
        pics.find.mockResolvedValue([{ id: 'pic-1', nik: '-00012345' }]);
        raters.find.mockResolvedValue([{ id: 'pr-1', periodId: 'p-1', user: { id: 'u-r1', employeeId: '=1234', fullName: '+Andi' } }]);
        pairs.find.mockResolvedValue([{ periodId: 'p-1', periodRaterId: 'pr-1', periodRateeId: 'rt-1' }]);
        people.find.mockResolvedValue([{ nik: '=1234', division: '@DIV', department: '-DEPT', bagian: '+BAG', workLocation: 'SJA-1' }]);
    });

    it('sanitizes all formula-prefixed text cells on exportWorkbook', async () => {
        const { buffer } = await service.exportWorkbook(ServiceScope.HC, 'p-1');
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
        const sheet = wb.getWorksheet(PAIRS_SHEET)!;
        const row2 = sheet.getRow(2).values as unknown[];
        expect(row2[1]).toBe("'=1234");
        expect(row2[2]).toBe("'+Andi");
        expect(row2[9]).toBe("'-00012345");
        expect(row2[10]).toBe("'=MaliciousPic");
    });

    it('normalizes unpadded user employeeId on importWorkbook and flags duplicate normalized NIKs', async () => {
        pics.find.mockResolvedValue([{ id: 'pic-1', nik: '5678' }]);
        users.find.mockResolvedValue([
            { id: 'u-r1', employeeId: '1234' },
            { id: 'u-dup1', employeeId: '999' },
            { id: 'u-dup2', employeeId: '00000999' },
        ]);
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet(PAIRS_SHEET);
        ws.addRow(['NIK Penilai', 'NIK PIC']);
        ws.addRow(['1234', '5678']);
        ws.addRow(['999', '5678']);
        const buf = Buffer.from(await wb.xlsx.writeBuffer());

        const report = await service.importWorkbook(ServiceScope.HC, 'p-1', buf, false);
        expect(report.pairs).toBe(1);
        expect(report.problemCount).toBe(1);
        expect(report.problems[0].message).toContain('00000999');
    });
});
