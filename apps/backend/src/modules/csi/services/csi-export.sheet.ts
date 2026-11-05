import * as ExcelJS from 'exceljs';

const FORMULA_PREFIX = /^[=+\-@\t\r]/;
const HEADER_FILL = 'FF4BC0C8';
const ROW_FILL = 'FFDDF2F4';
/** Tall enough for a 4-line wrapped question at the column widths below (was 120: mostly empty space). */
const HEADER_HEIGHT = 60;
const AVERAGE_FORMAT = '0.00';
const PERCENT_FORMAT = '0"%"';
const THIN = { style: 'thin' as const };
const BORDER: Partial<ExcelJS.Borders> = { top: THIN, left: THIN, bottom: THIN, right: THIN };

export const WIDTH = { timestamp: 26, name: 26, area: 16, department: 22, question: 22, point: 8, average: 11 } as const;

export type CellValue = string | number | null;
export type ColumnSpec = { header: string; width: number; format?: string };

/** Neutralises spreadsheet formula injection: text starting with = + - @ tab or CR is prefixed with a single quote. */
export function sanitizeCell(value: string | null | undefined): string {
    const text = value ?? '';
    return FORMULA_PREFIX.test(text) ? `'${text}` : text;
}

const fill = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });

function styleHeader(sheet: ExcelJS.Worksheet) {
    const header = sheet.getRow(1);
    header.height = HEADER_HEIGHT;
    header.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = fill(HEADER_FILL);
        cell.border = BORDER;
        cell.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
    });
}

function styleRow(row: ExcelJS.Row, index: number, columns: ColumnSpec[]) {
    columns.forEach((column, position) => {
        const cell = row.getCell(position + 1);
        cell.border = BORDER;
        cell.alignment = { wrapText: true, vertical: 'middle' };
        if (column.format) cell.numFmt = column.format;
        if (index % 2 === 0) cell.fill = fill(ROW_FILL);
    });
}

/** Adds a 2025-style sheet: teal wrapped header (frozen), bordered cells and alternating row fills. */
export function addStyledSheet(workbook: ExcelJS.Workbook, name: string, columns: ColumnSpec[], rows: CellValue[][]) {
    const sheet = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.addRow(columns.map((column) => column.header));
    sheet.columns.forEach((column, position) => { column.width = columns[position].width; });
    styleHeader(sheet);
    rows.forEach((values, index) => styleRow(sheet.addRow(values), index, columns));
    // Filter buttons on the header: admins sort and filter per site / department / ratee directly in Excel.
    if (rows.length) sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
    sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
    return sheet;
}

export const AVERAGE_COLUMN = (header: string): ColumnSpec => ({ header, width: WIDTH.average, format: AVERAGE_FORMAT });
export const PERCENT_COLUMN = (header: string): ColumnSpec => ({ header, width: WIDTH.average, format: PERCENT_FORMAT });
