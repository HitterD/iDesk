import * as ExcelJS from 'exceljs';
import { buildBlankTemplate } from './csi-template-blank';
import { parseTemplateWorkbook } from './csi-template-excel';

const LOCATION = { code: 'SMG', name: 'Semarang' };
const EMPLOYEES = [
    { fullName: 'ELVI CYNTHIA', jobTitle: 'PLANT MANAGER 1', employeeId: '00000277' },
    { fullName: 'RARA KURNIA', jobTitle: null, employeeId: null },
];

async function read(buffer: Buffer) {
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    return book;
}

describe('buildBlankTemplate', () => {
    it('round-trips through the import parser as an empty list template', async () => {
        const draft = await parseTemplateWorkbook(await buildBlankTemplate(LOCATION, EMPLOYEES));
        expect(draft).toEqual({ format: 'list', pics: [], teams: [], problems: [] });
    });

    it('lists the given employees (name, title, NIK as text) and has Tim and Petunjuk sheets', async () => {
        const book = await read(await buildBlankTemplate(LOCATION, EMPLOYEES));
        expect(book.worksheets.map((sheet) => sheet.name)).toEqual(['List Penilai 2026', 'Tim', 'Karyawan SMG', 'Petunjuk']);
        const employees = book.getWorksheet('Karyawan SMG')!;
        expect(employees.getRow(1).values).toEqual([undefined, 'Nama', 'Jabatan', 'NIK']);
        expect(employees.getRow(2).values).toEqual([undefined, 'ELVI CYNTHIA', 'PLANT MANAGER 1', '00000277']);
        expect(employees.getRow(3).getCell(1).value).toBe('RARA KURNIA');
        expect(employees.rowCount).toBe(3);
        expect(book.getWorksheet('Tim')!.getRow(1).values).toEqual([undefined, 'Nama Tim', 'Anggota', 'NIK']);
        const guide = book.getWorksheet('Petunjuk')!;
        expect(guide.rowCount).toBeLessThanOrEqual(10);
        const text = guide.getColumn(1).values.join('\n');
        for (const phrase of ['HC Development', 'HC Comben', 'HC Services', 'Karyawan SMG', '"Tim"', 'List PIC']) expect(text).toContain(phrase);
    });

    it('freezes and bolds the list header and includes the NIK Penilai column', async () => {
        const book = await read(await buildBlankTemplate(LOCATION, []));
        const list = book.getWorksheet('List Penilai 2026')!;
        expect(list.getRow(1).values).toEqual([undefined, 'Area', 'Nama Lengkap Karyawan (HC)', 'Jabatan', 'Fungsi pelayanan',
            'Nama Lengkap Penilai', 'Jabatan (akan terisi otomatis)', 'NIK Penilai']);
        expect(list.getRow(1).getCell(1).font?.bold).toBe(true);
        expect(list.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
    });

    it('neutralises formula-like employee names', async () => {
        const book = await read(await buildBlankTemplate(LOCATION, [{ fullName: '=HYPERLINK("x")', jobTitle: null, employeeId: null }]));
        expect(book.getWorksheet('Karyawan SMG')!.getRow(2).getCell(1).value).toBe('\'=HYPERLINK("x")');
    });
});
