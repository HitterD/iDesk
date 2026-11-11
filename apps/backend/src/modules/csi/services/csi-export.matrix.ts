import * as ExcelJS from 'exceljs';
import { CsiRateeKind } from '../csi.constants';
import { addTable, RAW_HEADER_ROW, startRawSheet, wibDate, XlColumn, XlValue } from './csi-excel-style';
import { sanitizeCell } from './csi-export.sheet';
import { CsiRaterMatrix } from './csi-rater-matrix.calc';
import { CsiScoreBands } from './csi-score-bands';

export const SHEET_MATRIX = 'Penilai x Subjek';
const SUBJECT_WIDTH = 14;
const FIXED_COLUMNS = 4;

const kindPrefix = (kind: CsiRateeKind) => (kind === CsiRateeKind.TEAM ? 'Tim · ' : '');

/**
 * "Penilai x Subjek" (raw workbook only, it names the respondents): one row per respondent, one column per subject with
 * the average they gave (empty = not rated, fill by the survey bands), and below the filter range the rater count and
 * the average per subject.
 */
export function addMatrixSheet(workbook: ExcelJS.Workbook, matrix: CsiRaterMatrix, bands: CsiScoreBands, surveyLine: string) {
    if (!matrix.subjects.length) return;
    const columns: XlColumn[] = [
        { header: 'Timestamp', kind: 'date' }, { header: 'Nama penilai' }, { header: 'Area Kerja' }, { header: 'Departemen' },
        ...matrix.subjects.map((subject): XlColumn => ({
            header: sanitizeCell(`${kindPrefix(subject.kind)}${subject.displayName}`), kind: 'score', band: true, width: SUBJECT_WIDTH,
        })),
        { header: 'Rata-rata penilai', kind: 'score', band: true },
    ];
    const rows: XlValue[][] = matrix.rows.map((row) => [
        wibDate(row.submittedAt), sanitizeCell(row.respondentName), sanitizeCell((row.areaName ?? '').toUpperCase()),
        sanitizeCell(row.departmentName), ...row.scores, row.average,
    ]);
    const blank = Array<XlValue>(FIXED_COLUMNS - 2).fill(null);
    const sheet = startRawSheet(workbook, SHEET_MATRIX, surveyLine, Math.min(columns.length, 10));
    addTable(sheet, columns, rows, {
        bands, headerRow: RAW_HEADER_ROW, freeze: { columns: FIXED_COLUMNS },
        totals: [
            { values: [null, 'Jumlah penilai', ...blank, ...matrix.totals.map((total) => total.raters), null], numberKind: 'count' },
            [null, 'Rata-rata subjek', ...blank, ...matrix.totals.map((total) => total.average), null],
        ],
    });
}
