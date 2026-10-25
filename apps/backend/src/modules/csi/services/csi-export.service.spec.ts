import * as ExcelJS from 'exceljs';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { CsiRespondentMode } from '../csi.constants';
import { CsiExportService, sanitizeCell } from './csi-export.service';

const NOW = new Date('2026-10-24T18:30:00Z'); // 2026-10-25 01:30 WIB

describe('CsiExportService', () => {
    let reports: { getReport: jest.Mock; getRespondents: jest.Mock; listAnswers: jest.Mock };
    let service: CsiExportService;

    beforeEach(() => {
        reports = {
            getReport: jest.fn(async () => ({
                period: { id: 'p1', scope: ServiceScope.ICT, title: '=CSI Oktober', respondentMode: CsiRespondentMode.LISTED },
                ratees: [{
                    periodRateeId: 'r1', displayName: '=HYPERLINK("x")', jobTitle: 'Teknisi', respondentCount: 2, average: 3, indexPct: 60,
                    dimensions: [{ name: 'Responsif', average: 4, count: 2 }, { name: 'Ramah', average: 2, count: 1 }],
                }],
            })),
            getRespondents: jest.fn(async () => ({
                mode: CsiRespondentMode.LISTED,
                submitted: [{ responseId: 'resp1', fullName: 'Andi', departmentName: '+Keuangan', submittedAt: new Date('2026-10-10T03:00:00Z') }],
                pending: [{ userId: 'x3', fullName: '@Yudi' }],
                totals: { submitted: 1, pending: 1 },
            })),
            listAnswers: jest.fn(async () => ([{
                responseId: 'resp1', fullName: 'Andi', departmentName: '+Keuangan', submittedAt: new Date('2026-10-10T03:00:00Z'),
                ratees: [{ periodRateeId: 'r1', displayName: 'Budi', jobTitle: 'Teknisi', comment: '-hapus', scores: [{ dimension: 'Responsif', score: 5 }] }],
            }])),
        };
        service = new CsiExportService(reports as any);
    });

    it('sanitizes formula-leading text only', () => {
        expect(sanitizeCell('=1+1')).toBe("'=1+1");
        expect(sanitizeCell('+62')).toBe("'+62");
        expect(sanitizeCell('-x')).toBe("'-x");
        expect(sanitizeCell('@a')).toBe("'@a");
        expect(sanitizeCell('Budi')).toBe('Budi');
    });

    it('builds the three sheets with bold headers, data rows and sanitized text', async () => {
        const { filename, buffer } = await service.buildWorkbook(ServiceScope.ICT, 'p1', NOW);
        expect(filename).toBe('csi-ict-2026-10-25.xlsx');

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer as any);
        expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['Nilai', 'Jawaban', 'Status Responden']);

        const scores = workbook.getWorksheet('Nilai')!;
        expect(scores.getRow(1).values).toEqual([undefined, 'Nama', 'Jabatan', 'Responden', 'Responsif', 'Ramah', 'Rata-rata', 'Indeks %']);
        expect(scores.getRow(1).getCell(1).font?.bold).toBe(true);
        expect(scores.getRow(2).values).toEqual([undefined, `'=HYPERLINK("x")`, 'Teknisi', 2, 4, 2, 3, 60]);

        const answers = workbook.getWorksheet('Jawaban')!;
        expect(answers.getRow(1).values).toEqual([undefined, 'Responden', 'Departemen', 'Dinilai', 'Dimensi', 'Skor', 'Komentar']);
        expect(answers.getRow(2).values).toEqual([undefined, 'Andi', "'+Keuangan", 'Budi', 'Responsif', 5, "'-hapus"]);

        const status = workbook.getWorksheet('Status Responden')!;
        expect(status.getRow(1).getCell(1).font?.bold).toBe(true);
        const rows = status.getSheetValues().slice(2).map((row: any) => row.slice(1, 3));
        expect(rows).toContainEqual(['Andi', "'+Keuangan"]);
        expect(rows).toContainEqual(["'@Yudi", '']);
    });
});
