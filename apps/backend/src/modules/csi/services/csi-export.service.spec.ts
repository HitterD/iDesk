import * as ExcelJS from 'exceljs';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { CsiRespondentMode } from '../csi.constants';
import { CsiExportService, sanitizeCell } from './csi-export.service';
import { hcReportFixture, reportFixture } from './csi-report-model.fixture';

const EXECUTIVE = ['Ringkasan', 'Peringkat', 'Partisipasi', 'Per Pertanyaan Tim', 'Per Pertanyaan Orang', 'Departemen', 'Komentar'];

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

    it('Rekap names each custom team by its own name, falling back to the period team label', async () => {
        const report = await reports.getReport();
        report.ratees = [
            { periodRateeId: 't1', kind: 'TEAM', displayName: 'Tim Payroll', average: 4, questions: [q('Kecepatan', 'STAR')] },
            { periodRateeId: 't2', kind: 'TEAM', displayName: '', average: 3, questions: [q('Kecepatan', 'STAR')] },
        ];
        reports.getReport.mockResolvedValue(report);
        const recap = (await load()).getWorksheet('Rekap')!;
        expect(recap.getRow(2).getCell(2).value).toBe('Tim Payroll');
        expect(recap.getRow(3).getCell(2).value).toBe('Tim IT Support');
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

    it('custom bands colour the "Penilai x Subjek" cells by the survey bands', async () => {
        // Bands 3.0 / 3.8: the team score 4 is green here (orange with the default 4.0 / 4.5).
        reports.getExecutiveModel.mockImplementation(async () => ({ ...reportFixture({ people: 3, sites: 2 }).model, bands: { fairMin: 3, goodMin: 3.8 } }));
        const sheet = (await load()).getWorksheet('Penilai x Subjek')!;
        expect(sheet.getRow(2).getCell(5).value).toBe(4);
        expect(sheet.getRow(2).getCell(5).fill).toMatchObject({ fgColor: { argb: 'FFD7F0DE' } });
    });

    it('default bands colour a 4 orange in "Penilai x Subjek"', async () => {
        const sheet = (await load()).getWorksheet('Penilai x Subjek')!;
        expect(sheet.getRow(2).getCell(5).fill).toMatchObject({ fgColor: { argb: 'FFFCEBC8' } });
    });

    it('executive sheets carry the same parameters as the PDF: notes, departments without names', async () => {
        const { buffer } = await service.buildWorkbook(ServiceScope.ICT, 'p1', NOW, { notes: 'Tindak lanjut A' });
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer as any);
        const summary = workbook.getWorksheet('Ringkasan')!;
        const labels = summary.getColumn(1).values as unknown[];
        expect(labels).toEqual(expect.arrayContaining(['Nilai keseluruhan (1-5)', 'Predikat', 'Δ vs periode lalu', 'Poin utama', 'Catatan & tindak lanjut']));
        const notesRow = labels.indexOf('Catatan & tindak lanjut');
        expect(summary.getRow(notesRow).getCell(2).value).toBe('Tindak lanjut A');
        expect(workbook.getWorksheet('Departemen')!.getRow(1).values).toEqual([undefined, 'Departemen', 'Sudah', 'Total', '%', 'Target']);
        expect(workbook.getWorksheet('Departemen')!.getRow(2).values).toEqual([undefined, 'Departemen kecil (gabungan)', 0, 2, 0, 'Belum']);
        expect(workbook.getWorksheet('Basis Partisipasi')).toBeUndefined();
        expect(reports.getExecutiveModel).toHaveBeenCalledWith(ServiceScope.ICT, 'p1', expect.objectContaining({ notes: 'Tindak lanjut A' }));
    });
    const workbookOf = async (model: unknown) => {
        reports.getExecutiveModel.mockImplementation(async () => model);
        return load();
    };
    const rowsOf = (sheet: ExcelJS.Worksheet) => Array.from({ length: sheet.rowCount - 1 }, (_, i) => (sheet.getRow(i + 2).values as unknown[]).slice(1));
    const summaryValue = (workbook: ExcelJS.Workbook, label: string) => {
        const summary = workbook.getWorksheet('Ringkasan')!;
        const index = (summary.getColumn(1).values as unknown[]).indexOf(label);
        return index < 0 ? undefined : summary.getRow(index).getCell(2).value;
    };

    it('summary sheet carries the SLA cells: sudah/basis, %, target % and orang, status with the missing answers', async () => {
        const { model } = hcReportFixture({ respondents: 30 });
        const workbook = await workbookOf(model);
        expect(summaryValue(workbook, 'SLA sudah mengisi / basis')).toBe('30/40');
        expect(summaryValue(workbook, 'SLA % sudah mengisi')).toBe(75);
        expect(summaryValue(workbook, 'Target SLA (%)')).toBe(90);
        expect(summaryValue(workbook, 'Target SLA (orang)')).toBe(36);
        expect(summaryValue(workbook, 'Status SLA')).toBe('Belum memenuhi SLA — kurang 6 jawaban');
        const met = await workbookOf({ ...model, sla: { ...model.sla, submitted: 36, met: true, missing: 0 } });
        expect(summaryValue(met, 'Status SLA')).toBe('Memenuhi SLA');
    });

    it('one "Peringkat" sheet per layanan: competition ranks, insufficient rows unnumbered with a note, no Bintang', async () => {
        const { model } = hcReportFixture({ respondents: 30 });
        const row = (name: string, raters: number, average: number) => ({ name, detail: 'PAYROLL', raters, average, word: 'Puas', previous: null, delta: null });
        const ranking = [
            { serviceCode: 'HCD', serviceName: 'HC Development', ranked: [{ ...row('A', 6, 4.5), rank: 1 }, { ...row('B', 5, 4.5), rank: 1 }, { ...row('C', 7, 4.1), rank: 3 }], insufficient: [{ ...row('D', 2, 4.9), rank: null }] },
            { serviceCode: 'HCC', serviceName: 'HC Compensation & Benefit', ranked: [{ ...row('E', 5, 4.2), rank: 1 }], insufficient: [] },
        ];
        const sheet = (await workbookOf({ ...model, hasPrevious: false, rankingByService: ranking })).getWorksheet('Peringkat')!;
        const header = (sheet.getRow(1).values as unknown[]).slice(1);
        expect(header).toEqual(['Layanan', '#', 'Nama', 'Bagian / fungsi', 'Penilai', 'Nilai', 'Predikat', 'Keterangan']);
        expect(header.join('|')).not.toMatch(/★|Bintang|Lalu|Δ/);
        expect(rowsOf(sheet).map((cells) => [cells[0], cells[1] ?? null, cells[2], cells[7] ?? null])).toEqual([
            ['HCD · HC Development', 1, 'A', null], ['HCD · HC Development', 1, 'B', null], ['HCD · HC Development', 3, 'C', null],
            ['HCD · HC Development', null, 'D', 'Belum cukup penilai (< 5)'], ['HCC · HC Compensation & Benefit', 1, 'E', null],
        ]);
    });

    it('"Peringkat" adds Lalu / Δ only with a previous period; ICT groups are Tim and Orang with a Site column', async () => {
        const hc = (await workbookOf(hcReportFixture({ previous: true }).model)).getWorksheet('Peringkat')!;
        expect((hc.getRow(1).values as unknown[]).slice(1)).toEqual(['Layanan', '#', 'Nama', 'Bagian / fungsi', 'Penilai', 'Nilai', 'Predikat', 'Lalu', 'Δ', 'Keterangan']);
        const ict = (await workbookOf(reportFixture({ people: 3, sites: 2 }).model)).getWorksheet('Peringkat')!;
        expect((ict.getRow(1).values as unknown[])[4]).toBe('Site');
        expect(new Set(rowsOf(ict).map((cells) => cells[0]))).toEqual(new Set(['Tim', 'Orang']));
    });

    it('"Komentar" has no date or department columns and is ordered per layanan HCD, HCC, HCS', async () => {
        const { model } = hcReportFixture();
        const sheet = (await workbookOf(model)).getWorksheet('Komentar')!;
        expect((sheet.getRow(1).values as unknown[]).slice(1)).toEqual(['Layanan', 'Dinilai', 'Jenis', 'Komentar']);
        const rows = rowsOf(sheet);
        expect(rows.flat().join(' ')).not.toMatch(/PRODUKSI|2026/);
        const services = rows.map((cells) => String(cells[0]).slice(0, 3));
        const firstOf = (code: string) => services.indexOf(code);
        expect(firstOf('HCD')).toBe(0);
        expect(firstOf('HCD') < firstOf('HCC') && firstOf('HCC') < firstOf('HCS')).toBe(true);
        expect([...services]).toEqual([...services].sort((a, b) => ['HCD', 'HCC', 'HCS'].indexOf(a) - ['HCD', 'HCC', 'HCS'].indexOf(b)));
        // Stable: the same model gives the same order.
        expect(rowsOf((await workbookOf(model)).getWorksheet('Komentar')!)).toEqual(rows);
    });

    it('admin respondent-detail sheet lists each respondent\'s PICs in layanan order HCD, HCC, HCS', async () => {
        const sheet = (await workbookOf(hcReportFixture().model)).getWorksheet('HC Jawaban Responden')!;
        const order = ['HCD', 'HCC', 'HCS'];
        const byRespondent = new Map<string, string[]>();
        rowsOf(sheet).forEach((cells) => byRespondent.set(String(cells[0]), [...(byRespondent.get(String(cells[0])) ?? []), String(cells[5])]));
        byRespondent.forEach((codes) => expect(codes).toEqual([...codes].sort((a, b) => order.indexOf(a) - order.indexOf(b))));
        expect([...byRespondent.values()].some((codes) => new Set(codes).size > 1)).toBe(true);
    });
});
