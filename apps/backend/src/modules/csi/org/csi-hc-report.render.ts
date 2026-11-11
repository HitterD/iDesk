import * as ExcelJS from 'exceljs';
import {
    addTable, RAW_HEADER_ROW, RawIntro, sectionRow, startRawSheet, startReportSheet, XlColumn, XlRowStyle, XlTab, XlValue,
} from '../services/csi-excel-style';
import { sanitizeCell } from '../services/csi-export.sheet';
import { CsiScoreBands } from '../services/csi-score-bands';
import { collapseRespondentRows, CsiCell, CsiHcRecap, CsiRecapRow, CsiRespondentRow, recapDelta } from './csi-hc-report.calc';
import { CSI_LOCATION_ALL_LABEL } from './csi-org.constants';

/** Excel sheets of the HC per-PIC recap (the PDF pages live in csi-hc-report.pdf.ts). */
export const HC_SHEETS = {
    services: 'Per layanan', recap: 'Layanan-bagian-PIC', respondents: 'Rekap responden', questions: 'Per pertanyaan',
    detail: 'HC Jawaban Responden',
} as const;

/** What every HC sheet needs: the recap, the survey bands, the title-block line and banner. */
export type HcSheetContext = {
    recap: CsiHcRecap; bands: CsiScoreBands; hasPrevious: boolean; surveyLine: string; simulation: string | null;
};

const LEVEL_LABEL: Record<CsiRecapRow['level'], string> = { service: 'Layanan', bagian: 'Bagian', pic: 'PIC' };
const TEAM_LEVEL_LABEL = 'Tim';
const LEVEL_STYLE: Record<CsiRecapRow['level'], XlRowStyle['level']> = { service: 'group', bagian: 'subgroup', pic: 'item' };
const UNIT_STYLE: Record<CsiRespondentRow['level'], XlRowStyle['level']> = { division: 'group', department: 'subgroup', bagian: 'item' };
const OTHER_SERVICE = 'Lainnya';
const DESCRIPTION_WIDTH = 28;
const text = (value: string | null | undefined) => sanitizeCell(value ?? '');
const score = (header: string): XlColumn => ({ header, kind: 'score', band: true });
const count = (header: string): XlColumn => ({ header, kind: 'count' });
/** A masked cell (hidden under 3 respondents, or no answers) stays empty. */
const masked = (cell: CsiCell): number | null => (cell.ratings && cell.average !== null ? cell.average : null);

function sheetOf(workbook: ExcelJS.Workbook, name: string, tab: XlTab, title: string, context: HcSheetContext, span: number) {
    return startReportSheet(workbook, { name, tab, title, subtitle: context.surveyLine, simulation: context.simulation, span });
}

const dimensionColumns = (context: HcSheetContext, label: string): XlColumn[] => [
    { header: label, indent: true }, ...context.recap.dimensions.map(score), score('Rata-rata'), count('Penilai'),
    ...(context.hasPrevious ? [{ header: 'Selisih', kind: 'delta' as const }] : []),
];
const dimensionValues = (context: HcSheetContext, row: CsiRecapRow, label: string): XlValue[] => [
    label, ...context.recap.dimensions.map((dimension) => row.dimensions[dimension] ?? null), row.all.average, row.respondents,
    ...(context.hasPrevious ? [recapDelta(context.recap, row)] : []),
];

/** "Per layanan": dimension averages per layanan, then layanan × respondent location (+ all locations). */
export function addHcServiceSheet(workbook: ExcelJS.Workbook, name: string, context: HcSheetContext) {
    const { recap } = context;
    const services = recap.services.filter((row) => row.level === 'service');
    const dimensions = dimensionColumns(context, 'Layanan');
    const locations: XlColumn[] = [{ header: 'Layanan' }, ...recap.locations.map((location) => score(location.label)), score(CSI_LOCATION_ALL_LABEL), count('Penilai')];
    const span = Math.max(dimensions.length, locations.length);
    const { sheet, row } = sheetOf(workbook, name, 'analysis', 'Nilai per layanan', context, span);
    let next = sectionRow(sheet, row, 'Rata-rata per dimensi (1–5)', span);
    const overall = { ...recap.overall, level: 'service' as const };
    // Two small stacked tables: no freeze or filter (either would only fit the first one).
    const first = addTable(sheet, dimensions, services.map((service) => dimensionValues(context, service, text(service.label))), {
        bands: context.bands, filter: false,
        totals: [[ 'Semua layanan', ...recap.dimensions.map((dimension) => recap.overall.dimensions[dimension] ?? null), overall.all.average, overall.respondents,
            ...(context.hasPrevious ? [null] : [])]],
        headerRow: next, emptyText: 'Belum ada layanan yang dinilai.',
    });
    next = sectionRow(sheet, first.end + 2, 'Menurut lokasi responden (kosong = kurang dari 3 responden atau belum ada penilaian)', span);
    addTable(sheet, locations, services.map((service) => [
        text(service.label), ...recap.locations.map((location) => masked(service.byLocation[location.code])), masked(service.all), service.respondents,
    ]), { bands: context.bands, headerRow: next, filter: false, emptyText: 'Belum ada layanan yang dinilai.' });
}

/** "Layanan-bagian-PIC": one nested table (layanan bold on a tint, bagian bold, PIC / Tim indented). */
export function addHcNestedSheet(workbook: ExcelJS.Workbook, name: string, context: HcSheetContext) {
    const { recap } = context;
    const columns: XlColumn[] = [
        { header: 'Layanan / Bagian / PIC', indent: true }, { header: 'Tingkat' },
        ...recap.dimensions.map(score), score(`Rata-rata (${CSI_LOCATION_ALL_LABEL})`), count('Penilai'), count('Jumlah penilaian'),
        ...recap.locations.map((location) => score(location.label)),
        ...(context.hasPrevious ? [{ header: 'Selisih', kind: 'delta' as const }] : []),
        // Descriptive text last and capped: the scores stay next to the names, long titles wrap instead of widening the sheet.
        { header: 'Jabatan', width: DESCRIPTION_WIDTH }, { header: 'Fungsi pelayanan', width: DESCRIPTION_WIDTH },
    ];
    const { sheet, row } = sheetOf(workbook, name, 'analysis', 'Nilai per layanan, bagian & PIC', context, Math.min(columns.length, 10));
    const note = sectionRow(sheet, row, 'Kolom lokasi = lokasi responden; kosong = kurang dari 3 responden dari lokasi itu atau belum ada penilaian', Math.min(columns.length, 10));
    addTable(sheet, columns, recap.services.map((service) => [
        text(service.label), service.team ? TEAM_LEVEL_LABEL : LEVEL_LABEL[service.level],
        ...recap.dimensions.map((dimension) => service.dimensions[dimension] ?? null), service.all.average, service.respondents, service.all.ratings,
        ...recap.locations.map((location) => masked(service.byLocation[location.code])),
        ...(context.hasPrevious ? [recapDelta(recap, service)] : []),
        text(service.jobTitle), text(service.serviceFunction),
    ]), {
        bands: context.bands, headerRow: note, freeze: { columns: 1 }, emptyText: 'Belum ada PIC.',
        rowStyle: (index) => ({ level: LEVEL_STYLE[recap.services[index].level], topRule: index > 0 && recap.services[index].level === 'service' }),
    });
    // Wide table: printed pages continue to the right, each repeating the names column.
    sheet.pageSetup.printTitlesColumn = 'A:A';
}

/** "Rekap responden": respondent units (small ones merged), the score they gave over all PICs; no location columns. */
export function addHcRespondentSheet(workbook: ExcelJS.Workbook, name: string, context: HcSheetContext) {
    const rows = collapseRespondentRows(context.recap.respondentGroups);
    const columns: XlColumn[] = [{ header: 'Divisi / Departemen / Bagian', indent: true }, { header: 'Tingkat' }, score('Rata-rata diberikan'), count('Responden')];
    const { sheet, row } = sheetOf(workbook, name, 'analysis', 'Rekap responden per divisi & departemen', context, columns.length);
    const note = sectionRow(sheet, row, 'Kosong = kurang dari 3 responden; departemen kecil digabung', columns.length);
    addTable(sheet, columns, rows.map((unit) => [
        text(unit.label), unit.level === 'division' ? 'Divisi' : unit.level === 'department' ? 'Departemen' : 'Bagian', masked(unit.all), unit.respondents,
    ]), {
        bands: context.bands, headerRow: note, freeze: true, emptyText: 'Belum ada responden.',
        rowStyle: (index) => ({ level: UNIT_STYLE[rows[index].level] }),
    });
}

/** "Per pertanyaan" (HC): score per question (full text) per layanan, never per person. */
export function addHcQuestionSheet(workbook: ExcelJS.Workbook, name: string, context: HcSheetContext, fullOf: Map<string, string>) {
    const { recap } = context;
    const services = recap.services.filter((row) => row.level === 'service');
    const columns: XlColumn[] = [{ header: 'Pertanyaan', width: 60 }, ...services.map((service) => score(service.serviceCode ?? OTHER_SERVICE)), score('Semua layanan')];
    const { sheet, row } = sheetOf(workbook, name, 'analysis', 'Nilai per pertanyaan per layanan', context, columns.length);
    const note = sectionRow(sheet, row, 'Teks pertanyaan seperti di formulir; angka = rata-rata bintang (1–5)', columns.length);
    addTable(sheet, columns, recap.dimensions.map((dimension) => [
        text(fullOf.get(dimension) ?? dimension), ...services.map((service) => service.dimensions[dimension] ?? null), recap.overall.dimensions[dimension] ?? null,
    ]), { bands: context.bands, headerRow: note, filter: false, emptyText: 'Belum ada pertanyaan bernilai.' });
    return sheet;
}

/** Raw data: every respondent's stars per PIC (names!). Raw workbook only. */
export function addHcAnswersRawSheet(workbook: ExcelJS.Workbook, recap: CsiHcRecap, intro: RawIntro, bands: CsiScoreBands) {
    const columns: XlColumn[] = [
        { header: 'Responden' }, { header: 'Divisi' }, { header: 'Departemen' }, { header: 'Bagian' }, { header: 'Lokasi' },
        { header: 'Layanan' }, { header: 'Bagian PIC' }, { header: 'PIC' },
        ...recap.dimensions.map((label): XlColumn => ({ header: `${label} (bintang)`, kind: 'count' })),
        score('Rata-rata PIC'), score('Rata-rata responden'),
    ];
    const rows: XlValue[][] = recap.respondents.flatMap((respondent) => respondent.pics.map((pic) => [
        text(respondent.name), text(respondent.division), text(respondent.department), text(respondent.bagian),
        recap.locations.find((location) => location.code === respondent.location)?.label ?? '',
        pic.serviceCode ?? '', text(pic.bagian), text(pic.name),
        ...recap.dimensions.map((label) => pic.scores[label] ?? null), pic.average, respondent.average,
    ]));
    const sheet = startRawSheet(workbook, HC_SHEETS.detail, intro, columns.length);
    addTable(sheet, columns, rows, { bands, headerRow: RAW_HEADER_ROW, freeze: { columns: 1 }, emptyText: 'Belum ada jawaban.' });
}
