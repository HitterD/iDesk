import * as ExcelJS from 'exceljs';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { CsiRateeKind } from '../csi.constants';
import { serviceName } from '../org/csi-org.constants';
import { addStyledSheet, AVERAGE_COLUMN, CellValue, ColumnSpec, PERCENT_COLUMN, sanitizeCell, WIDTH } from './csi-export.sheet';
import { CsiQuestionGrid, CsiReportModel } from './csi-report-model';
import { commentOrder, INSUFFICIENT_LABEL, NO_ANSWERS_LABEL, slaStatusText, templateRatersNote } from './csi-report-pdf-sections';
import { compareServiceCodes, CsiRankRow, CsiServiceRanking, rankRowsOf } from './csi-report-ranking';

/** Sheets of the executive report, in workbook order (before the raw answer sheets). */
export const EXECUTIVE_SHEETS = {
    summary: 'Ringkasan', ranking: 'Peringkat', participation: 'Partisipasi',
    teamGrid: 'Per Pertanyaan Tim', peopleGrid: 'Per Pertanyaan Orang', departments: 'Departemen', comments: 'Komentar',
} as const;

const WIDE = 60;
const LABEL = 30;
const SHORT = 10;
const text = (value: string | null | undefined) => sanitizeCell(value ?? '');
const COUNT = (header: string): ColumnSpec => ({ header, width: SHORT });
/** "HCD · HC Development"; a group without a layanan (ICT Tim / Orang, HC Lainnya) keeps its own name. */
const groupLabel = (code: string | null, fallback: string) => (code ? `${code} · ${serviceName(code) ?? fallback}` : fallback);
const OTHER_SERVICE = 'Lainnya';
const isHc = (model: CsiReportModel) => model.scopeLabel === ServiceScope.HC;
const TEMPLATE_RATERS_LABEL = 'Penilai template tanpa akun';

/**
 * Official SLA cells, the same figures and status sentence as the PDF block (one percentage: answers ÷ basis), plus
 * the template raters left out of the basis for lack of an iDesk account (only when there are any).
 */
function slaRows(model: CsiReportModel): CellValue[][] {
    const { sla } = model;
    const note = templateRatersNote(model);
    return [
        ['SLA sudah mengisi / basis', `${sla.submitted}/${sla.basis}`], ['SLA % sudah mengisi', sla.pct],
        ['Target SLA (%)', sla.targetPct], ['Target SLA (orang)', sla.targetCount],
        ['Status SLA', sla.basis > 0 ? slaStatusText(sla) : 'Belum ada basis partisipasi'],
        ...(note ? [[TEMPLATE_RATERS_LABEL, note]] : []),
    ];
}

function summarySheet(workbook: ExcelJS.Workbook, model: CsiReportModel) {
    const { overall, participation, counts } = model;
    const rows: CellValue[][] = [
        ['Survei', text(model.title)], ['Lingkup', model.scopeLabel], ['Periode', `${model.startDate} s/d ${model.endDate}`],
        ['Site', text(model.siteLabel)], ['Mode responden', model.modeLabel], ['No. dokumen', model.docNo],
        ['Nilai keseluruhan (1-5)', overall.average], ['Predikat', overall.word ?? '-'], ['Indeks (%)', overall.indexPct],
        ['Nilai periode lalu', overall.previous], ['Δ vs periode lalu', overall.delta],
        ['Basis partisipasi', `${participation.basis} (${participation.basisLabel})`], ['Target partisipasi', `${participation.target} (${model.targetPct}%)`],
        ['Responden', participation.responses],
        ...slaRows(model),
        ['Jumlah dinilai', `${counts.teams} tim · ${counts.people} orang · ${counts.sites} site`], ['Jumlah komentar', counts.comments],
        ...model.highlights.map((line, index): CellValue[] => [index ? '' : 'Poin utama', text(line)]),
        ...(model.notes ? model.notes.split(/\r?\n/).filter((line) => line.trim()) : ['-']).map((line, index): CellValue[] => [index ? '' : 'Catatan & tindak lanjut', text(line)]),
        ...model.aspects.map((aspect, index): CellValue[] => [index ? '' : 'Aspek layanan (terlemah dulu)', `${text(aspect.label)}: ${aspect.average?.toFixed(2) ?? '-'}`]),
    ];
    const sheet = addStyledSheet(workbook, EXECUTIVE_SHEETS.summary, [{ header: 'Parameter', width: LABEL }, { header: 'Nilai', width: WIDE + 30 }], rows);
    sheet.autoFilter = undefined as unknown as ExcelJS.AutoFilter;
    sheet.getColumn(1).font = { bold: true };
}

/** Keterangan of an unranked row: no score yet, or a score from fewer than CSI_RANK_MIN_RATERS raters. */
const rankNote = (group: CsiServiceRanking, row: CsiRankRow) =>
    (row.rank !== null ? null : group.noAnswers.includes(row) ? NO_ANSWERS_LABEL : INSUFFICIENT_LABEL);

function rankCells(group: CsiServiceRanking, row: CsiRankRow, withPrevious: boolean): CellValue[] {
    return [
        text(groupLabel(group.serviceCode, group.serviceName)), row.rank, text(row.name), text(row.detail),
        row.raters, row.average, row.word, ...(withPrevious ? [row.previous, row.delta] : []), rankNote(group, row),
    ];
}

/**
 * "Peringkat": the PDF ranking in one sheet, one block per layanan (HC) or Tim / Orang (ICT). Ties share a rank;
 * fewer than CSI_RANK_MIN_RATERS raters = no rank and a note. Lalu / Δ only when an earlier period exists.
 */
function rankingSheet(workbook: ExcelJS.Workbook, model: CsiReportModel) {
    const hc = isHc(model);
    addStyledSheet(workbook, EXECUTIVE_SHEETS.ranking, [
        { header: hc ? 'Layanan' : 'Kelompok', width: LABEL }, COUNT('#'), { header: 'Nama', width: WIDTH.name },
        hc ? { header: 'Bagian / fungsi', width: LABEL } : COUNT('Site'), COUNT('Penilai'), AVERAGE_COLUMN('Nilai'), { header: 'Predikat', width: 16 },
        ...(model.hasPrevious ? [AVERAGE_COLUMN('Lalu'), AVERAGE_COLUMN('Δ')] : []), { header: 'Keterangan', width: 24 },
    ], model.rankingByService.flatMap((group) => rankRowsOf(group).map((row) => rankCells(group, row, model.hasPrevious))));
}

function participationSheet(workbook: ExcelJS.Workbook, model: CsiReportModel) {
    const total = model.participation;
    addStyledSheet(workbook, EXECUTIVE_SHEETS.participation, [
        { header: 'Site', width: WIDTH.name }, COUNT('Basis'), COUNT('Target'), COUNT('Sudah mengisi'),
        PERCENT_COLUMN('% Sudah mengisi'), { header: 'Status', width: 14 }, AVERAGE_COLUMN('Nilai'),
    ], [
        ...model.sites.map((site): CellValue[] => [text(`${site.code ?? ''} ${site.name ?? ''}`.trim()), site.basis, site.target, site.responses, site.respondenPct, site.reached ? 'Tercapai' : 'Belum', site.average]),
        ['Total', total.basis, total.target, total.responses, total.respondenPct, total.reached ? 'Tercapai' : 'Belum', model.overall.average],
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

/**
 * Anonymous comments like the PDF: no date, department or rater. Ordered per layanan (HCD, HCC, HCS, ...) and, inside
 * a layanan, in the PDF's stable shuffled order; subjects without a layanan (ICT) keep their group order.
 */
function commentsSheet(workbook: ExcelJS.Workbook, model: CsiReportModel) {
    const rows = model.comments.flatMap((group, index) => group.comments.map((comment) => ({ group, index, text: comment.text })))
        .sort((a, b) => compareServiceCodes(a.group.serviceCode, b.group.serviceCode)
            || (a.group.serviceCode ? 0 : a.index - b.index) || commentOrder(a.text, b.text));
    addStyledSheet(workbook, EXECUTIVE_SHEETS.comments, [
        { header: 'Layanan', width: LABEL }, { header: 'Dinilai', width: WIDTH.name }, { header: 'Jenis', width: SHORT }, { header: 'Komentar', width: WIDE },
    ], rows.map(({ group, text: comment }): CellValue[] => [
        text(groupLabel(group.serviceCode, isHc(model) ? OTHER_SERVICE : '')), text(group.name),
        group.kind === CsiRateeKind.TEAM ? 'Tim' : 'Orang', text(comment),
    ]));
}

/** Every sheet of the executive report: the same parameters as the PDF, nothing capped. */
export function addExecutiveSheets(workbook: ExcelJS.Workbook, model: CsiReportModel) {
    summarySheet(workbook, model);
    rankingSheet(workbook, model);
    participationSheet(workbook, model);
    gridSheet(workbook, EXECUTIVE_SHEETS.teamGrid, model.teamGrid);
    gridSheet(workbook, EXECUTIVE_SHEETS.peopleGrid, model.peopleGrid);
    // Basis raters per department, numbers only (small departments merged); names stay on the admin screen.
    addStyledSheet(workbook, EXECUTIVE_SHEETS.departments, [{ header: 'Departemen', width: LABEL }, COUNT('Sudah'), COUNT('Total'), PERCENT_COLUMN('%'), { header: 'Target', width: 14 }],
        model.departments.map((row) => [text(row.name), row.submitted, row.total, row.pct, row.met ? 'Tercapai' : 'Belum']));
    commentsSheet(workbook, model);
}
