import * as ExcelJS from 'exceljs';
import { parseTemplateWorkbook } from './csi-template-excel';
import { parseMatrixWorkbook } from './csi-template-matrix';

const SERVICES = ['Pelayanan Cuti dan Absensi', 'Pelayanan Perjalanan Dinas', 'Pelayanan Uang Makan Uang Transport Uang Lembur', 'Pelatihan'];
async function matrix(pics: unknown[][], raters: unknown[][], sum = true) {
    const book = new ExcelJS.Workbook();
    book.addWorksheet('Matrix Format ICT').addRow(['Ignored']);
    for (const [name, rows] of [['List PIC', pics], ['List Penilai', raters]] as const) {
        const sheet = book.addWorksheet(name);
        sheet.addRow(['Totals']);
        sheet.addRow(['Instruction', null, null, null, ...(sum ? [null] : []), 'HC Services', 'Comben', null, 'HC Development']);
        sheet.addRow(['nik', 'Nama', 'JABATAN', 'LOKASI', ...(sum ? ['Sum'] : []), ...SERVICES]);
        rows.forEach((row) => sheet.addRow(sum ? row : row.filter((_, i) => i !== 4)));
    }
    book.addWorksheet('Tim').addRows([['Nama Tim', 'Anggota', 'NIK'], ['Tim HC', 'BUDI', 71]]);
    return Buffer.from(await book.xlsx.writeBuffer());
}

const PIC = [43328, 'KISWANA EKA JUWITA', 'HC STAFF', 'JTB', 2, null, 'V', 'V', null];
describe('matrix template workbook', () => {
    it('maps groups, carries group headers and joins checked service functions', async () => {
        const draft = await parseTemplateWorkbook(await matrix([PIC, [2, 'HCS PIC', null, null, 1, 'V'], [3, 'HCD PIC', null, null, 1, null, null, null, 'V']], []));
        expect(draft).toMatchObject({ format: 'matrix', teams: [{ name: 'Tim HC', members: [{ name: 'BUDI', nik: '00000071' }] }] });
        expect(draft.pics.map((pic) => [pic.serviceCode, pic.area])).toEqual([['HCC', 'HC Comben'], ['HCS', 'HC Services'], ['HCD', 'HC Development']]);
        expect(draft.pics[0]).toMatchObject({ nik: '00043328', jobTitle: 'HC STAFF', serviceFunction: 'Pelayanan Perjalanan Dinas · Pelayanan Uang Makan Uang Transport Uang Lembur' });
        expect(draft.problems).toEqual([]);
    });

    it('pairs shared services once, merges duplicate NIK checks and excludes self by NIK', async () => {
        const draft = await parseTemplateWorkbook(await matrix([PIC], [
            [71, 'BUDI', 'STAFF', null, 1, null, 'V'],
            ['00000071', 'BUDI', 'STAFF', null, 1, null, null, 'V'],
            ['00043328', 'OTHER SPELLING', null, null, 1, null, 'V'],
            [72, 'UNRELATED', null, null, 1, 'V'],
            [73, 'CITRA', 'MANAGER', null, 2, null, 'V', 'V'],
        ]));
        expect(draft.pics[0].raters).toEqual([{ name: 'BUDI', jobTitle: 'STAFF', nik: '00000071' }, { name: 'CITRA', jobTitle: 'MANAGER', nik: '00000073' }]);
    });

    it('uses union of duplicate NIK even when only the later row shares a service', async () => {
        const draft = await parseTemplateWorkbook(await matrix([PIC], [[71, 'BUDI', null, null, 1, 'V'], [71, 'BUDI', null, null, 1, null, 'V']]));
        expect(draft.pics[0].raters).toEqual([expect.objectContaining({ nik: '00000071' })]);
    });

    it('skips trailing zero rows and ignores other sheets', async () => {
        const draft = await parseTemplateWorkbook(await matrix([PIC, [null, null, null, null, 0]], [[null, null, null, null, 0]]));
        expect(draft.pics).toHaveLength(1);
        expect(draft.pics[0].raters).toEqual([]);
        expect(draft.problems).toEqual([]);
    });

    it('supports no Sum header and treats nonzero nonempty cells as checks', async () => {
        const draft = await parseTemplateWorkbook(await matrix([[1, 'PIC', null, null, 1, 0, 'x']], [[2, 'BUDI', null, null, 1, null, 1]], false));
        expect(draft.pics[0].serviceCode).toBe('HCC');
        expect(draft.pics[0].raters).toHaveLength(1);
    });

    it('records mixed groups and keeps the first checked group', async () => {
        const draft = await parseTemplateWorkbook(await matrix([[1, 'PIC', null, null, 2, 'V', 'V']], []));
        expect(draft.pics[0].serviceCode).toBe('HCS');
        expect(draft.problems).toEqual([{ row: 4, message: expect.stringMatching(/grup/i) }]);
    });

    it('finds shifted columns and a header on row ten without hardcoded letters', async () => {
        const book = new ExcelJS.Workbook();
        for (const name of ['List PIC', 'List Penilai']) {
            const sheet = book.addWorksheet(name);
            sheet.getRow(9).values = [null, null, null, null, null, 'Comben'];
            sheet.getRow(10).values = ['Note', 'NAMA', 'JABATAN', 'NIK', 'Sum', 'Payroll'];
            sheet.getRow(11).values = [null, name === 'List PIC' ? 'PIC' : 'RATER', 'STAFF', name === 'List PIC' ? 1 : 2, 1, 'V'];
        }
        const draft = await parseTemplateWorkbook(Buffer.from(await book.xlsx.writeBuffer()));
        expect(draft.pics[0]).toMatchObject({ picName: 'PIC', nik: '00000001', jobTitle: 'STAFF', raters: [{ name: 'RATER', nik: '00000002' }] });
    });

    it('reports missing group when headers are on row one, without accessing row zero', async () => {
        const book = new ExcelJS.Workbook();
        for (const name of ['List PIC', 'List Penilai']) {
            book.addWorksheet(name).addRows([['NIK', 'NAMA', 'LOKASI', 'Payroll'], [1, 'PIC', 'JTB', 'V']]);
        }
        const draft = await parseTemplateWorkbook(Buffer.from(await book.xlsx.writeBuffer()));
        expect(draft.pics).toEqual([]);
        expect(draft.problems).toEqual([{ row: 2, message: 'Grup layanan PIC tidak dikenali' }]);
        const reads = book.worksheets.map((sheet) => jest.spyOn(sheet, 'getRow'));
        expect(parseMatrixWorkbook(book).problems).toEqual([{ row: 2, message: 'Grup layanan PIC tidak dikenali' }]);
        for (const read of reads) expect(read).not.toHaveBeenCalledWith(0);
    });

    it('rejects matrix sheets without NIK and NAMA headers in the first ten rows', async () => {
        const book = new ExcelJS.Workbook();
        book.addWorksheet('List PIC').getRow(11).values = ['NIK', 'NAMA', 'Sum', 'Payroll'];
        book.addWorksheet('List Penilai');
        await expect(parseTemplateWorkbook(Buffer.from(await book.xlsx.writeBuffer()))).rejects.toThrow(/Header NIK dan NAMA/);
    });

    it('reports joined functions longer than 150 rather than returning an unsafe PIC', async () => {
        const book = new ExcelJS.Workbook();
        for (const name of ['List PIC', 'List Penilai']) {
            book.addWorksheet(name).addRows([['', '', '', 'Comben'], ['NIK', 'NAMA', 'LOKASI', 'X'.repeat(151)], [1, 'PIC', 'JTB', 'V']]);
        }
        const draft = await parseTemplateWorkbook(Buffer.from(await book.xlsx.writeBuffer()));
        expect(draft.pics).toEqual([]);
        expect(draft.problems).toEqual([expect.objectContaining({ message: expect.stringMatching(/150/) })]);
    });
});
