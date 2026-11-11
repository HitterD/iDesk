import * as ExcelJS from 'exceljs';
import { addStyledSheet, AVERAGE_COLUMN, CellValue, ColumnSpec, sanitizeCell } from '../services/csi-export.sheet';
import { CsiHcRecap, CsiLocationCells } from './csi-hc-report.calc';
import { CSI_LOCATION_ALL_LABEL } from './csi-org.constants';

/** Excel sheets of the HC per-PIC recap (the PDF pages live in csi-hc-report.pdf.ts). */
export const HC_SHEETS = { recap: 'HC Layanan-Bagian-PIC', respondents: 'HC Per Divisi Responden', detail: 'HC Jawaban Responden' } as const;

const LOCATION_COLUMNS = (recap: CsiHcRecap): ColumnSpec[] =>
    [...recap.locations.map((location) => AVERAGE_COLUMN(location.label)), AVERAGE_COLUMN(CSI_LOCATION_ALL_LABEL), { header: 'Jumlah penilaian', width: 12 }];
const locationValues = (recap: CsiHcRecap, row: CsiLocationCells): CellValue[] =>
    [...recap.locations.map((location) => row.byLocation[location.code].average), row.all.average, row.all.ratings];
const ALL_LOCATIONS = 'Semua lokasi';
const LEVEL_LABEL: Record<string, string> = { service: 'Layanan', bagian: 'Bagian', pic: 'PIC', division: 'Divisi', department: 'Departemen' };
const TEAM_LEVEL_LABEL = 'Tim';

/** Three sheets: layanan/bagian/PIC (+ dimensions), respondent unit groups, and every respondent's stars per PIC. */
export function addHcRecapSheets(workbook: ExcelJS.Workbook, recap: CsiHcRecap, withNames: boolean) {
    addStyledSheet(workbook, HC_SHEETS.recap, [
        { header: 'Tingkat', width: 10 }, { header: 'Layanan', width: 10 }, { header: 'Bagian', width: 30 }, { header: 'Nama', width: 32 },
        { header: 'Jabatan', width: 28 }, { header: 'Fungsi Pelayanan', width: 32 }, ...LOCATION_COLUMNS(recap), ...recap.dimensions.map((label) => AVERAGE_COLUMN(label)),
    ], recap.services.map((row) => [
        row.team ? TEAM_LEVEL_LABEL : LEVEL_LABEL[row.level], row.serviceCode ?? '', sanitizeCell(row.bagian), sanitizeCell(row.level === 'pic' ? row.label : ''), sanitizeCell(row.jobTitle),
        sanitizeCell(row.serviceFunction ?? ''),
        ...locationValues(recap, row), ...recap.dimensions.map((label) => row.dimensions[label]),
    ]));
    // No location columns: a hidden location would be derivable from the unit total (same as the PDF).
    addStyledSheet(workbook, HC_SHEETS.respondents, [
        { header: 'Tingkat', width: 12 }, { header: 'Divisi', width: 30 }, { header: 'Departemen', width: 30 }, { header: 'Bagian', width: 30 },
        AVERAGE_COLUMN(ALL_LOCATIONS), { header: 'Responden', width: 12 },
    ], recap.respondentGroups.map((row) => [
        LEVEL_LABEL[row.level], sanitizeCell(row.division), sanitizeCell(row.department ?? ''), sanitizeCell(row.level === 'bagian' ? row.label : ''),
        row.all.average, row.respondents,
    ]));
    if (!withNames) return;
    const rows: CellValue[][] = recap.respondents.flatMap((respondent) => respondent.pics.map((pic) => [
        sanitizeCell(respondent.name), sanitizeCell(respondent.division), sanitizeCell(respondent.department), sanitizeCell(respondent.bagian),
        recap.locations.find((location) => location.code === respondent.location)?.label ?? '',
        pic.serviceCode ?? '', sanitizeCell(pic.bagian), sanitizeCell(pic.name),
        ...recap.dimensions.map((label) => pic.scores[label] ?? null), pic.average, respondent.average,
    ]));
    addStyledSheet(workbook, HC_SHEETS.detail, [
        { header: 'Responden', width: 28 }, { header: 'Divisi', width: 24 }, { header: 'Departemen', width: 24 }, { header: 'Bagian', width: 24 },
        { header: 'Lokasi', width: 14 }, { header: 'Layanan', width: 10 }, { header: 'Bagian PIC', width: 26 }, { header: 'PIC', width: 28 },
        ...recap.dimensions.map((label) => ({ header: `${label} (bintang)`, width: 12 })),
        AVERAGE_COLUMN('Rata-rata PIC'), AVERAGE_COLUMN('Rata-rata responden'),
    ], rows);
}
