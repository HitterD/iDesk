import * as ExcelJS from 'exceljs';
import { parseTemplateWorkbook } from './csi-template-excel';

const HEADER = ['No.', 'Area', 'Nama Lengkap Karyawan (HC)', 'Jabatan', 'FUNGSI PELAYANAN', 'Nama Lengkap Penilai', 'Jabatan (akan terisi otomatis)', 'NIK HRIS (dikosongkan saja)'];

async function workbook(rows: unknown[][], employees: unknown[][] = []) {
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet('List Penilai 2026');
    sheet.addRow(HEADER);
    rows.forEach((row) => sheet.addRow(row));
    const smg = book.addWorksheet('Karyawan SMG');
    smg.addRow(['Nama Karyawan', 'Nama Jabatan']);
    employees.forEach((row) => smg.addRow(row));
    return Buffer.from(await book.xlsx.writeBuffer());
}

describe('parseTemplateWorkbook', () => {
    it('reads the Semarang layout: area and PIC carried down, #N/A as empty, duplicate raters once, PIC without raters kept', async () => {
        const buffer = await workbook([
            [1, 'HC Development', 'rara kurnia maharani pongdatu', 'PEOPLE & ORGANIZATION DEVELOPMENT STAFF', ' People & Organization Development ', 'ELVI CYNTHIA', '#N/A'],
            [2, null, null, '#N/A', 'People & Organization Development', 'ARIEF NOEGROHO', 'PLANT MANAGER 2 SJA SEMARANG'],
            [3, null, null, '#N/A', 'People & Organization Development', 'elvi  cynthia', '#N/A'],
            [4, 'HC Services', 'JINGGA FERDASIWI', 'RECEPTIONIST', 'RECEPTIONIST, Bagian Pelayanan dan Ruang Meeting', null, '#N/A'],
        ], [['ELVI CYNTHIA', 'PLANT MANAGER 1 SJA SEMARANG']]);
        const draft = await parseTemplateWorkbook(buffer);
        expect(draft.pics).toEqual([
            {
                area: 'HC Development', serviceCode: 'HCD', picName: 'RARA KURNIA MAHARANI PONGDATU', jobTitle: 'PEOPLE & ORGANIZATION DEVELOPMENT STAFF',
                serviceFunction: 'People & Organization Development',
                raters: [{ name: 'ELVI CYNTHIA', jobTitle: 'PLANT MANAGER 1 SJA SEMARANG' }, { name: 'ARIEF NOEGROHO', jobTitle: 'PLANT MANAGER 2 SJA SEMARANG' }],
            },
            { area: 'HC Services', serviceCode: 'HCS', picName: 'JINGGA FERDASIWI', jobTitle: 'RECEPTIONIST', serviceFunction: 'RECEPTIONIST, Bagian Pelayanan dan Ruang Meeting', raters: [] },
        ]);
        expect(draft.problems).toEqual([]);
    });

    it('reports an unknown area instead of guessing the service', async () => {
        const draft = await parseTemplateWorkbook(await workbook([[1, 'HSE', 'SITI', 'SAFETY STAFF', 'Safety', 'BUDI', null]]));
        expect(draft.pics).toEqual([]);
        expect(draft.problems).toEqual([{ row: 2, message: 'Area "HSE" bukan HC Development / HC Comben / HC Services' }]);
    });

    it('rejects a sheet without the expected headers', async () => {
        const book = new ExcelJS.Workbook();
        book.addWorksheet('x').addRow(['Nama']);
        await expect(parseTemplateWorkbook(Buffer.from(await book.xlsx.writeBuffer()))).rejects.toThrow(/Kolom/);
    });

    it('a PIC listed twice in the file becomes one PIC with the raters of both blocks', async () => {
        const draft = await parseTemplateWorkbook(await workbook([
            [1, 'HC Services', 'KUSMANTO', 'KOMANDAN REGU SECURITY', 'SECURITY SERVICES', 'BUDI', null],
            [2, 'HC Services', 'Kusmanto', 'KOMANDAN REGU SECURITY', 'SECURITY SERVICES', 'CITRA', null],
        ]));
        expect(draft.pics).toHaveLength(1);
        expect(draft.pics[0].raters.map((rater) => rater.name)).toEqual(['BUDI', 'CITRA']);
    });

    it('an oversized employee sheet is refused like the main sheet (no unbounded read)', async () => {
        const rows = Array.from({ length: 20001 }, (_, index) => [`ORANG ${index}`, 'STAFF']);
        await expect(parseTemplateWorkbook(await workbook([[1, 'HC Services', 'X', 'Y', 'Z', 'A', null]], rows))).rejects.toThrow(/Maksimal/);
    });
});
