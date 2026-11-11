import * as ExcelJS from 'exceljs';
import { addReportSheet, addTable, XlKind, XlTab } from './csi-excel-style';

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export const WIDTH = { timestamp: 26, name: 26, area: 16, department: 22, question: 22, point: 8, average: 11 } as const;

export type CellValue = string | number | null;
/** `width` is the column width in the sheet (and the relative width in the memo PDF tables). */
export type ColumnSpec = { header: string; width: number; kind?: XlKind };

/** Neutralises spreadsheet formula injection: text starting with = + - @ tab or CR is prefixed with a single quote. */
export function sanitizeCell(value: string | null | undefined): string {
    const text = value ?? '';
    return FORMULA_PREFIX.test(text) ? `'${text}` : text;
}

/**
 * A one-table sheet in the CSI style with the header in row 1 (import templates and the pairs file are read back by
 * header row 1): navy header, zebra rows, frozen header, filter, fixed widths, gridlines kept for data entry.
 */
export function addStyledSheet(workbook: ExcelJS.Workbook, name: string, columns: ColumnSpec[], rows: CellValue[][], tab: XlTab = 'analysis') {
    const sheet = addReportSheet(workbook, name, tab, true);
    addTable(sheet, columns, rows, { headerRow: 1, freeze: true });
    return sheet;
}

export const AVERAGE_COLUMN = (header: string): ColumnSpec => ({ header, width: WIDTH.average, kind: 'score' });
