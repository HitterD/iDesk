import { Cell, Column, INK, ReportCanvas } from '../../reports/generators/report-pdf-canvas';
import { CsiReportModel } from '../services/csi-report-model';
import {
    choicesTable, commentsSection, dec, deltaColor, departmentsTable, DASH, rankingSection, scoreCell, shuffledTexts, signed, summary, TABLE_KEEP, text,
} from '../services/csi-report-pdf-sections';
import { collapseRespondentRows, CSI_NO_BAGIAN_LABEL, CsiCell, CsiHcRecap, CsiLocationCells, CsiRecapRow, CsiRespondentRow, recapDelta } from './csi-hc-report.calc';
import { compareServiceCodes } from '../services/csi-report-ranking';
import { serviceName } from './csi-org.constants';

/** HC executive report pages (spec "Struktur PDF (HC)"): one table per question a reader asks, no per-person grid. */
const ALL_LOCATIONS = 'Semua lokasi';
/** How the HC overall (and every page-1 number) is averaged: the same per-rating basis as the recap tables. */
export const HC_OVERALL_NOTE = 'Rata-rata semua penilaian (1 penilai × 1 PIC = 1 penilaian).';
const OTHER_SERVICE = 'Lainnya';
/** PDF tables trim leading spaces, so PIC rows get a bullet instead of an indent. */
const PIC_MARK = '•  ';
/** Share (%) of the table width taken by the location columns (+ Semua lokasi + count) of the location tables. */
const LOCATION_SHARE = 66;
/** Relative widths of the respondent recap (unit label, Semua lokasi, Responden). */
const RESPONDENT_WIDTH = { label: 70, value: 15 } as const;
/**
 * Widths (points of the 515 pt A4 content; scaled when Selisih is absent) of the dimension tables, each the measured
 * minimum: label fits "HCC · HC Compensation & Benefit" on two lines, a dimension column fits "Knowledge" whole at
 * 7.5 pt ("Responsiveness" / "Communication" take two lines next to five dimensions), "Rata-rata" and "Penilai"
 * fit their header, Selisih fits "+0,09".
 */
const DIMENSION_WIDTH = { label: 129, dimension: 53, average: 44.5, count: 36, delta: 40 } as const;
const serviceTitle = (code: string | null) => (code ? `${code} · ${serviceName(code) ?? code}` : OTHER_SERVICE);
/** "PRODUKSI & GUDANG" → "Produksi & Gudang" (short all-caps words such as QC, HR, GA stay as they are). */
const titleCase = (value: string) => value.split(' ').map((word) => (word.length <= 3 && /^[A-Z&]+$/.test(word) ? word
    : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())).join(' ');
type HcModel = CsiReportModel & { hcRecap: CsiHcRecap };
/** Ranking detail: bagian in title case; the "Tanpa bagian" label stays exactly as in the recap tables. */
const bagianDetail = (value: string) => (value === CSI_NO_BAGIAN_LABEL ? value : titleCase(value));

const deltaCell = (value: number | null): Cell => ({ text: signed(value), color: deltaColor(value) });

/** Columns: label, the 5 dimensions (full names), Rata-rata, Penilai and, with a previous period, Selisih. */
function dimensionColumns(recap: CsiHcRecap, label: string, hasPrevious: boolean): Column[] {
    const W = DIMENSION_WIDTH;
    return [
        { header: label, width: W.label },
        ...recap.dimensions.map((dimension) => ({ header: text(dimension), width: W.dimension, align: 'right' as const })),
        { header: 'Rata-rata', width: W.average, align: 'right' }, { header: 'Penilai', width: W.count, align: 'right' },
        ...(hasPrevious ? [{ header: 'Selisih', width: W.delta, align: 'right' as const }] : []),
    ];
}

function dimensionCells(model: HcModel, row: CsiRecapRow, label: Cell, bold: boolean): Cell[] {
    const { hcRecap: recap, bands } = model;
    return [
        label, ...recap.dimensions.map((dimension) => scoreCell(row.dimensions[dimension], bands, bold)),
        scoreCell(row.all.average, bands, true), { text: String(row.respondents) },
        ...(model.hasPrevious ? [deltaCell(recapDelta(recap, row))] : []),
    ];
}

/** Location columns (respondent location) + all locations + the number behind the row. */
function locationColumns(recap: CsiHcRecap, label: string, countHeader: string): Column[] {
    const width = LOCATION_SHARE / (recap.locations.length + 2);
    return [
        { header: label, width: 100 - LOCATION_SHARE },
        // "SJA 4 (Semarang)" → "SJA 4 Semarang": same words, no bracket to break inside a narrow header.
        ...recap.locations.map((location) => ({ header: location.label.replace(/[()]/g, ''), width, align: 'right' as const })),
        { header: ALL_LOCATIONS, width, align: 'right' }, { header: countHeader, width, align: 'right' },
    ];
}

/** Every missing score ("no answers" and "hidden, under 3 respondents") is the same grey dash. */
const maskedScore = (model: HcModel, value: CsiCell, strong: boolean): Cell =>
    (value.ratings && value.average !== null ? scoreCell(value.average, model.bands, strong) : { text: DASH, color: INK.tertiary });

function locationCells(model: HcModel, row: CsiLocationCells, count: number, bold: boolean): Cell[] {
    return [...model.hcRecap.locations.map((location) => maskedScore(model, row.byLocation[location.code], bold)), maskedScore(model, row.all, true), { text: String(count) }];
}

/** 2 · Nilai per layanan: dimensions per layanan, then layanan × respondent location. */
function serviceScores(canvas: ReportCanvas, model: HcModel) {
    const services = model.hcRecap.services.filter((row) => row.level === 'service');
    canvas.section('Nilai per layanan', undefined, TABLE_KEEP);
    canvas.note(`Rata-rata bintang (1-5) per dimensi; Penilai = jumlah responden yang menilai layanan itu.${model.hasPrevious ? ' Selisih = dibanding periode lalu.' : ''}`);
    canvas.table(dimensionColumns(model.hcRecap, 'Layanan', model.hasPrevious),
        services.map((row) => dimensionCells(model, row, { text: text(row.label), bold: true }, false)));
    canvas.subheading('Nilai per layanan menurut lokasi responden');
    canvas.note('Kolom lokasi = lokasi RESPONDEN yang menilai, bukan lokasi PIC; – = kurang dari 3 responden dari lokasi itu atau belum ada penilaian.');
    canvas.table(locationColumns(model.hcRecap, 'Layanan', 'Penilai'), services.map((row) => [{ text: text(row.label), bold: true }, ...locationCells(model, row, row.respondents, false)]));
}

/** 3 · Nilai per layanan, bagian & PIC: one nested table (layanan → bagian → PIC). */
function nestedScores(canvas: ReportCanvas, model: HcModel) {
    canvas.section('Nilai per layanan, bagian & PIC', undefined, TABLE_KEEP);
    canvas.note('Baris tebal = layanan dan bagian, baris bertitik = PIC; angka = rata-rata bintang (1-5) dari semua penilainya.');
    canvas.table(dimensionColumns(model.hcRecap, 'Layanan / Bagian / PIC', model.hasPrevious), model.hcRecap.services.map((row) => {
        const label: Cell = { text: `${row.level === 'pic' ? PIC_MARK : ''}${text(row.label)}`, bold: row.level !== 'pic', color: row.level === 'service' ? INK.brand : undefined };
        return dimensionCells(model, row, label, row.level !== 'pic');
    }));
}

/** Label cell of the respondent recap: DIVISI bold caps (brand), Departemen bold in normal case, bagian bulleted. */
function unitLabel(row: CsiRespondentRow): Cell {
    if (row.level === 'division') return { text: text(row.label).toUpperCase(), bold: true, color: INK.brand };
    if (row.level === 'department') return { text: titleCase(text(row.label)), bold: true };
    return { text: `${PIC_MARK}${titleCase(text(row.label))}` };
}

/**
 * 5 · Rekap responden per divisi / departemen (small groups merged, totals under 3 respondents hidden, no repeats).
 * No location columns: a hidden location would be derivable from the unit total minus the shown locations.
 */
function respondentRecap(canvas: ReportCanvas, model: HcModel) {
    canvas.section('Rekap responden per divisi & departemen', undefined, TABLE_KEEP);
    canvas.note('Rata-rata bintang dari responden unit itu ke semua PIC HC; – = kurang dari 3 responden atau tidak ada data.');
    canvas.table([
        { header: 'Divisi / Departemen / Bagian', width: RESPONDENT_WIDTH.label }, { header: ALL_LOCATIONS, width: RESPONDENT_WIDTH.value, align: 'right' },
        { header: 'Responden', width: RESPONDENT_WIDTH.value, align: 'right' },
    ], collapseRespondentRows(model.hcRecap.respondentGroups).map((row) => [
        unitLabel(row), maskedScore(model, row.all, true), { text: String(row.respondents) },
    ]));
}

/** 6 · Komentar per layanan, deterministic shuffled order. */
function comments(canvas: ReportCanvas, model: HcModel) {
    const codes = [...new Set(model.comments.map((group) => group.serviceCode))].sort(compareServiceCodes);
    commentsSection(canvas, 'Komentar & saran', codes.map((code) => ({
        heading: serviceTitle(code), texts: shuffledTexts(model.comments.filter((group) => group.serviceCode === code).flatMap((group) => group.comments)),
    })));
}

/** 7 · Lampiran: score per question per layanan (never per person), choices, participation per department. */
function appendix(canvas: ReportCanvas, model: HcModel) {
    const services = model.hcRecap.services.filter((row) => row.level === 'service');
    const fullOf = new Map(model.peopleGrid.columns.map((column) => [column.label, column.full]));
    canvas.pageBreak();
    canvas.section('Lampiran A · Nilai per pertanyaan per layanan', undefined, TABLE_KEEP);
    canvas.note('Teks pertanyaan lengkap seperti di formulir; angka = rata-rata bintang (1-5) per layanan.');
    const width = 50 / (services.length + 1);
    canvas.table([
        { header: 'Pertanyaan', width: 50 }, ...services.map((row) => ({ header: row.serviceCode ?? OTHER_SERVICE, width, align: 'right' as const })),
        { header: 'Semua layanan', width, align: 'right' },
    ], model.hcRecap.dimensions.map((dimension) => [
        { text: text(fullOf.get(dimension) ?? dimension) },
        ...services.map((row) => scoreCell(row.dimensions[dimension], model.bands)), scoreCell(model.hcRecap.overall.dimensions[dimension], model.bands, true),
    ]));
    choicesTable(canvas, model, 'Lampiran B · Jawaban pilihan');
    departmentsTable(canvas, model, `Lampiran ${model.choices.length ? 'C' : 'B'} · Partisipasi per departemen`);
}

/** Sections 1-7 of the HC report (the caller draws the header first and the sign-off after). */
export function renderHcReportPdf(canvas: ReportCanvas, model: HcModel) {
    const services = model.hcRecap.services.filter((row) => row.level === 'service').length;
    // "Yang dinilai" = the PIC / team rows of "Nilai per layanan, bagian & PIC" (rated or not).
    const rated = model.hcRecap.services.filter((row) => row.level === 'pic').length;
    summary(canvas, model, { value: rated, note: `PIC/tim di ${services} layanan · ${dec(model.hcRecap.overall.respondents, 0)} responden` }, HC_OVERALL_NOTE);
    canvas.pageBreak();
    serviceScores(canvas, model);
    nestedScores(canvas, model);
    rankingSection(canvas, model, { title: 'Peringkat per layanan', detailHeader: 'Bagian', heading: (group) => serviceTitle(group.serviceCode), detail: bagianDetail });
    respondentRecap(canvas, model);
    comments(canvas, model);
    appendix(canvas, model);
}
