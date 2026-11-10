import { Cell, Column, INK, ReportCanvas } from '../../reports/generators/report-pdf-canvas';
import { CsiReportModel } from '../services/csi-report-model';
import {
    choicesTable, commentsSection, dec, deltaColor, departmentsTable, DASH, rankingSection, scoreCell, shuffledTexts, signed, summary, TABLE_KEEP, text,
} from '../services/csi-report-pdf-sections';
import { CsiHcRecap, CsiLocationCells, CsiRecapRow, recapRowKey } from './csi-hc-report.calc';
import { serviceName } from './csi-org.constants';

/** HC executive report pages (spec "Struktur PDF (HC)"): one table per question a reader asks, no per-person grid. */
const ALL_LOCATIONS = 'Semua lokasi';
const OTHER_SERVICE = 'Lainnya';
/** PDF tables trim leading spaces, so PIC rows get a bullet instead of an indent. */
const PIC_MARK = '•  ';
/** Share (%) of the table width for the score columns of the location tables and for the label of dimension tables. */
const LOCATION_SHARE = 66;
/** Label share of the dimension tables: a little wider when there is no Selisih column. */
const dimensionLabelShare = (hasPrevious: boolean) => (hasPrevious ? 22 : 27);
const serviceTitle = (code: string | null) => (code ? `${code} · ${serviceName(code) ?? code}` : OTHER_SERVICE);
type HcModel = CsiReportModel & { hcRecap: CsiHcRecap };

const delta = (recap: CsiHcRecap, row: CsiRecapRow): number | null => {
    const before = recap.previous?.[recapRowKey(row)];
    return before === null || before === undefined || row.all.average === null ? null : Math.round((row.all.average - before) * 100) / 100;
};
const deltaCell = (value: number | null): Cell => ({ text: signed(value), color: deltaColor(value) });

/** Columns: label, the 5 dimensions (full names), Rata-rata, Penilai and, with a previous period, Selisih. */
function dimensionColumns(recap: CsiHcRecap, label: string, labelWidth: number, hasPrevious: boolean): Column[] {
    const tail = hasPrevious ? 3 : 2;
    const width = (100 - labelWidth) / (recap.dimensions.length + tail);
    return [
        { header: label, width: labelWidth },
        ...recap.dimensions.map((dimension) => ({ header: text(dimension), width, align: 'right' as const })),
        { header: 'Rata-rata', width, align: 'right' }, { header: 'Penilai', width, align: 'right' },
        ...(hasPrevious ? [{ header: 'Selisih', width, align: 'right' as const }] : []),
    ];
}

function dimensionCells(model: HcModel, row: CsiRecapRow, label: Cell, bold: boolean): Cell[] {
    const { hcRecap: recap, bands } = model;
    return [
        label, ...recap.dimensions.map((dimension) => scoreCell(row.dimensions[dimension], bands, bold)),
        scoreCell(row.all.average, bands, true), { text: String(row.respondents) },
        ...(model.hasPrevious ? [deltaCell(delta(recap, row))] : []),
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

function locationCells(model: HcModel, row: CsiLocationCells, count: number, bold: boolean): Cell[] {
    const cell = (value: CsiLocationCells['all'], strong: boolean): Cell => (value.ratings ? scoreCell(value.average, model.bands, strong) : { text: DASH, color: INK.tertiary });
    return [...model.hcRecap.locations.map((location) => cell(row.byLocation[location.code], bold)), cell(row.all, true), { text: String(count) }];
}

/** 2 · Nilai per layanan: dimensions per layanan, then layanan × respondent location. */
function serviceScores(canvas: ReportCanvas, model: HcModel) {
    const services = model.hcRecap.services.filter((row) => row.level === 'service');
    canvas.section('Nilai per layanan', undefined, TABLE_KEEP);
    canvas.note(`Rata-rata bintang (1-5) per dimensi; Penilai = jumlah responden yang menilai layanan itu.${model.hasPrevious ? ' Selisih = dibanding periode lalu.' : ''}`);
    canvas.table(dimensionColumns(model.hcRecap, 'Layanan', dimensionLabelShare(model.hasPrevious), model.hasPrevious),
        services.map((row) => dimensionCells(model, row, { text: text(row.label), bold: true }, false)));
    canvas.subheading('Nilai per layanan menurut lokasi responden');
    canvas.note('Kolom lokasi = lokasi RESPONDEN yang menilai, bukan lokasi PIC; tanda – = belum ada penilaian dari lokasi itu.');
    canvas.table(locationColumns(model.hcRecap, 'Layanan', 'Penilai'), services.map((row) => [{ text: text(row.label), bold: true }, ...locationCells(model, row, row.respondents, false)]));
}

/** 3 · Nilai per layanan, bagian & PIC: one nested table (layanan → bagian → PIC). */
function nestedScores(canvas: ReportCanvas, model: HcModel) {
    canvas.section('Nilai per layanan, bagian & PIC', undefined, TABLE_KEEP);
    canvas.note('Baris tebal = layanan dan bagian, baris bertitik = PIC; angka = rata-rata bintang (1-5) dari semua penilainya.');
    canvas.table(dimensionColumns(model.hcRecap, 'Layanan / Bagian / PIC', dimensionLabelShare(model.hasPrevious), model.hasPrevious), model.hcRecap.services.map((row) => {
        const label: Cell = { text: `${row.level === 'pic' ? PIC_MARK : ''}${text(row.label)}`, bold: row.level !== 'pic', color: row.level === 'service' ? INK.brand : undefined };
        return dimensionCells(model, row, label, row.level !== 'pic');
    }));
}

/** 5 · Rekap responden per divisi / departemen (small groups merged; cells under 3 respondents show –). */
function respondentRecap(canvas: ReportCanvas, model: HcModel) {
    canvas.section('Rekap responden per divisi & departemen', undefined, TABLE_KEEP);
    canvas.note('Rata-rata bintang yang diberikan responden unit itu ke semua PIC HC; – = kurang dari 3 responden, angka disembunyikan.');
    canvas.table(locationColumns(model.hcRecap, 'Divisi / Departemen / Bagian', 'Responden'), model.hcRecap.respondentGroups.map((row) => [
        { text: `${row.level === 'bagian' ? PIC_MARK : ''}${text(row.label)}`, bold: row.level !== 'bagian' },
        ...locationCells(model, row, row.respondents, row.level === 'division'),
    ]));
}

/** 6 · Komentar per layanan, deterministic shuffled order. */
function comments(canvas: ReportCanvas, model: HcModel) {
    const codes = [...new Set(model.comments.map((group) => group.serviceCode))]
        .sort((a, b) => (a === null ? 1 : b === null ? -1 : a.localeCompare(b)));
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
    summary(canvas, model, { value: model.counts.people + model.counts.teams, note: `PIC di ${services} layanan · ${dec(model.hcRecap.overall.respondents, 0)} responden` });
    canvas.pageBreak();
    serviceScores(canvas, model);
    nestedScores(canvas, model);
    rankingSection(canvas, model, { title: 'Peringkat per layanan', detailHeader: 'Bagian / fungsi', heading: (group) => serviceTitle(group.serviceCode) });
    respondentRecap(canvas, model);
    comments(canvas, model);
    appendix(canvas, model);
}
