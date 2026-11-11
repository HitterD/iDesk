import { cleanText } from './csi-format.util';
import { CsiAnswer, CsiReportService } from './csi-report.service';
import { CsiDepartmentParticipation } from './csi-report-participation';

export type MemoReport = Awaited<ReturnType<CsiReportService['getReport']>>;
/** `departments`: HC only, the anonymous participation per rater department (replaces the reporter list). */
export type MemoSurvey = { report: MemoReport; answers: CsiAnswer[]; departments?: CsiDepartmentParticipation[] };

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
const ELLIPSIS = '…';
const BOX_SLACK = 2;
/** A row (and any single cell) may use at most this share of the page content height. */
const MAX_ROW_SHARE = 0.6;

export const PORTRAIT = { size: 'A4', layout: 'portrait', margin: MARGIN } as const;

export const cell = (value: string | number | null | undefined): string =>
    value === null || value === undefined ? '' : cleanText(String(value));
/** Reverts the Excel formula-injection apostrophe, which has no purpose in a PDF. */
export const unquote = (value: string): string => value.replace(/^'([=+\-@\t\r])/, '$1');
export const bottomOf = (doc: Doc): number => doc.page.height - MARGIN - BOTTOM_SLACK;
export const contentWidth = (doc: Doc): number => doc.page.width - MARGIN * 2;
export const maxRowHeight = (doc: Doc): number => (doc.page.height - MARGIN * 2) * MAX_ROW_SHARE;

/** Scales column weights so they exactly fill `total` points. */
export function scaleWidths(weights: number[], total: number): number[] {
    const sum = weights.reduce((a, b) => a + b, 0);
    return weights.map((weight) => (weight / sum) * total);
}

/** Cuts `text` (appending an ellipsis) so it wraps to at most `maxHeight` at the doc's current font and `width`. */
export function fitText(doc: Doc, text: string, width: number, maxHeight: number): string {
    if (doc.heightOfString(text, { width }) <= maxHeight) return text;
    let low = 0;
    let high = text.length;
    while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        if (doc.heightOfString(text.slice(0, mid).trimEnd() + ELLIPSIS, { width }) <= maxHeight) low = mid; else high = mid - 1;
    }
    return text.slice(0, low).trimEnd() + ELLIPSIS;
}

/**
 * Draws text inside a fixed box: lines beyond `height` are dropped instead of flowing to a new page.
 * Callers pass text already cut by `fitText`, so nothing visible is lost.
 */
export function boxedText(doc: Doc, text: string, x: number, y: number, width: number, height: number, align: Align = 'left'): void {
    doc.text(text, x, y, { width, height: height + BOX_SLACK, align });
}

function fitCells(doc: Doc, columns: TableColumn[], values: string[], size: number, bold: boolean): string[] {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size);
    return values.map((value, i) => fitText(doc, value, columns[i].width - CELL_PAD * 2, maxRowHeight(doc) - CELL_PAD * 2));
}

function heightOfCells(doc: Doc, columns: TableColumn[], cells: string[]): number {
    const tallest = Math.max(...cells.map((value, i) => doc.heightOfString(value, { width: columns[i].width - CELL_PAD * 2 })));
    return Math.max(MIN_ROW, tallest + CELL_PAD * 2);
}

export function rowHeight(doc: Doc, columns: TableColumn[], values: string[], size: number, bold: boolean): number {
    return heightOfCells(doc, columns, fitCells(doc, columns, values, size, bold));
}

type RowStyle = { size: number; bold: boolean; fill?: string };

export function drawRow(doc: Doc, columns: TableColumn[], values: string[], y: number, style: RowStyle): number {
    const cells = fitCells(doc, columns, values, style.size, style.bold);
    const height = heightOfCells(doc, columns, cells);
    let x = MARGIN;
    columns.forEach((column, i) => {
        if (style.fill) doc.rect(x, y, column.width, height).fill(style.fill);
        doc.lineWidth(0.5).strokeColor(LINE).rect(x, y, column.width, height).stroke();
        doc.fillColor('#000000').font(style.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(style.size);
        boxedText(doc, cells[i], x + CELL_PAD, y + CELL_PAD, column.width - CELL_PAD * 2, height - CELL_PAD, column.align);
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
