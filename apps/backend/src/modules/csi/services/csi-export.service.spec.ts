import * as ExcelJS from 'exceljs';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { CsiRespondentMode } from '../csi.constants';
import { CsiExportService, sanitizeCell } from './csi-export.service';
import { hcReportFixture, reportFixture } from './csi-report-model.fixture';

const ICT_SHEETS = ['1 Ringkasan', '2 Peringkat', '3 Partisipasi & SLA', '4 Per pertanyaan', '5 Komentar'];
const HC_SHEETS = ['1 Ringkasan', '2 Per layanan', '3 Layanan-bagian-PIC', '4 Peringkat', '5 Partisipasi & SLA', '6 Rekap responden', '7 Per pertanyaan', '8 Komentar'];

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

    const raw = async () => {
        const { buffer, filename } = await service.buildRawWorkbook(ServiceScope.ICT, 'p1', NOW);
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer as any);
        return { workbook, filename };
    };
    const workbookOf = async (model: unknown) => {
        reports.getExecutiveModel.mockImplementation(async () => model);
        return load();
    };
    const headerRowOf = (sheet: ExcelJS.Worksheet, firstHeader: string) => {
        for (let row = 1; row <= sheet.rowCount; row++) if (sheet.getRow(row).getCell(1).value === firstHeader) return row;
        throw new Error(`header ${firstHeader} not found in ${sheet.name}`);
    };
    const headerOf = (sheet: ExcelJS.Worksheet, firstHeader: string) =>
        (sheet.getRow(headerRowOf(sheet, firstHeader)).values as unknown[]).slice(1).filter((value) => value !== undefined && value !== null);
    /** Data rows (and totals) of the table under `firstHeader`, up to the first empty row. */
    const rowsOf = (sheet: ExcelJS.Worksheet, firstHeader: string) => {
        const rows: unknown[][] = [];
        for (let row = headerRowOf(sheet, firstHeader) + 1; row <= sheet.rowCount; row++) {
            const values = (sheet.getRow(row).values as unknown[]).slice(1);
            if (!values.some((value) => value !== null && value !== undefined)) break;
            rows.push(values);
        }
        return rows;
    };
    const summaryCell = (workbook: ExcelJS.Workbook, label: string) => {
        const summary = workbook.getWorksheet('1 Ringkasan')!;
        const index = (summary.getColumn(1).values as unknown[]).indexOf(label);
        return index < 0 ? undefined : summary.getRow(index).getCell(2);
    };
    const summaryValue = (workbook: ExcelJS.Workbook, label: string) => summaryCell(workbook, label)?.value;
    const sheetText = (sheet: ExcelJS.Worksheet) => {
        const text: string[] = [];
        sheet.eachRow((row) => text.push(JSON.stringify(row.values)));
        return text.join('\n');
    };
    const allText = (workbook: ExcelJS.Workbook) => workbook.worksheets.map(sheetText).join('\n');
    const filterLastRow = (sheet: ExcelJS.Worksheet) => {
        const filter = sheet.autoFilter as unknown;
        const ref = typeof filter === 'string' ? filter : `${(filter as any).from}:${(filter as any).to}`;
        return Number(/(\d+)$/.exec(ref)![1]);
    };

    it('ICT main workbook: numbered sheets without the HC-only ones; no raw answers read', async () => {
        const workbook = await load();
        expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(ICT_SHEETS);
        expect(reports.listAnswers).not.toHaveBeenCalled();
    });

    it('HC main workbook: sheets 1-8 in the agreed order', async () => {
        const workbook = await workbookOf(hcReportFixture({ respondents: 30 }).model);
        expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(HC_SHEETS);
    });

    it('main workbook carries no rater name or e-mail anywhere (HC and ICT)', async () => {
        const hc = allText(await workbookOf(hcReportFixture({ respondents: 30 }).model));
        const ict = allText(await workbookOf(reportFixture({ people: 3, sites: 2 }).model));
        expect(hc).toContain('Anita Payroll');
        expect(`${hc}\n${ict}`).not.toMatch(/Penilai Rahasia|titi yusliyanti|akun|@[a-z]/i);
    });

    it('header style: navy, white bold Calibri, wrapped; zebra and hairline borders; frozen, print titles, tab colour', async () => {
        const sheet = (await workbookOf(hcReportFixture({ respondents: 30 }).model)).getWorksheet('4 Peringkat')!;
        const headerRow = headerRowOf(sheet, 'Layanan');
        const header = sheet.getRow(headerRow).getCell(1);
        expect(header.fill).toMatchObject({ type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3A5F' } });
        expect(header.font).toMatchObject({ bold: true, name: 'Calibri', color: { argb: 'FFFFFFFF' } });
        expect(header.alignment).toMatchObject({ wrapText: true, vertical: 'middle' });
        expect(sheet.getRow(headerRow + 2).getCell(3).fill).toMatchObject({ fgColor: { argb: 'FFF5F7FA' } });
        expect(sheet.getRow(headerRow + 1).getCell(3).border?.left).toMatchObject({ style: 'thin', color: { argb: 'FFD9DEE7' } });
        expect(sheet.views[0]).toMatchObject({ state: 'frozen', ySplit: headerRow, xSplit: 1 });
        expect(sheet.pageSetup).toMatchObject({ orientation: 'landscape', fitToWidth: 1, paperSize: 9, printTitlesRow: `${headerRow}:${headerRow}` });
        expect(sheet.properties.tabColor).toBeTruthy();
    });

    it('Ringkasan: title block, real numbers (score, percent as a fraction with 0%), hyperlinked table of contents', async () => {
        const { model } = hcReportFixture({ respondents: 30 });
        const workbook = await workbookOf(model);
        const summary = workbook.getWorksheet('1 Ringkasan')!;
        expect(summary.getCell('A1').value).toBe('Laporan Kepuasan Layanan HC');
        expect(String(summary.getCell('A2').value)).toContain('CSI HC November');
        const overall = summaryCell(workbook, 'Nilai keseluruhan (1-5)')!;
        expect(overall.value).toBe(model.overall.average);
        expect(overall.numFmt).toBe('0.00');
        const pct = summaryCell(workbook, 'SLA % sudah mengisi')!;
        expect(pct.value).toBe(0.75);
        expect(pct.numFmt).toBe('0%');
        expect(summaryValue(workbook, 'Indeks')).toBeCloseTo(model.overall.indexPct! / 100, 5);
        HC_SHEETS.slice(1).forEach((name) => expect((summaryValue(workbook, name) as any).formula).toContain(`#'${name}'!A1`));
    });

    it('Ringkasan readability: long notes get taller rows, aspect notes do not repeat the label, TOC cells look like links', async () => {
        const { model } = hcReportFixture({ respondents: 30 });
        const workbook = await workbookOf(model);
        const summary = workbook.getWorksheet('1 Ringkasan')!;
        const aspect = model.aspects[0];
        const row = summaryCell(workbook, aspect.label)!.row as unknown as number;
        const note = String(summary.getCell(row, 3).value);
        expect(note).toMatch(/^\d+ jawaban · /);
        expect(note).not.toContain(`${aspect.label} — `);
        const lines = Math.ceil(note.length / ((summary.getColumn(3).width ?? 10) - 2));
        expect(summary.getRow(row).height).toBeGreaterThanOrEqual(lines * 13);
        const longRow = summaryCell(workbook, 'Nilai keseluruhan (1-5)')!.row as unknown as number;
        expect(summary.getRow(longRow).height).toBeGreaterThan(0);
        const link = summaryCell(workbook, '4 Peringkat')!;
        expect(link.font).toMatchObject({ underline: true, color: { argb: 'FF1F5FA8' } });
    });

    it('"2 Per layanan" (two stacked tables): no freeze, no filter', async () => {
        const sheet = (await workbookOf(hcReportFixture({ respondents: 30 }).model)).getWorksheet('2 Per layanan')!;
        expect(sheet.autoFilter).toBeFalsy();
        expect(sheet.views[0]?.state ?? 'normal').not.toBe('frozen');
    });

    it('"3 Layanan-bagian-PIC": Jabatan and Fungsi pelayanan last and capped, names column repeats when printed', async () => {
        const sheet = (await workbookOf(hcReportFixture({ respondents: 30 }).model)).getWorksheet('3 Layanan-bagian-PIC')!;
        const header = headerOf(sheet, 'Layanan / Bagian / PIC');
        expect(header.slice(-2)).toEqual(['Jabatan', 'Fungsi pelayanan']);
        expect(sheet.getColumn(header.length - 1).width).toBeLessThanOrEqual(30);
        expect(sheet.getColumn(header.length).width).toBeLessThanOrEqual(30);
        expect(sheet.pageSetup).toMatchObject({ fitToWidth: 1, fitToHeight: 0, printTitlesColumn: 'A:A' });
    });

    it('Ringkasan: simulation banner only for a SIMULASI survey', async () => {
        expect(allText(await workbookOf(hcReportFixture().model))).not.toContain('SIMULASI');
        const simulated = await workbookOf({ ...hcReportFixture().model, simulation: true });
        expect(String(simulated.getWorksheet('1 Ringkasan')!.getCell('A3').value)).toMatch(/^SIMULASI/);
        expect(String(simulated.getWorksheet('8 Komentar')!.getCell('A3').value)).toMatch(/^SIMULASI/);
    });

    it('executive sheets carry the same parameters as the PDF: notes, departments without names', async () => {
        const { buffer } = await service.buildWorkbook(ServiceScope.ICT, 'p1', NOW, { notes: 'Tindak lanjut A' });
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer as any);
        const labels = workbook.getWorksheet('1 Ringkasan')!.getColumn(1).values as unknown[];
        expect(labels).toEqual(expect.arrayContaining(['Nilai keseluruhan (1-5)', 'Predikat', 'Poin utama', 'Catatan & tindak lanjut']));
        const summary = workbook.getWorksheet('1 Ringkasan')!;
        expect(summary.getRow(labels.indexOf('Catatan & tindak lanjut') + 1).getCell(1).value).toBe('•  Tindak lanjut A');
        const participation = workbook.getWorksheet('3 Partisipasi & SLA')!;
        expect(headerOf(participation, 'Departemen')).toEqual(['Departemen', 'Sudah', 'Total', '%', 'Target']);
        expect(rowsOf(participation, 'Departemen')[0]).toEqual(['Departemen kecil (gabungan)', 0, 2, 0, 'Belum']);
        expect(rowsOf(participation, 'Departemen')[1][3]).toBe(0.2);
        expect(reports.getExecutiveModel).toHaveBeenCalledWith(ServiceScope.ICT, 'p1', expect.objectContaining({ notes: 'Tindak lanjut A' }));
    });

    it('summary SLA cells: sudah, basis, %, target % and orang, status; no "% Pengisi" anywhere', async () => {
        const { model } = hcReportFixture({ respondents: 30 });
        const workbook = await workbookOf(model);
        expect(summaryValue(workbook, 'Sudah mengisi')).toBe(30);
        expect(summaryValue(workbook, 'Basis partisipasi')).toBe(40);
        expect(summaryValue(workbook, 'Target SLA (%)')).toBe(0.9);
        expect(summaryValue(workbook, 'Target SLA (orang)')).toBe(36);
        expect(summaryValue(workbook, 'Status SLA')).toBe('Belum memenuhi SLA — kurang 6 jawaban');
        const met = await workbookOf({ ...model, sla: { ...model.sla, submitted: 36, met: true, missing: 0 } });
        expect(summaryValue(met, 'Status SLA')).toBe('Memenuhi SLA');
        expect(allText(workbook)).not.toContain('Pengisi');
    });

    it('Ringkasan: template raters without an iDesk account are counted (only when there are any)', async () => {
        const { model } = hcReportFixture({ respondents: 30 });
        const label = 'Penilai template tanpa akun';
        expect(summaryValue(await workbookOf({ ...model, templateRatersWithoutAccount: 0 }), label)).toBeUndefined();
        const workbook = await workbookOf({ ...model, templateRatersWithoutAccount: 4 });
        const cell = summaryCell(workbook, label)!;
        expect(cell.value).toBe(4);
        expect(workbook.getWorksheet('1 Ringkasan')!.getCell(Number(cell.row), 3).value).toBe('4 penilai di template belum punya akun iDesk (tidak termasuk basis)');
    });

    it('HC: one overall value in Ringkasan, Partisipasi total and Per layanan total (per-rating recap basis)', async () => {
        const { model } = hcReportFixture({ respondents: 30 });
        const overall = model.hcRecap.overall.all.average;
        expect(model.overall.average).toBe(overall);
        const workbook = await workbookOf(model);
        expect(summaryValue(workbook, 'Nilai keseluruhan (1-5)')).toBe(overall);
        const total = rowsOf(workbook.getWorksheet('5 Partisipasi & SLA')!, 'Site').at(-1)!;
        expect(total[0]).toBe('Total');
        expect(total[6]).toBe(overall);
        const services = rowsOf(workbook.getWorksheet('2 Per layanan')!, 'Layanan');
        const header = headerOf(workbook.getWorksheet('2 Per layanan')!, 'Layanan');
        expect(services.find((cells) => cells[0] === 'Semua layanan')![header.indexOf('Rata-rata')]).toBe(overall);
    });

    it('Partisipasi: % as a fraction with 0%, totals row bold on the total fill and outside the filter', async () => {
        const sheet = (await workbookOf(hcReportFixture({ respondents: 30 }).model)).getWorksheet('5 Partisipasi & SLA')!;
        expect(headerOf(sheet, 'Site')).toEqual(['Site', 'Basis', 'Target', 'Sudah mengisi', '% Sudah mengisi', 'Status', 'Nilai']);
        const header = headerRowOf(sheet, 'Site');
        const totalRow = header + rowsOf(sheet, 'Site').length;
        const pct = sheet.getRow(header + 1).getCell(5);
        expect(pct.numFmt).toBe('0%');
        expect(typeof pct.value === 'number' && pct.value <= 1).toBe(true);
        expect(sheet.getRow(totalRow).getCell(1).font?.bold).toBe(true);
        expect(sheet.getRow(totalRow).getCell(1).fill).toMatchObject({ fgColor: { argb: 'FFE8EDF5' } });
        // The one filter of the sheet is on the department table, never on the site totals.
        expect(filterLastRow(sheet)).toBeGreaterThan(totalRow);
    });

    it('"2 Per layanan" ends its first table with the bold "Semua layanan" totals row', async () => {
        const sheet = (await workbookOf(hcReportFixture({ respondents: 30 }).model)).getWorksheet('2 Per layanan')!;
        const rows = rowsOf(sheet, 'Layanan');
        expect(rows.at(-1)![0]).toBe('Semua layanan');
        const total = sheet.getRow(headerRowOf(sheet, 'Layanan') + rows.length).getCell(1);
        expect(total.font?.bold).toBe(true);
        expect(total.fill).toMatchObject({ fgColor: { argb: 'FFE8EDF5' } });
    });

    it('score cells take the survey band fill', async () => {
        const { model } = hcReportFixture({ respondents: 30 });
        const good = (await workbookOf({ ...model, bands: { fairMin: 1, goodMin: 1.5 } })).getWorksheet('2 Per layanan')!;
        expect(good.getRow(headerRowOf(good, 'Layanan') + 1).getCell(2).fill).toMatchObject({ fgColor: { argb: 'FFD7F2EC' } });
        const poor = (await workbookOf({ ...model, bands: { fairMin: 4.9, goodMin: 5 } })).getWorksheet('2 Per layanan')!;
        expect(poor.getRow(headerRowOf(poor, 'Layanan') + 1).getCell(2).fill).toMatchObject({ fgColor: { argb: 'FFFBDDD7' } });
    });

    it('"4 Peringkat" per layanan: competition ranks, unranked rows unnumbered with a note', async () => {
        const { model } = hcReportFixture({ respondents: 30 });
        const row = (name: string, raters: number, average: number) => ({ name, detail: 'PAYROLL', raters, average, word: 'Puas', previous: null, delta: null });
        const ranking = [
            { serviceCode: 'HCD', serviceName: 'HC Development', ranked: [{ ...row('A', 6, 4.5), rank: 1 }, { ...row('B', 5, 4.5), rank: 1 }, { ...row('C', 7, 4.1), rank: 3 }], insufficient: [{ ...row('D', 2, 4.9), rank: null }],
                noAnswers: [{ ...row('F', 0, 0), average: null, word: null, rank: null }] },
            { serviceCode: 'HCC', serviceName: 'HC Compensation & Benefit', ranked: [{ ...row('E', 5, 4.2), rank: 1 }], insufficient: [], noAnswers: [] },
        ];
        const sheet = (await workbookOf({ ...model, hasPrevious: false, rankingByService: ranking })).getWorksheet('4 Peringkat')!;
        expect(headerOf(sheet, 'Layanan')).toEqual(['Layanan', '#', 'Nama', 'Bagian', 'Penilai', 'Nilai', 'Predikat', 'Keterangan']);
        expect(rowsOf(sheet, 'Layanan').map((cells) => [cells[0], cells[1] ?? null, cells[2], cells[7] ?? null])).toEqual([
            ['HCD · HC Development', 1, 'A', null], ['HCD · HC Development', 1, 'B', null], ['HCD · HC Development', 3, 'C', null],
            ['HCD · HC Development', null, 'D', 'Belum cukup penilai (< 5)'], ['HCD · HC Development', null, 'F', 'Belum ada penilaian'],
            ['HCC · HC Compensation & Benefit', 1, 'E', null],
        ]);
    });

    it('"Peringkat" adds Lalu / Δ only with a previous period; ICT groups are Tim and Orang with a Site column', async () => {
        const hc = (await workbookOf(hcReportFixture({ previous: true }).model)).getWorksheet('4 Peringkat')!;
        expect(headerOf(hc, 'Layanan')).toEqual(['Layanan', '#', 'Nama', 'Bagian', 'Penilai', 'Nilai', 'Predikat', 'Lalu', 'Δ', 'Keterangan']);
        const ict = (await workbookOf(reportFixture({ people: 3, sites: 2 }).model)).getWorksheet('2 Peringkat')!;
        expect(headerOf(ict, 'Kelompok')[3]).toBe('Site');
        expect(new Set(rowsOf(ict, 'Kelompok').map((cells) => cells[0]))).toEqual(new Set(['Tim', 'Orang']));
    });

    it('"8 Komentar" has no date or department columns and is ordered per layanan HCD, HCC, HCS', async () => {
        const { model } = hcReportFixture();
        const sheet = (await workbookOf(model)).getWorksheet('8 Komentar')!;
        expect(headerOf(sheet, 'Layanan')).toEqual(['Layanan', 'Dinilai', 'Jenis', 'Komentar']);
        const rows = rowsOf(sheet, 'Layanan');
        expect(rows.flat().join(' ')).not.toMatch(/PRODUKSI|2026/);
        const services = rows.map((cells) => String(cells[0]).slice(0, 3));
        expect(services[0]).toBe('HCD');
        expect([...services]).toEqual([...services].sort((a, b) => ['HCD', 'HCC', 'HCS'].indexOf(a) - ['HCD', 'HCC', 'HCS'].indexOf(b)));
        expect(rowsOf((await workbookOf(model)).getWorksheet('8 Komentar')!, 'Layanan')).toEqual(rows);
    });

    it('"6 Rekap responden" has no location columns: only the total and the respondent count', async () => {
        const sheet = (await workbookOf(hcReportFixture().model)).getWorksheet('6 Rekap responden')!;
        expect(headerOf(sheet, 'Divisi / Departemen / Bagian')).toEqual(['Divisi / Departemen / Bagian', 'Tingkat', 'Rata-rata diberikan', 'Responden']);
    });

    it('"3 Layanan-bagian-PIC": location cells under 3 respondents are empty; levels styled', async () => {
        const { model } = hcReportFixture();
        const sheet = (await workbookOf(model)).getWorksheet('3 Layanan-bagian-PIC')!;
        const headerRow = headerRowOf(sheet, 'Layanan / Bagian / PIC');
        const header = headerOf(sheet, 'Layanan / Bagian / PIC');
        const masked = model.hcRecap.services.findIndex((row) => Object.values(row.byLocation).some((cell) => cell.ratings > 0 && cell.average === null));
        expect(masked).toBeGreaterThanOrEqual(0);
        const row = model.hcRecap.services[masked];
        const cells = (sheet.getRow(headerRow + 1 + masked).values as unknown[]).slice(1);
        model.hcRecap.locations.forEach((location) => {
            if (row.byLocation[location.code].average === null) expect(cells[header.indexOf(location.label)] ?? null).toBeNull();
        });
        expect(sheet.getRow(headerRow + 1).getCell(1).font?.bold).toBe(true);
        expect(sheet.getRow(headerRow + 1).getCell(1).fill).toMatchObject({ fgColor: { argb: 'FFDCE4EF' } });
        const pic = model.hcRecap.services.findIndex((service) => service.level === 'pic');
        expect(sheet.getRow(headerRow + 1 + pic).getCell(1).alignment?.indent).toBe(2);
    });

    describe('raw-data workbook', () => {
        it('confidential filename, red banner above every table, header row 3, sheets in order', async () => {
            const { workbook, filename } = await raw();
            expect(filename).toBe('csi-ict-2026-10-25 - DATA MENTAH (RAHASIA).xlsx');
            expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['Penilaian Tim', 'Penilaian Per Orang', 'Penilai x Subjek']);
            workbook.worksheets.forEach((sheet) => {
                expect(String(sheet.getCell('A1').value)).toMatch(/^RAHASIA/);
                expect(sheet.getCell('A1').fill).toMatchObject({ fgColor: { argb: 'FFB42318' } });
                expect(sheet.views[0]).toMatchObject({ state: 'frozen', ySplit: 3 });
            });
        });

        it('answer sheets: Point columns only for scored questions, timestamps as Date (WIB)', async () => {
            const { workbook } = await raw();
            const team = workbook.getWorksheet('Penilaian Tim')!;
            expect((team.getRow(3).values as unknown[]).slice(1)).toEqual(['Timestamp', 'Nama', 'Area Kerja', 'Departemen', 'Kecepatan', 'Point 1', 'Average']);
            const first = (team.getRow(4).values as unknown[]).slice(1);
            expect(first[0]).toBeInstanceOf(Date);
            // 2025-11-03 08:14:32Z shows as 15:14:32 (Jakarta).
            expect((first[0] as Date).toISOString()).toBe('2025-11-03T15:14:32.000Z');
            expect(team.getRow(4).getCell(1).numFmt).toBe('dd mmm yyyy hh:mm');
            expect(first.slice(1)).toEqual(['titi yusliyanti', 'SEPANJANG', "'+Keuangan", 4, 4, 4]);
            const people = workbook.getWorksheet('Penilaian Per Orang')!;
            expect((people.getRow(3).values as unknown[]).slice(1)).toEqual([
                'Timestamp', 'Nama', 'Area Kerja', 'Departemen', 'Dinilai', 'Ramah', 'Point 1', 'Channel', 'Saran', 'Average',
            ]);
            expect((people.getRow(4).values as unknown[]).slice(2)).toEqual(['titi yusliyanti', 'SEPANJANG', "'+Keuangan", 'Budi', 5, 5, 'Email', "'-bagus", 5]);
        });

        it('omits Penilaian Tim without a TEAM ratee', async () => {
            const report = await reports.getReport();
            report.ratees = report.ratees.filter((ratee: any) => ratee.kind === 'PERSON');
            reports.getReport.mockResolvedValue(report);
            expect((await raw()).workbook.worksheets.map((sheet) => sheet.name)).toEqual(['Penilaian Per Orang', 'Penilai x Subjek']);
        });

        it('"Penilai x Subjek": one row per respondent, totals below and outside the filter, band fills', async () => {
            const sheet = (await raw()).workbook.getWorksheet('Penilai x Subjek')!;
            expect((sheet.getRow(3).values as unknown[]).slice(1)).toEqual(['Timestamp', 'Nama penilai', 'Area Kerja', 'Departemen', 'Tim · Tim IT Support', `'=HYPERLINK("x")`, 'Rata-rata penilai']);
            expect((sheet.getRow(4).values as unknown[]).slice(2)).toEqual(['titi yusliyanti', 'SEPANJANG', "'+Keuangan", 4, 5, 4.5]);
            expect(sheet.getRow(4).getCell(1).value).toBeInstanceOf(Date);
            expect(sheet.getRow(5).getCell(2).value).toBe('Jumlah penilai');
            expect(sheet.getRow(5).getCell(5).value).toBe(1);
            expect(sheet.getRow(6).getCell(6).value).toBe(5);
            expect(filterLastRow(sheet)).toBe(4);
            expect(sheet.views[0]).toMatchObject({ state: 'frozen', xSplit: 4, ySplit: 3 });
            // Default bands 4.0 / 4.5: 5 good, 4 fair.
            expect(sheet.getRow(4).getCell(6).fill).toMatchObject({ fgColor: { argb: 'FFD7F2EC' } });
            expect(sheet.getRow(4).getCell(5).fill).toMatchObject({ fgColor: { argb: 'FFFFF1CC' } });
        });

        it('custom survey bands colour the matrix', async () => {
            reports.getExecutiveModel.mockImplementation(async () => ({ ...reportFixture({ people: 3, sites: 2 }).model, bands: { fairMin: 3, goodMin: 3.8 } }));
            const sheet = (await raw()).workbook.getWorksheet('Penilai x Subjek')!;
            expect(sheet.getRow(4).getCell(5).fill).toMatchObject({ fgColor: { argb: 'FFD7F2EC' } });
        });

        it('simulated survey: amber SIMULASI line under the confidential banner on every raw sheet', async () => {
            reports.getExecutiveModel.mockImplementation(async () => ({ ...hcReportFixture().model, simulation: true }));
            const { workbook } = await raw();
            workbook.worksheets.forEach((sheet) => {
                expect(String(sheet.getCell('A2').value)).toMatch(/^SIMULASI/);
                expect(sheet.getCell('A2').fill).toMatchObject({ fgColor: { argb: 'FFFFF1CC' } });
            });
        });

        it('ICT: no "HC Jawaban Responden" sheet', async () => {
            expect((await raw()).workbook.getWorksheet('HC Jawaban Responden')).toBeUndefined();
        });

        it('HC: respondent answers per PIC in layanan order HCD, HCC, HCS (names only in this file)', async () => {
            reports.getExecutiveModel.mockImplementation(async () => hcReportFixture().model);
            const sheet = (await raw()).workbook.getWorksheet('HC Jawaban Responden')!;
            expect(sheet.getRow(3).getCell(1).value).toBe('Responden');
            const order = ['HCD', 'HCC', 'HCS'];
            const byRespondent = new Map<string, string[]>();
            for (let row = 4; row <= sheet.rowCount; row++) {
                const cells = (sheet.getRow(row).values as unknown[]).slice(1);
                byRespondent.set(String(cells[0]), [...(byRespondent.get(String(cells[0])) ?? []), String(cells[5])]);
            }
            expect([...byRespondent.keys()].some((name) => name.startsWith('Penilai Rahasia'))).toBe(true);
            byRespondent.forEach((codes) => expect(codes).toEqual([...codes].sort((a, b) => order.indexOf(a) - order.indexOf(b))));
            expect([...byRespondent.values()].some((codes) => new Set(codes).size > 1)).toBe(true);
        });
    });
});
