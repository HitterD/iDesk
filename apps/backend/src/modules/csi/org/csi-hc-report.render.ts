import * as ExcelJS from 'exceljs';
import { Cell, Column, INK, ReportCanvas } from '../../reports/generators/report-pdf-canvas';
import { addStyledSheet, AVERAGE_COLUMN, CellValue, ColumnSpec, sanitizeCell } from '../services/csi-export.sheet';
import { CSI_SCORE_FAIR, CSI_SCORE_GOOD } from '../services/csi-report-model';
import { cleanText } from '../services/csi-format.util';
import { CsiCell, CsiHcRecap, CsiLocationCells } from './csi-hc-report.calc';
import { CSI_LOCATION_ALL_LABEL } from './csi-org.constants';

/** PDF sections and Excel sheets of the HC per-PIC recap (only rendered when the period has HC PICs). */
const DASH = '–';
const dec = (value: number | null) => (value === null ? DASH : value.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const color = (value: number | null) => (value === null ? INK.tertiary : value >= CSI_SCORE_GOOD ? INK.green : value >= CSI_SCORE_FAIR ? INK.amber : INK.red);
const text = (value: string | null | undefined) => cleanText(value ?? '');
/** PDF tables trim leading spaces, so PIC rows get a bullet instead of an indent. */
const LEVEL_INDENT: Record<string, string> = { service: '', bagian: '', pic: '•  ', division: '', department: '', };

export const HC_SHEETS = { recap: 'HC Layanan-Bagian-PIC', respondents: 'HC Per Divisi Responden', detail: 'HC Jawaban Responden' } as const;

function cell(value: CsiCell, bold = false): Cell {
    return { text: value.ratings ? dec(value.average) : DASH, color: color(value.average), bold };
}
const locationCells = (recap: CsiHcRecap, row: CsiLocationCells, bold: boolean): Cell[] =>
    [...recap.locations.map((location) => cell(row.byLocation[location.code], bold)), cell(row.all, true), { text: String(row.all.ratings) }];

/** Label column, one column per location + ALL SJA, and a wider count column (its header never gets cut). */
function locationColumns(recap: CsiHcRecap, labelHeader: string, labelWidth: number): Column[] {
    const countWidth = 10;
    const width = (100 - labelWidth - countWidth) / (recap.locations.length + 1);
    return [
        { header: labelHeader, width: labelWidth },
        ...recap.locations.map((location) => ({ header: location.code === 'JKT' ? 'JKT' : location.label.replace(' (Semarang)', ''), width, align: 'right' as const })),
        { header: 'ALL', width, align: 'right' }, { header: 'Jml', width: countWidth, align: 'right' },
    ];
}
const READING_NOTES = [
    'Angka = RATA-RATA bintang (skala 1-5) dari semua penilaian, sehingga bisa desimal (mis. 4,35).',
    'Kolom SJA 1, SJA 2, SJA 3, SJA 4 (Semarang) dan JKT (Jakarta) = lokasi RESPONDEN yang menilai, bukan lokasi PIC. ALL = semua lokasi (ALL SJA).',
    'Jml = jumlah penilaian (1 responden menilai 1 PIC). Tanda – = belum ada penilaian dari lokasi itu.',
];

/** Executive pages: overall per location + dimension, then the layanan / bagian / PIC table and respondent groups. */
export function renderHcRecapPdf(canvas: ReportCanvas, recap: CsiHcRecap) {
    canvas.pageBreak();
    canvas.section('Rekap HC per layanan, bagian dan PIC',
        'Rata-rata bintang (skala 1-5) per layanan, bagian dan PIC, menurut lokasi responden.');
    canvas.highlights(READING_NOTES, 'CARA MEMBACA', 'amber');
    canvas.scoreBars([{
        title: 'Rata-rata per dimensi pelayanan (ALL SJA)', max: 5,
        rows: recap.dimensions.map((label) => ({ label: text(label), value: recap.overall.dimensions[label], color: color(recap.overall.dimensions[label]), text: dec(recap.overall.dimensions[label]) })),
    }]);
    canvas.table(locationColumns(recap, 'Keseluruhan', 28), [[{ text: 'Semua layanan HC', bold: true }, ...locationCells(recap, recap.overall, true)]]);
    canvas.subheading('Per layanan - bagian - PIC', 'Baris tebal = layanan dan bagian; baris bertanda titik = PIC. "–" = belum ada penilaian dari lokasi itu.');
    canvas.table(locationColumns(recap, 'Layanan / Bagian / PIC', 34), recap.services.map((row) => [
        { text: `${LEVEL_INDENT[row.level]}${text(row.label)}`, bold: row.level !== 'pic', color: row.level === 'service' ? INK.text : undefined },
        ...locationCells(recap, row, row.level !== 'pic'),
    ]));
    canvas.subheading('Per dimensi untuk setiap layanan, bagian dan PIC', 'Rata-rata ALL SJA per dimensi.');
    const width = 66 / Math.max(1, recap.dimensions.length + 1);
    canvas.table([
        { header: 'Layanan / Bagian / PIC', width: 34 },
        ...recap.dimensions.map((label) => ({ header: text(label), width, align: 'right' as const })),
        { header: 'Rata-rata', width, align: 'right' },
    ], recap.services.map((row) => [
        { text: `${LEVEL_INDENT[row.level]}${text(row.label)}`, bold: row.level !== 'pic' },
        ...recap.dimensions.map((label) => ({ text: dec(row.dimensions[label]), color: color(row.dimensions[label]) })),
        { text: dec(row.all.average), bold: true, color: color(row.all.average) },
    ]));
    canvas.section('Rekap per divisi, departemen dan bagian responden', 'Rata-rata bintang yang diberikan responden dari setiap unit ke seluruh PIC HC.');
    canvas.table(locationColumns(recap, 'Divisi / Departemen / Bagian', 34), recap.respondentGroups.map((row) => [
        { text: `${row.level === 'bagian' ? '•  ' : ''}${text(row.label)}`, bold: row.level !== 'bagian' },
        ...locationCells(recap, row, row.level === 'division'),
    ]));
}

const LOCATION_COLUMNS = (recap: CsiHcRecap): ColumnSpec[] =>
    [...recap.locations.map((location) => AVERAGE_COLUMN(location.label)), AVERAGE_COLUMN(CSI_LOCATION_ALL_LABEL), { header: 'Jumlah penilaian', width: 12 }];
const locationValues = (recap: CsiHcRecap, row: CsiLocationCells): CellValue[] =>
    [...recap.locations.map((location) => row.byLocation[location.code].average), row.all.average, row.all.ratings];
const LEVEL_LABEL: Record<string, string> = { service: 'Layanan', bagian: 'Bagian', pic: 'PIC', division: 'Divisi', department: 'Departemen' };

/** Three sheets: layanan/bagian/PIC (+ dimensions), respondent unit groups, and every respondent's stars per PIC. */
export function addHcRecapSheets(workbook: ExcelJS.Workbook, recap: CsiHcRecap, withNames: boolean) {
    addStyledSheet(workbook, HC_SHEETS.recap, [
        { header: 'Tingkat', width: 10 }, { header: 'Layanan', width: 10 }, { header: 'Bagian', width: 30 }, { header: 'Nama', width: 32 },
        { header: 'Jabatan', width: 28 }, ...LOCATION_COLUMNS(recap), ...recap.dimensions.map((label) => AVERAGE_COLUMN(label)),
    ], recap.services.map((row) => [
        LEVEL_LABEL[row.level], row.serviceCode ?? '', sanitizeCell(row.bagian), sanitizeCell(row.level === 'pic' ? row.label : ''), sanitizeCell(row.jobTitle),
        ...locationValues(recap, row), ...recap.dimensions.map((label) => row.dimensions[label]),
    ]));
    addStyledSheet(workbook, HC_SHEETS.respondents, [
        { header: 'Tingkat', width: 12 }, { header: 'Divisi', width: 30 }, { header: 'Departemen', width: 30 }, { header: 'Bagian', width: 30 },
        ...LOCATION_COLUMNS(recap),
    ], recap.respondentGroups.map((row) => [
        LEVEL_LABEL[row.level], sanitizeCell(row.division), sanitizeCell(row.department ?? ''), sanitizeCell(row.level === 'bagian' ? row.label : ''),
        ...locationValues(recap, row),
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
