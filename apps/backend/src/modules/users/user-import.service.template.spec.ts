import * as ExcelJS from 'exceljs';
import { UserImportService } from './user-import.service';

describe('UserImportService — import template', () => {
    it('lists every site code, Sukodono (SKD) included, in the hint and the dropdown', async () => {
        const service = new UserImportService(
            { find: jest.fn().mockResolvedValue([]) } as any,
            { find: jest.fn().mockResolvedValue([]) } as any,
            { find: jest.fn().mockResolvedValue([]) } as any,
            { send: jest.fn() } as any,
        );
        const { data } = await service.generateImportTemplate();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(data as any);
        const hint = workbook.getWorksheet('Instructions')!.getRow(3).values as unknown[];
        expect(hint[2]).toBe('SPJ, KRW, SKD, SMG, JTB');
        expect(workbook.getWorksheet('Users')!.getCell('D2').dataValidation.formulae).toEqual(['"SPJ,KRW,SKD,SMG,JTB"']);
    });
});
