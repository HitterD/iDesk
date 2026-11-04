import * as ExcelJS from 'exceljs';
import { CsiRateeKind } from '../csi.constants';
import { addStyledSheet, AVERAGE_COLUMN, CellValue, ColumnSpec, sanitizeCell, WIDTH } from './csi-export.sheet';
import { formatTimestampWib } from './csi-format.util';
import { CsiRaterMatrix } from './csi-rater-matrix.calc';

export const SHEET_MATRIX = 'Penilai x Subjek';
const SUBJECT_WIDTH = 14;
const GOOD_SCORE = 4.2;
const WARN_SCORE = 3.5;
const FILL = { good: 'FFD7F0DE', warn: 'FFFCEBC8', bad: 'FFF8D3CF', empty: 'FFF1F1F4' } as const;

const kindPrefix = (kind: CsiRateeKind) => (kind === CsiRateeKind.TEAM ? 'Tim · ' : '');
const toneOf = (value: number) => (value >= GOOD_SCORE ? FILL.good : value >= WARN_SCORE ? FILL.warn : FILL.bad);
const fill = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });

/**
 * "Penilai x Subjek": one row per respondent, one column per subject with the average they gave (empty = not rated),
 * a total row with rater counts and averages, and traffic-light cell fills. Admin-only (it carries respondent names).
 */
export function addMatrixSheet(workbook: ExcelJS.Workbook, matrix: CsiRaterMatrix) {
    if (!matrix.subjects.length) return;
    const fixed: ColumnSpec[] = [
        { header: 'Timestamp', width: WIDTH.timestamp }, { header: 'Nama penilai', width: WIDTH.name },
        { header: 'Area Kerja', width: WIDTH.area }, { header: 'Departemen', width: WIDTH.department },
    ];
    const subjectColumns = matrix.subjects.map((subject): ColumnSpec => ({
        ...AVERAGE_COLUMN(sanitizeCell(`${kindPrefix(subject.kind)}${subject.displayName}`)), width: SUBJECT_WIDTH,
    }));
    const columns = [...fixed, ...subjectColumns, AVERAGE_COLUMN('Rata-rata penilai')];
    const rows: CellValue[][] = matrix.rows.map((row) => [
        formatTimestampWib(row.submittedAt), sanitizeCell(row.respondentName), sanitizeCell((row.areaName ?? '').toUpperCase()),
        sanitizeCell(row.departmentName), ...row.scores, row.average,
    ]);
    const sheet = addStyledSheet(workbook, SHEET_MATRIX, columns, rows);
    const first = fixed.length + 1;
    rows.forEach((_, index) => matrix.subjects.forEach((__, offset) => {
        const cell = sheet.getRow(index + 2).getCell(first + offset);
        cell.fill = fill(typeof cell.value === 'number' ? toneOf(cell.value) : FILL.empty);
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
    }));
    const countRow = sheet.addRow(['', 'Jumlah penilai', '', '', ...matrix.totals.map((total) => total.raters), null]);
    const averageRow = sheet.addRow(['', 'Rata-rata subjek', '', '', ...matrix.totals.map((total) => total.average), null]);
    [countRow, averageRow].forEach((row) => row.eachCell({ includeEmpty: true }, (cell, column) => {
        cell.font = { bold: true };
        cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
        if (column >= first && row === averageRow) cell.numFmt = '0.00';
    }));
    sheet.views = [{ state: 'frozen', xSplit: fixed.length, ySplit: 1 }];
}
