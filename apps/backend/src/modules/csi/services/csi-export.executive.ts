import * as ExcelJS from 'exceljs';
import { DEFAULT_TIMEZONE, localDateKey } from '../../sla-config/business-hours.calc';
import { CsiRateeKind } from '../csi.constants';
import { addStyledSheet, AVERAGE_COLUMN, CellValue, ColumnSpec, PERCENT_COLUMN, sanitizeCell, WIDTH } from './csi-export.sheet';
import { CsiQuestionGrid, CsiReportModel, CsiReportRow } from './csi-report-model';

/** Sheets of the executive report, in workbook order (before the raw answer sheets). */
export const EXECUTIVE_SHEETS = {
    summary: 'Ringkasan', teams: 'Peringkat Tim', people: 'Peringkat Orang', participation: 'Partisipasi',
    teamGrid: 'Per Pertanyaan Tim', peopleGrid: 'Per Pertanyaan Orang', departments: 'Departemen', comments: 'Komentar', basis: 'Basis Partisipasi',
} as const;

const WIDE = 60;
const LABEL = 30;
const SHORT = 10;
const text = (value: string | null | undefined) => sanitizeCell(value ?? '');
const COUNT = (header: string): ColumnSpec => ({ header, width: SHORT });

function summarySheet(workbook: ExcelJS.Workbook, model: CsiReportModel) {
    const { overall, participation, counts } = model;
    const rows: CellValue[][] = [
        ['Survei', text(model.title)], ['Lingkup', model.scopeLabel], ['Periode', `${model.startDate} s/d ${model.endDate}`],
        ['Site', text(model.siteLabel)], ['Mode responden', model.modeLabel], ['No. dokumen', model.docNo],
        ['Nilai keseluruhan (1-5)', overall.average], ['Predikat', overall.word ?? '-'], ['Indeks (%)', overall.indexPct],
        ['Nilai periode lalu', overall.previous], ['Δ vs periode lalu', overall.delta],
        ['Basis partisipasi', `${participation.basis} (${participation.basisLabel})`], ['Target partisipasi', `${participation.target} (${model.targetPct}%)`],
        ['Responden', participation.responses], ['% Responden', participation.respondenPct], ['% Pengisi (SLA)', participation.pengisiPct],
        ['Status target', participation.reached ? 'Tercapai' : 'Belum tercapai'],
        ['Jumlah dinilai', `${counts.teams} tim · ${counts.people} orang · ${counts.sites} site`], ['Jumlah komentar', counts.comments],
        ...model.highlights.map((line, index): CellValue[] => [index ? '' : 'Poin utama', text(line)]),
        ...(model.notes ? model.notes.split(/\r?\n/).filter((line) => line.trim()) : ['-']).map((line, index): CellValue[] => [index ? '' : 'Catatan & tindak lanjut', text(line)]),
        ...model.aspects.map((aspect, index): CellValue[] => [index ? '' : 'Aspek layanan (terlemah dulu)', `${text(aspect.label)}: ${aspect.average?.toFixed(2) ?? '-'}`]),
    ];
    const sheet = addStyledSheet(workbook, EXECUTIVE_SHEETS.summary, [{ header: 'Parameter', width: LABEL }, { header: 'Nilai', width: WIDE + 30 }], rows);
    sheet.autoFilter = undefined as unknown as ExcelJS.AutoFilter;
    sheet.getColumn(1).font = { bold: true };
}

function rankingSheet(workbook: ExcelJS.Workbook, name: string, rows: CsiReportRow[], kind: CsiRateeKind) {
    addStyledSheet(workbook, name, [
        COUNT('#'), { header: kind === CsiRateeKind.TEAM ? 'Tim' : 'Nama', width: WIDTH.name }, COUNT('Site'), COUNT('Penilai'),
        AVERAGE_COLUMN('Nilai'), { header: 'Predikat', width: 16 }, { ...AVERAGE_COLUMN('Indeks (%)'), format: '0.0' },
        AVERAGE_COLUMN('Periode lalu'), AVERAGE_COLUMN('Δ'), COUNT('★1'), COUNT('★2'), COUNT('★3'), COUNT('★4'), COUNT('★5'),
    ], rows.map((row) => [row.rank, text(row.name), row.siteCode, row.raters, row.average, row.word, row.indexPct, row.previous, row.delta, ...row.stars]));
}

function participationSheet(workbook: ExcelJS.Workbook, model: CsiReportModel) {
    const total = model.participation;
    addStyledSheet(workbook, EXECUTIVE_SHEETS.participation, [
        { header: 'Site', width: WIDTH.name }, COUNT('Basis'), COUNT('Target'), COUNT('Responden'),
        PERCENT_COLUMN('% Responden'), PERCENT_COLUMN('% Pengisi (SLA)'), { header: 'Status', width: 14 }, AVERAGE_COLUMN('Nilai'),
    ], [
        ...model.sites.map((site): CellValue[] => [text(`${site.code ?? ''} ${site.name ?? ''}`.trim()), site.basis, site.target, site.responses, site.respondenPct, site.pengisiPct, site.reached ? 'Tercapai' : 'Belum', site.average]),
        ['Total', total.basis, total.target, total.responses, total.respondenPct, total.pengisiPct, total.reached ? 'Tercapai' : 'Belum', model.overall.average],
    ]);
}

/** Rows = subjects, one column per question (header = code + label); empty = question not assigned. */
function gridSheet(workbook: ExcelJS.Workbook, name: string, grid: CsiQuestionGrid) {
    if (!grid.rows.length) return;
    addStyledSheet(workbook, name, [
        { header: 'Nama', width: WIDTH.name }, COUNT('Site'),
        ...grid.columns.map((column) => ({ ...AVERAGE_COLUMN(text(`${column.code} · ${column.label}`)), width: WIDTH.question })),
    ], grid.rows.map((row) => [text(row.name), row.siteCode, ...row.values]));
}

/** Every sheet of the executive report: the same parameters as the PDF, nothing capped. */
export function addExecutiveSheets(workbook: ExcelJS.Workbook, model: CsiReportModel) {
    summarySheet(workbook, model);
    rankingSheet(workbook, EXECUTIVE_SHEETS.teams, model.teams, CsiRateeKind.TEAM);
    rankingSheet(workbook, EXECUTIVE_SHEETS.people, model.people, CsiRateeKind.PERSON);
    participationSheet(workbook, model);
    gridSheet(workbook, EXECUTIVE_SHEETS.teamGrid, model.teamGrid);
    gridSheet(workbook, EXECUTIVE_SHEETS.peopleGrid, model.peopleGrid);
    addStyledSheet(workbook, EXECUTIVE_SHEETS.departments, [{ header: 'Departemen', width: LABEL }, COUNT('Jawaban'), { ...PERCENT_COLUMN('% dari total'), format: '0.0"%"' }],
        model.departments.map((row) => [text(row.name), row.responses, row.pct]));
    addStyledSheet(workbook, EXECUTIVE_SHEETS.comments, [
        { header: 'Dinilai', width: WIDTH.name }, { header: 'Jenis', width: SHORT }, { header: 'Komentar', width: WIDE },
        { header: 'Departemen', width: WIDTH.department }, { header: 'Tanggal', width: 14 },
    ], model.comments.flatMap((group) => group.comments.map((comment): CellValue[] => [
        text(group.name), group.kind === CsiRateeKind.TEAM ? 'Tim' : 'Orang', text(comment.text), text(comment.department), localDateKey(comment.date, DEFAULT_TIMEZONE),
    ])));
    addStyledSheet(workbook, EXECUTIVE_SHEETS.basis, [
        COUNT('Site'), { header: 'Nama', width: WIDTH.name }, { header: 'Email', width: LABEL }, { header: 'Departemen', width: WIDTH.department }, { header: 'Status', width: 14 },
    ], model.basis.map((person) => [person.siteCode, text(person.fullName), text(person.email), text(person.department), person.answered ? 'Sudah mengisi' : 'Belum mengisi']));
}
