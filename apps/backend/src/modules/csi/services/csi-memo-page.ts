import { resolveSantosLogoPath } from '../../../shared/core/utils/brand-logo.util';
import { DEFAULT_TIMEZONE } from '../../sla-config/business-hours.calc';
import { CsiRateeKind } from '../csi.constants';
import { MemoHeaderDto } from '../dto/memo.dto';
import { bottomOf, cell, contentWidth, Doc, drawRow, LINE, MARGIN, MemoSurvey, scaleWidths, TableColumn } from './csi-memo-draw';
import { formatLocation } from './csi-format.util';

const DASH = '—';
const TITLE_SIZE = 24;
const BODY_SIZE = 10;
const LABEL_WIDTH = 70;
const SIGNATURE_GAP = 60;
const NAME_ROW_HEIGHT = 18;
const LOGO_FIT: [number, number] = [70, 45];
const LABELS: Array<[string, keyof MemoHeaderDto]> = [
    ['Kepada', 'to'], ['CC', 'cc'], ['Nomor', 'number'], ['Dari', 'from'], ['Perihal', 'subject'],
];
const TABLE_WEIGHTS = [34, 34, 16, 16];
const TABLE_HEADERS = ['Lokasi', 'Nama', 'Average', '% Pengisi (SLA)'];

const averageFormat = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateFormat = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: DEFAULT_TIMEZONE });

export const formatAverage = (value: number | null | undefined): string =>
    typeof value === 'number' && Number.isFinite(value) ? averageFormat.format(value) : DASH;
export const formatPercent = (value: number | null | undefined): string =>
    typeof value === 'number' && Number.isFinite(value) ? `${value}%` : DASH;
/** `2025-11-28` -> `28 November 2025`. */
export const formatLongDate = (date: string): string => dateFormat.format(new Date(`${date}T12:00:00+07:00`));

function drawLogo(doc: Doc) {
    const logo = resolveSantosLogoPath();
    if (!logo) return;
    try {
        doc.image(logo, doc.page.width - MARGIN - LOGO_FIT[0], MARGIN - 20, { fit: LOGO_FIT, align: 'right' });
    } catch {
        // The memo is still valid without the logo.
    }
}

function drawHeader(doc: Doc, header: MemoHeaderDto): number {
    drawLogo(doc);
    doc.font('Helvetica-Bold').fontSize(TITLE_SIZE).fillColor('#000000').text('Interoffice Memo', MARGIN, MARGIN, { lineBreak: false });
    const ruleY = MARGIN + TITLE_SIZE + 8;
    doc.lineWidth(1.5).strokeColor('#000000').moveTo(MARGIN, ruleY).lineTo(doc.page.width - MARGIN, ruleY).stroke();
    let y = ruleY + 14;
    const rows: Array<[string, string]> = [
        ...LABELS.map(([label, key]): [string, string] => [label, cell(header[key] as string)]),
        ['Tanggal', formatLongDate(header.date)],
    ];
    for (const [label, value] of rows) {
        doc.font('Helvetica-Bold').fontSize(BODY_SIZE).text(`${label}`, MARGIN, y, { width: LABEL_WIDTH, lineBreak: false });
        doc.font('Helvetica').text(`: ${value}`, MARGIN + LABEL_WIDTH, y, { width: contentWidth(doc) - LABEL_WIDTH });
        y = Math.max(y + 15, doc.y + 3);
    }
    doc.lineWidth(0.5).strokeColor(LINE).moveTo(MARGIN, y).lineTo(doc.page.width - MARGIN, y).stroke();
    return y + 12;
}

function paragraph(doc: Doc, text: string, y: number): number {
    if (!text) return y;
    doc.font('Helvetica').fontSize(BODY_SIZE).fillColor('#000000').text(cell(text), MARGIN, y, { width: contentWidth(doc), align: 'justify' });
    return doc.y + 10;
}

/** Names shown in the Nama column: PERSON ratees, or the team label when the survey has none. */
function namesOf(survey: MemoSurvey): string[] {
    const people = survey.report.ratees.filter((ratee) => ratee.kind === CsiRateeKind.PERSON).map((ratee) => cell(ratee.displayName));
    return people.length ? people : [cell(survey.report.period.teamLabel)];
}

/** One merged block: Lokasi, Average and % Pengisi span all name rows of the survey. */
function drawBlock(doc: Doc, columns: TableColumn[], survey: MemoSurvey, y: number): number {
    const names = namesOf(survey);
    const merged = [
        cell(formatLocation(survey.report.period.sites)), '', formatAverage(survey.report.overall.average), formatPercent(survey.report.sla.pengisiPct),
    ];
    doc.font('Helvetica').fontSize(BODY_SIZE);
    const locationHeight = doc.heightOfString(merged[0], { width: columns[0].width - 8 }) + 8;
    const height = Math.max(names.length * NAME_ROW_HEIGHT, locationHeight);
    const rowHeight = height / names.length;
    columns.forEach((column, index) => {
        const x = MARGIN + columns.slice(0, index).reduce((sum, c) => sum + c.width, 0);
        doc.lineWidth(0.5).strokeColor(LINE);
        if (index === 1) {
            names.forEach((name, row) => {
                doc.rect(x, y + row * rowHeight, column.width, rowHeight).stroke();
                doc.fillColor('#000000').text(name, x + 4, y + row * rowHeight + (rowHeight - BODY_SIZE) / 2 - 1, { width: column.width - 8, lineBreak: false });
            });
            return;
        }
        doc.rect(x, y, column.width, height).stroke();
        const textHeight = doc.heightOfString(merged[index], { width: column.width - 8 });
        doc.fillColor('#000000').text(merged[index], x + 4, y + (height - textHeight) / 2, { width: column.width - 8, align: column.align ?? 'left' });
    });
    return y + height;
}

function drawSummaryTable(doc: Doc, surveys: MemoSurvey[], startY: number): number {
    const widths = scaleWidths(TABLE_WEIGHTS, contentWidth(doc));
    const columns: TableColumn[] = TABLE_HEADERS.map((header, i) => ({ header, width: widths[i], align: i >= 2 ? 'center' : 'left' }));
    const headerRow = () => drawRow(doc, columns, TABLE_HEADERS, startY, { size: BODY_SIZE, bold: true, fill: '#E6E6E6' });
    let y = headerRow();
    for (const survey of surveys) {
        const needed = Math.max(namesOf(survey).length * NAME_ROW_HEIGHT, 30);
        if (y + needed > bottomOf(doc)) {
            doc.addPage();
            startY = MARGIN;
            y = headerRow();
        }
        y = drawBlock(doc, columns, survey, y);
    }
    return y + 14;
}

function drawSignature(doc: Doc, label: string, signer: { name: string; title: string }, x: number, y: number, width: number) {
    doc.font('Helvetica').fontSize(BODY_SIZE).fillColor('#000000').text(label, x, y, { width });
    const nameY = y + 14 + SIGNATURE_GAP;
    doc.font('Helvetica-Bold').text(cell(signer.name), x, nameY, { width, underline: true });
    doc.font('Helvetica').text(cell(signer.title), x, doc.y, { width, underline: false });
}

/** Page 1: title, label rows, opening, recap table, closing and signatures. */
export function drawMemoPage(doc: Doc, header: MemoHeaderDto, surveys: MemoSurvey[]): void {
    let y = drawHeader(doc, header);
    doc.font('Helvetica').fontSize(BODY_SIZE).text('Dengan hormat,', MARGIN, y);
    y = paragraph(doc, header.opening, doc.y + 6);
    y = drawSummaryTable(doc, surveys, y);
    y = paragraph(doc, header.closing, y);
    const SIGNATURE_HEIGHT = 14 + SIGNATURE_GAP + 40;
    if (y + SIGNATURE_HEIGHT > bottomOf(doc)) {
        doc.addPage();
        y = MARGIN;
    }
    const half = contentWidth(doc) / 2 - 10;
    drawSignature(doc, 'Hormat kami,', header.signerLeft, MARGIN, y + 6, half);
    drawSignature(doc, 'Mengetahui,', header.signerRight, MARGIN + half + 20, y + 6, half);
}
