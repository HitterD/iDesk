import { cleanText } from './csi-format.util';
import { CsiAnswer, CsiReportService } from './csi-report.service';

export type MemoReport = Awaited<ReturnType<CsiReportService['getReport']>>;
export type MemoSurvey = { report: MemoReport; answers: CsiAnswer[] };

export type Doc = PDFKit.PDFDocument;
export type Align = 'left' | 'right' | 'center';
export type TableColumn = { header: string; width: number; align?: Align };

export const MARGIN = 56;
export const TEAL = '#4BC0C8';
export const TEAL_SOFT = '#DDF2F4';
export const LINE = '#888888';
const BOTTOM_SLACK = 4;
const CELL_PAD = 3;
const MIN_ROW = 14;

export const cell = (value: string | number | null | undefined): string =>
    value === null || value === undefined ? '' : cleanText(String(value));
/** Reverts the Excel formula-injection apostrophe, which has no purpose in a PDF. */
export const unquote = (value: string): string => value.replace(/^'([=+\-@\t\r])/, '$1');
export const bottomOf = (doc: Doc): number => doc.page.height - MARGIN - BOTTOM_SLACK;
export const contentWidth = (doc: Doc): number => doc.page.width - MARGIN * 2;

/** Scales column weights so they exactly fill `total` points. */
export function scaleWidths(weights: number[], total: number): number[] {
    const sum = weights.reduce((a, b) => a + b, 0);
    return weights.map((weight) => (weight / sum) * total);
}

export function rowHeight(doc: Doc, columns: TableColumn[], values: string[], size: number, bold: boolean): number {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size);
    const tallest = Math.max(...values.map((value, i) => doc.heightOfString(value, { width: columns[i].width - CELL_PAD * 2 })));
    return Math.max(MIN_ROW, tallest + CELL_PAD * 2);
}

type RowStyle = { size: number; bold: boolean; fill?: string };

export function drawRow(doc: Doc, columns: TableColumn[], values: string[], y: number, style: RowStyle): number {
    const height = rowHeight(doc, columns, values, style.size, style.bold);
    let x = MARGIN;
    columns.forEach((column, i) => {
        if (style.fill) doc.rect(x, y, column.width, height).fill(style.fill);
        doc.lineWidth(0.5).strokeColor(LINE).rect(x, y, column.width, height).stroke();
        doc.fillColor('#000000').font(style.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(style.size)
            .text(values[i], x + CELL_PAD, y + CELL_PAD, { width: column.width - CELL_PAD * 2, align: column.align ?? 'left' });
        x += column.width;
    });
    return y + height;
}

/** Table with a teal header repeated on every page; alternating soft rows. `newPage` must add a page and return its top y. */
export function drawTable(doc: Doc, columns: TableColumn[], rows: string[][], startY: number, size: number, newPage: () => number): number {
    const header = columns.map((column) => column.header);
    const headerStyle = { size, bold: true, fill: TEAL };
    let y = drawRow(doc, columns, header, startY, headerStyle);
    rows.forEach((values, index) => {
        if (y + rowHeight(doc, columns, values, size, false) > bottomOf(doc)) y = drawRow(doc, columns, header, newPage(), headerStyle);
        y = drawRow(doc, columns, values, y, { size, bold: false, fill: index % 2 === 0 ? TEAL_SOFT : undefined });
    });
    return y;
}
