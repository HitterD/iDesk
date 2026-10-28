import { resolveSantosLogoPath } from '../../../shared/core/utils/brand-logo.util';
import { DEFAULT_TIMEZONE } from '../../sla-config/business-hours.calc';
import { CsiRateeKind } from '../csi.constants';
import { MemoHeaderDto } from '../dto/memo.dto';
import {
    bottomOf, boxedText, cell, contentWidth, Doc, drawRow, fitText, LINE, MARGIN, maxRowHeight, MemoSurvey, PORTRAIT, scaleWidths, TableColumn,
} from './csi-memo-draw';
import { formatLocation } from './csi-format.util';

const DASH = '—';
const TITLE_SIZE = 24;
const BODY_SIZE = 10;
const LABEL_WIDTH = 70;
const CELL_PAD = 4;
const SIGNATURE_GAP = 60;
const SIGNATURE_LABEL_HEIGHT = 14;
const SIGNATURE_NAME_HEIGHT = 14;
const SIGNATURE_TITLE_HEIGHT = 26; // two lines, then an ellipsis
const SIGNATURE_COLUMN_GAP = 20;
const SIGNATURE_HEIGHT = SIGNATURE_LABEL_HEIGHT + SIGNATURE_GAP + SIGNATURE_NAME_HEIGHT + SIGNATURE_TITLE_HEIGHT + 6;
const NAME_ROW_HEIGHT = 18;
const PARAGRAPH_GAP = 10;
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
        doc.font('Helvetica-Bold').fontSize(BODY_SIZE).text(label, MARGIN, y, { width: LABEL_WIDTH, lineBreak: false });
        doc.font('Helvetica').text(`: ${value}`, MARGIN + LABEL_WIDTH, y, { width: contentWidth(doc) - LABEL_WIDTH });
        y = Math.max(y + 15, doc.y + 3);
    }
    doc.lineWidth(0.5).strokeColor(LINE).moveTo(MARGIN, y).lineTo(doc.page.width - MARGIN, y).stroke();
    return y + 12;
}

function measureParagraph(doc: Doc, text: string): number {
    doc.font('Helvetica').fontSize(BODY_SIZE);
    return text ? doc.heightOfString(cell(text), { width: contentWidth(doc) }) + PARAGRAPH_GAP : 0;
}

function paragraph(doc: Doc, text: string, y: number): number {
    if (!text) return y;
    doc.font('Helvetica').fontSize(BODY_SIZE).fillColor('#000000').text(cell(text), MARGIN, y, { width: contentWidth(doc), align: 'justify' });
    return doc.y + PARAGRAPH_GAP;
}

/** Names shown in the Nama column: PERSON ratees, or the team label when the survey has none. */
function namesOf(survey: MemoSurvey): string[] {
    const people = survey.report.ratees.filter((ratee) => ratee.kind === CsiRateeKind.PERSON).map((ratee) => cell(ratee.displayName));
    return people.length ? people : [cell(survey.report.period.teamLabel)];
}

type BlockLayout = { names: string[]; rowHeights: number[]; location: string; height: number };

/** Measures one merged block once; the same numbers drive the page-fit check and the drawing. */
function layoutBlock(doc: Doc, columns: TableColumn[], survey: MemoSurvey): BlockLayout {
    doc.font('Helvetica').fontSize(BODY_SIZE);
    const nameWidth = columns[1].width - CELL_PAD * 2;
    const names = namesOf(survey).map((name) => fitText(doc, name, nameWidth, maxRowHeight(doc)));
    const location = fitText(doc, cell(formatLocation(survey.report.period.sites)), columns[0].width - CELL_PAD * 2, maxRowHeight(doc));
    const base = names.map((name) => Math.max(NAME_ROW_HEIGHT, doc.heightOfString(name, { width: nameWidth }) + CELL_PAD * 2));
    const locationHeight = doc.heightOfString(location, { width: columns[0].width - CELL_PAD * 2 }) + CELL_PAD * 2;
    const extra = Math.max(0, locationHeight - base.reduce((sum, h) => sum + h, 0)) / names.length;
    const rowHeights = base.map((h) => h + extra);
    return { names, rowHeights, location, height: rowHeights.reduce((sum, h) => sum + h, 0) };
}

/** One merged block: Lokasi, Average and % Pengisi span all name rows of the survey. */
function drawBlock(doc: Doc, columns: TableColumn[], survey: MemoSurvey, layout: BlockLayout, y: number): number {
    const merged = [layout.location, '', formatAverage(survey.report.overall.average), formatPercent(survey.report.sla.pengisiPct)];
    doc.font('Helvetica').fontSize(BODY_SIZE).lineWidth(0.5).strokeColor(LINE);
    let x = MARGIN;
    columns.forEach((column, index) => {
        const inner = column.width - CELL_PAD * 2;
        if (index === 1) {
            let rowY = y;
            layout.names.forEach((name, row) => {
                const h = layout.rowHeights[row];
                doc.rect(x, rowY, column.width, h).stroke();
                doc.fillColor('#000000');
                boxedText(doc, name, x + CELL_PAD, rowY + CELL_PAD, inner, h - CELL_PAD);
                rowY += h;
            });
        } else {
            doc.rect(x, y, column.width, layout.height).stroke();
            const textHeight = doc.heightOfString(merged[index], { width: inner });
            doc.fillColor('#000000');
            boxedText(doc, merged[index], x + CELL_PAD, y + (layout.height - textHeight) / 2, inner, layout.height, column.align);
        }
        x += column.width;
    });
    return y + layout.height;
}

function drawSummaryTable(doc: Doc, surveys: MemoSurvey[], startY: number): number {
    const widths = scaleWidths(TABLE_WEIGHTS, contentWidth(doc));
    const columns: TableColumn[] = TABLE_HEADERS.map((header, i) => ({ header, width: widths[i], align: i >= 2 ? 'center' : 'left' }));
    const headerRow = (top: number) => drawRow(doc, columns, TABLE_HEADERS, top, { size: BODY_SIZE, bold: true, fill: '#E6E6E6' });
    let y = headerRow(startY);
    let blocksOnPage = 0;
    for (const survey of surveys) {
        const layout = layoutBlock(doc, columns, survey);
        if (y + layout.height > bottomOf(doc) && blocksOnPage > 0) {
            doc.addPage(PORTRAIT);
            y = headerRow(MARGIN);
            blocksOnPage = 0;
        }
        y = drawBlock(doc, columns, survey, layout, y);
        blocksOnPage += 1;
    }
    return y + 14;
}

function drawSignature(doc: Doc, label: string, signer: { name: string; title: string }, x: number, y: number, width: number) {
    doc.font('Helvetica').fontSize(BODY_SIZE).fillColor('#000000');
    boxedText(doc, label, x, y, width, SIGNATURE_LABEL_HEIGHT);
    const nameY = y + SIGNATURE_LABEL_HEIGHT + SIGNATURE_GAP;
    doc.font('Helvetica-Bold');
    doc.text(fitText(doc, cell(signer.name), width, SIGNATURE_NAME_HEIGHT), x, nameY, { width, height: SIGNATURE_NAME_HEIGHT, underline: true });
    doc.font('Helvetica');
    boxedText(doc, fitText(doc, cell(signer.title), width, SIGNATURE_TITLE_HEIGHT), x, nameY + SIGNATURE_NAME_HEIGHT, width, SIGNATURE_TITLE_HEIGHT);
}

/** Page 1: title, label rows, opening, recap table, closing and signatures. */
export function drawMemoPage(doc: Doc, header: MemoHeaderDto, surveys: MemoSurvey[]): void {
    let y = drawHeader(doc, header);
    doc.font('Helvetica').fontSize(BODY_SIZE).text('Dengan hormat,', MARGIN, y);
    y = paragraph(doc, header.opening, doc.y + 6);
    y = drawSummaryTable(doc, surveys, y);
    if (y + measureParagraph(doc, header.closing) + SIGNATURE_HEIGHT > bottomOf(doc)) {
        // The signatures would not fit under the closing: move both so the closing never sits alone.
        doc.addPage(PORTRAIT);
        y = MARGIN;
    }
    y = paragraph(doc, header.closing, y);
    const half = contentWidth(doc) / 2 - SIGNATURE_COLUMN_GAP / 2;
    drawSignature(doc, 'Hormat kami,', header.signerLeft, MARGIN, y + 6, half);
    drawSignature(doc, 'Mengetahui,', header.signerRight, MARGIN + half + SIGNATURE_COLUMN_GAP, y + 6, half);
}
