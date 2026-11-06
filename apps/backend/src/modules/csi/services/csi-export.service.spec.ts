import * as ExcelJS from 'exceljs';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { CsiRespondentMode } from '../csi.constants';
import { CsiExportService, sanitizeCell } from './csi-export.service';
import { reportFixture } from './csi-report-model.fixture';

const EXECUTIVE = ['Ringkasan', 'Peringkat Tim', 'Peringkat Orang', 'Partisipasi', 'Per Pertanyaan Tim', 'Per Pertanyaan Orang', 'Departemen', 'Komentar', 'Basis Partisipasi'];

const NOW = new Date('2026-10-24T18:30:00Z'); // 2026-10-25 01:30 WIB

const q = (name: string, type: string) => ({ name, type, average: null, count: 0, distribution: [] });
const score = (dimension: string, type: string, value: number | null, answerLabel: string | null = null, answerText: string | null = null) =>
    ({ dimension, type, score: value, answerLabel, answerText });

describe('CsiExportService', () => {
    let reports: { getReport: jest.Mock; listAnswers: jest.Mock; getRaterMatrix: jest.Mock; getExecutiveModel: jest.Mock };
    let service: CsiExportService;

    const load = async () => {
        const { buffer } = await service.buildWorkbook(ServiceScope.ICT, 'p1', NOW);
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer as any);
        return workbook;
    };

    beforeEach(() => {
        reports = {
            getReport: jest.fn(async () => ({
                period: {
                    id: 'p1', title: '=CSI Oktober', respondentMode: CsiRespondentMode.OPEN, teamLabel: 'Tim IT Support',
                    sites: [{ id: 's2', code: 'SMG', name: 'Semarang' }, { id: 's1', code: 'SPJ', name: 'Sepanjang' }],
                },
                overall: { average: 4.25, respondentCount: 1 },
                sla: { pengisiPct: 100 },
                ratees: [
                    { periodRateeId: 't', kind: 'TEAM', displayName: 'Tim IT Support', average: 4, questions: [q('Kecepatan', 'STAR')] },
                    { periodRateeId: 'r1', kind: 'PERSON', displayName: '=HYPERLINK("x")', average: 4.5, questions: [q('Ramah', 'STAR'), q('Channel', 'CHOICE'), q('Saran', 'TEXT')] },
                ],
            })),
            listAnswers: jest.fn(async () => ([{
                responseId: 'resp1', respondentName: 'titi yusliyanti', accountName: 'akun', areaName: 'Sepanjang', departmentName: '+Keuangan',
                submittedAt: new Date('2025-11-03T08:14:32Z'),
                ratees: [
                    { periodRateeId: 't', kind: 'TEAM', displayName: 'Tim IT Support', jobTitle: null, comment: null, scores: [score('Kecepatan', 'STAR', 4)] },
                    {
                        periodRateeId: 'r1', kind: 'PERSON', displayName: 'Budi', jobTitle: null, comment: null,
                        scores: [score('Ramah', 'STAR', 5), score('Channel', 'CHOICE', null, 'Email'), score('Saran', 'TEXT', null, null, '-bagus')],
                    },
                ],
            }])),
            getRaterMatrix: jest.fn(async () => ({ subjects: [], rows: [], totals: [] })),
            getExecutiveModel: jest.fn(async (_s: unknown, _p: unknown, input: { notes?: string }) => ({ ...reportFixture({ people: 3, sites: 2 }).model, notes: input.notes ?? '' })),
        };
        service = new CsiExportService(reports as any);
    });

    it('sanitizes formula-leading text only', () => {
        expect(sanitizeCell('=1+1')).toBe("'=1+1");
        expect(sanitizeCell('+62')).toBe("'+62");
        expect(sanitizeCell('-x')).toBe("'-x");
        expect(sanitizeCell('@a')).toBe("'@a");
        expect(sanitizeCell('\tcmd')).toBe("'\tcmd");
        expect(sanitizeCell('\rcmd')).toBe("'\rcmd");
        expect(sanitizeCell('Budi')).toBe('Budi');
    });

    it('excel has Rekap/Penilaian Tim/Penilaian Per Orang with Point columns only for scored questions', async () => {
        const workbook = await load();
        expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([...EXECUTIVE, 'Rekap', 'Penilaian Tim', 'Penilaian Per Orang', 'Penilai x Subjek']);

        const recap = workbook.getWorksheet('Rekap')!;
        expect(recap.getRow(1).values).toEqual([undefined, 'Lokasi', 'Nama', 'Average', 'Average survei', '% Pengisi (SLA)']);
        expect(recap.getRow(2).values).toEqual([undefined, 'Semarang & Sepanjang', 'Tim IT Support', 4, 4.25, 100]);
        expect(recap.getRow(3).getCell(2).value).toBe(`'=HYPERLINK("x")`);

        const team = workbook.getWorksheet('Penilaian Tim')!;
        expect(team.getRow(1).values).toEqual([undefined, 'Timestamp', 'Nama', 'Area Kerja', 'Departemen', 'Kecepatan', 'Point 1', 'Average']);
        expect(team.getRow(2).values).toEqual([undefined, '2025/11/03 3:14:32 PM GMT+7', 'titi yusliyanti', 'SEPANJANG', "'+Keuangan", 4, 4, 4]);

        const people = workbook.getWorksheet('Penilaian Per Orang')!;
        expect(people.getRow(1).values).toEqual([
            undefined, 'Timestamp', 'Nama', 'Area Kerja', 'Departemen', 'Dinilai', 'Ramah', 'Point 1', 'Channel', 'Saran', 'Average',
        ]);
        expect(people.getRow(2).values).toEqual([
            undefined, '2025/11/03 3:14:32 PM GMT+7', 'titi yusliyanti', 'SEPANJANG', "'+Keuangan", 'Budi', 5, 5, 'Email', "'-bagus", 5,
        ]);
    });

    it('omits Penilaian Tim without a TEAM ratee', async () => {
        const report = await reports.getReport();
        report.ratees = report.ratees.filter((ratee: any) => ratee.kind === 'PERSON');
        reports.getReport.mockResolvedValue(report);
        expect((await load()).worksheets.map((sheet) => sheet.name)).toEqual([...EXECUTIVE, 'Rekap', 'Penilaian Per Orang', 'Penilai x Subjek']);
    });

    it('excel header style teal and wrapped', async () => {
        const sheet = (await load()).getWorksheet('Penilaian Per Orang')!;
        const header = sheet.getRow(1);
        expect(header.height).toBe(60);
        expect(header.getCell(1).font?.bold).toBe(true);
        expect(header.getCell(1).fill).toMatchObject({ type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4BC0C8' } });
        expect(header.getCell(1).alignment).toMatchObject({ wrapText: true, vertical: 'middle' });
        expect(sheet.autoFilter).toBeTruthy();
        expect(header.getCell(1).border?.top?.style).toBe('thin');
        expect(sheet.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
        expect(sheet.getColumn(1).width).toBe(26);
        expect(sheet.getColumn(3).width).toBe(16);
        expect(sheet.getColumn(6).width).toBe(22);
        expect(sheet.getColumn(7).width).toBe(8);
        expect(sheet.getColumn(10).width).toBe(11);
        const average = sheet.getRow(2).getCell(10);
        expect(average.numFmt).toBe('0.00');
        expect(average.fill).toMatchObject({ fgColor: { argb: 'FFDDF2F4' } });
        expect(average.border?.left?.style).toBe('thin');
    });

    it('adds a "Penilai x Subjek" sheet: one row per respondent, average per subject, totals below', async () => {
        const sheet = (await load()).getWorksheet('Penilai x Subjek')!;
        expect(sheet.getRow(1).values).toEqual([undefined, 'Timestamp', 'Nama penilai', 'Area Kerja', 'Departemen', 'Tim · Tim IT Support', `'=HYPERLINK("x")`, 'Rata-rata penilai']);
        expect(sheet.getRow(2).values).toEqual([undefined, '2025/11/03 3:14:32 PM GMT+7', 'titi yusliyanti', 'SEPANJANG', "'+Keuangan", 4, 5, 4.5]);
        expect(sheet.getRow(3).getCell(2).value).toBe('Jumlah penilai');
        expect(sheet.getRow(3).getCell(5).value).toBe(1);
        expect(sheet.getRow(4).getCell(6).value).toBe(5);
        expect(sheet.getRow(2).getCell(6).fill).toMatchObject({ fgColor: { argb: 'FFD7F0DE' } });
        expect(sheet.views[0]).toMatchObject({ state: 'frozen', xSplit: 4, ySplit: 1 });
    });

    it('executive sheets carry the same parameters as the PDF: separate team/people rankings, notes, every basis person', async () => {
        const { buffer } = await service.buildWorkbook(ServiceScope.ICT, 'p1', NOW, { notes: 'Tindak lanjut A' });
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer as any);
        const summary = workbook.getWorksheet('Ringkasan')!;
        const labels = summary.getColumn(1).values as unknown[];
        expect(labels).toEqual(expect.arrayContaining(['Nilai keseluruhan (1-5)', 'Predikat', 'Δ vs periode lalu', 'Poin utama', 'Catatan & tindak lanjut']));
        const notesRow = labels.indexOf('Catatan & tindak lanjut');
        expect(summary.getRow(notesRow).getCell(2).value).toBe('Tindak lanjut A');
        expect(workbook.getWorksheet('Peringkat Tim')!.rowCount).toBe(1 + 2);
        expect(workbook.getWorksheet('Peringkat Orang')!.rowCount).toBe(1 + 3);
        expect(workbook.getWorksheet('Peringkat Orang')!.getRow(1).values).toEqual([
            undefined, '#', 'Nama', 'Site', 'Penilai', 'Nilai', 'Predikat', 'Indeks (%)', 'Periode lalu', 'Δ', '★1', '★2', '★3', '★4', '★5',
        ]);
        expect(workbook.getWorksheet('Departemen')!.getRow(3).values).toEqual([undefined, 'Keuangan', 0, 0]);
        expect(workbook.getWorksheet('Basis Partisipasi')!.rowCount).toBe(1 + 12);
        expect(reports.getExecutiveModel).toHaveBeenCalledWith(ServiceScope.ICT, 'p1', expect.objectContaining({ notes: 'Tindak lanjut A' }));
    });
});
