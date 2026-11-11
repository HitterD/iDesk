import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { CsiRespondentMode } from '../csi.constants';
import { formatLocation } from './csi-format.util';
import { cell, contentWidth, Doc, drawRow, drawTable, MARGIN, MemoSurvey, PORTRAIT, scaleWidths, TableColumn, TEAL_SOFT, LINE } from './csi-memo-draw';
import { formatPercent, MEMO_SLA_LABEL, memoSlaPct } from './csi-memo-page';

const HEADING_SIZE = 12;
const BODY_SIZE = 9;
const REPORTER_HEADERS = ['Email', 'Departemen', 'Nama'];
const REPORTER_WEIGHTS = [40, 30, 30];
/** HC: the same anonymous table as the report's participation per department (no names, small departments merged). */
const DEPARTMENT_HEADERS = ['Departemen', 'Sudah', 'Total', '%', 'Status'];
const DEPARTMENT_WEIGHTS = [46, 12, 12, 12, 18];
const DEPARTMENT_ALIGN: Array<'left' | 'right'> = ['left', 'right', 'right', 'right', 'left'];

/** Summary box rows: label | value. */
function summaryRows(survey: MemoSurvey): Array<[string, string]> {
    const { sla } = survey.report;
    return [
        [sla.mode === CsiRespondentMode.LISTED ? 'Total penilai terdaftar' : 'Total pelapor iDesk', String(sla.basis)],
        [`Target ${sla.targetPct}%`, String(sla.target)],
        ['Total responden CSI', String(sla.responses)],
        [MEMO_SLA_LABEL, formatPercent(memoSlaPct(sla))],
    ];
}

/** Reporter rows (ICT: Email | Departemen | Nama) or, for HC, participation per department without any name. */
function appendixTable(doc: Doc, survey: MemoSurvey): { columns: TableColumn[]; rows: string[][] } {
    const width = contentWidth(doc);
    if (survey.report.period.scope === ServiceScope.HC) {
        const widths = scaleWidths(DEPARTMENT_WEIGHTS, width);
        return {
            columns: DEPARTMENT_HEADERS.map((header, i) => ({ header, width: widths[i], align: DEPARTMENT_ALIGN[i] })),
            rows: (survey.departments ?? []).map((row) => [
                cell(row.name), String(row.submitted), String(row.total), formatPercent(row.pct), row.met ? 'Tercapai' : 'Belum',
            ]),
        };
    }
    const widths = scaleWidths(REPORTER_WEIGHTS, width);
    return {
        columns: REPORTER_HEADERS.map((header, i) => ({ header, width: widths[i] })),
        rows: survey.report.sla.reporters.map((reporter) => [cell(reporter.email), cell(reporter.department), cell(reporter.fullName)]),
    };
}

/** "Lampiran SLA" page(s): summary box and the appendix table (see appendixTable). */
export function drawSlaPages(doc: Doc, survey: MemoSurvey): void {
    const { report } = survey;
    doc.addPage(PORTRAIT);
    doc.font('Helvetica-Bold').fontSize(HEADING_SIZE).fillColor('#000000')
        .text(`Lampiran SLA — ${cell(formatLocation(report.period.sites))}`, MARGIN, MARGIN, { width: contentWidth(doc) });
    const half = scaleWidths([60, 40], contentWidth(doc) / 2);
    const boxColumns: TableColumn[] = [{ header: '', width: half[0] }, { header: '', width: half[1], align: 'right' }];
    let y = doc.y + 10;
    for (const row of summaryRows(survey)) y = drawRow(doc, boxColumns, row, y, { size: BODY_SIZE, bold: false, fill: TEAL_SOFT });
    doc.lineWidth(0.5).strokeColor(LINE);

    const { columns, rows } = appendixTable(doc, survey);
    drawTable(doc, columns, rows, y + 14, BODY_SIZE, () => {
        doc.addPage(PORTRAIT);
        return MARGIN;
    });
}
