import { CsiRespondentMode } from '../csi.constants';
import { formatLocation } from './csi-format.util';
import { cell, contentWidth, Doc, drawRow, drawTable, MARGIN, MemoSurvey, PORTRAIT, scaleWidths, TableColumn, TEAL_SOFT, LINE } from './csi-memo-draw';
import { formatPercent, MEMO_SLA_LABEL, memoSlaPct } from './csi-memo-page';

const HEADING_SIZE = 12;
const BODY_SIZE = 9;
const REPORTER_HEADERS = ['Email', 'Departemen', 'Nama'];
const REPORTER_WEIGHTS = [40, 30, 30];

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

/** "Lampiran SLA" page(s): summary box and the reporter table (Email | Departemen | Nama). */
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

    const widths = scaleWidths(REPORTER_WEIGHTS, contentWidth(doc));
    const columns: TableColumn[] = REPORTER_HEADERS.map((header, i) => ({ header, width: widths[i] }));
    const rows = report.sla.reporters.map((reporter) => [cell(reporter.email), cell(reporter.department), cell(reporter.fullName)]);
    drawTable(doc, columns, rows, y + 14, BODY_SIZE, () => {
        doc.addPage(PORTRAIT);
        return MARGIN;
    });
}
